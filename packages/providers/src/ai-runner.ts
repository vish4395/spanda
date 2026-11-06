import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { AiProvenance, AiProviderId } from '@studio/contracts';
import { runAllowlisted } from '@studio/core';

// One structured task through the user's own provider CLI.
// - Arguments are fixed per provider and mode; the prompt goes through stdin.
// - `plain` gives the model no tools. `read-files` allows reading (only) the files
//   the studio copied into an empty temporary folder. `research` allows web
//   search and page fetches, and nothing else. No shell, no edits, no MCP.
// - The reply is parsed, schema-validated and retried once with the error; the
//   caller still sanitizes it. Nothing a model returns is ever executed.

type Runner = typeof runAllowlisted;

export type AiMode = 'plain' | 'read-files' | 'research';

export interface AiTask<T> {
  /** Short machine name, recorded in provenance (e.g. `kickoff`). */
  name: string;
  prompt: string;
  schema: z.ZodType<T>;
  mode?: AiMode;
  /** For `read-files`: files to copy into the run folder, as name → absolute source path. */
  files?: Record<string, string>;
  timeoutMs?: number;
  /** Skill names whose guidance is inside the prompt (provenance only). */
  skills?: string[];
}

export interface AiRunOptions {
  signal?: AbortSignal;
  onLog?: (line: string) => void;
  run?: Runner;
}

export interface AiResult<T> {
  value: T;
  provenance: AiProvenance;
}

export class ProviderOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderOutputError';
  }
}

const CLAUDE_TOOLS: Record<AiMode, string> = { plain: '', 'read-files': 'Read,Glob', research: 'WebSearch,WebFetch' };

/** Claude Code `-p` arguments: tools limited per mode, no session, no MCP servers. */
export function claudeArgs(mode: AiMode): string[] {
  const tools = CLAUDE_TOOLS[mode];
  const allowed = tools ? ['--allowedTools', ...tools.split(',')] : [];
  return ['-p', '--output-format', 'json', '--tools', tools, ...allowed, '--no-session-persistence', '--strict-mcp-config'];
}

/**
 * Codex `exec` arguments: read-only sandbox, final message written to a file.
 * Not yet verified against a live Codex install on this machine; the flags follow
 * the published `codex exec` documentation.
 */
export function codexArgs(mode: AiMode, outFile: string): string[] {
  return ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', ...(mode === 'research' ? ['--search'] : []), '--output-last-message', outFile, '-'];
}

interface ClaudeEnvelope {
  text: string;
  models: string[];
  costUsd: number | null;
}

/** Extract the final text, models and cost from Claude Code `--output-format json` stdout. */
export function parseClaudeEnvelope(stdout: string): ClaudeEnvelope {
  const line = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .reverse()
    .find((l) => l.startsWith('{') && l.includes('"result"'));
  if (!line) throw new ProviderOutputError('Claude Code returned no JSON result.');
  let parsed: { is_error?: boolean; result?: unknown; subtype?: string; modelUsage?: Record<string, unknown>; total_cost_usd?: unknown };
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new ProviderOutputError('Claude Code returned malformed JSON.');
  }
  if (parsed.is_error || typeof parsed.result !== 'string') throw new ProviderOutputError(`Claude Code reported an error (${parsed.subtype ?? 'unknown'}).`);
  const models = Object.keys(parsed.modelUsage ?? {}).filter((m) => /^[\w.:-]{1,64}$/.test(m)).slice(0, 8);
  const costUsd = typeof parsed.total_cost_usd === 'number' && parsed.total_cost_usd >= 0 ? parsed.total_cost_usd : null;
  return { text: parsed.result, models, costUsd };
}

/** Find the JSON object in model text (fences and prose around it are ignored) and validate it. */
export function parseJsonReply<T>(text: string, schema: z.ZodType<T>): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new ProviderOutputError('The response did not contain a JSON object.');
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ProviderOutputError('The response JSON could not be parsed.');
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ProviderOutputError(`The response did not match the expected shape: ${issue ? `${issue.path.join('.') || '(root)'}: ${issue.message}` : 'invalid'}`);
  }
  return result.data;
}

/** The JSON Schema for a task, appended to its prompt. */
export function schemaText(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }));
}

export function withSchema(prompt: string, schema: z.ZodType): string {
  return `${prompt}\n\nReply with ONE JSON object and nothing else. It must match this JSON Schema:\n${schemaText(schema)}`;
}

const DISPLAY: Record<AiProviderId, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

export async function runAiTask<T>(provider: AiProviderId, task: AiTask<T>, options: AiRunOptions = {}): Promise<AiResult<T>> {
  const run = options.run ?? runAllowlisted;
  const mode = task.mode ?? 'plain';
  const prompt = withSchema(task.prompt, task.schema);
  const cwd = await mkdtemp(path.join(tmpdir(), 'studio-ai-'));
  const log = (line: string) => options.onLog?.(`${provider}: ${line}`);
  try {
    if (mode === 'read-files') {
      for (const [name, source] of Object.entries(task.files ?? {})) {
        // Names come from trusted studio code; keep them flat so nothing lands outside the folder.
        if (!/^[\w.-]{1,120}$/.test(name) || name.startsWith('.')) throw new Error(`Unsafe reference file name: ${name}`);
        await writeFile(path.join(cwd, name), await readFile(source));
      }
    }
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const input = attempt === 1 ? prompt : `${prompt}\n\nYour previous reply was rejected (${lastError?.message}). Reply with the JSON object only.`;
      log(`${task.name} (attempt ${attempt}/2${mode === 'plain' ? '' : `, ${mode}`})`);
      const outFile = '.codex-last-message.txt'; // relative to cwd, so the argument stays portable
      const args = provider === 'claude-code' ? claudeArgs(mode) : codexArgs(mode, outFile);
      const result = await run({
        binary: provider === 'claude-code' ? 'claude' : 'codex',
        args,
        cwd,
        timeoutMs: task.timeoutMs ?? (mode === 'research' ? 600_000 : 240_000),
        input,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (result.cancelled) throw new Error('Cancelled');
      if (result.timedOut) throw new ProviderOutputError(`${DISPLAY[provider]} timed out.`);
      if (result.exitCode !== 0) throw new ProviderOutputError(`${DISPLAY[provider]} exited with code ${result.exitCode}. Check that the CLI is installed and signed in (run \`${provider === 'claude-code' ? 'claude' : 'codex'}\` once in a terminal).`);
      try {
        const envelope: ClaudeEnvelope = provider === 'claude-code' ? parseClaudeEnvelope(result.stdout) : { text: await readFile(path.join(cwd, outFile), 'utf8').catch(() => result.stdout), models: [], costUsd: null };
        const value = parseJsonReply(envelope.text, task.schema);
        if (envelope.costUsd !== null) log(`${task.name}: done (about $${envelope.costUsd.toFixed(3)} of plan usage)`);
        return {
          value,
          provenance: {
            provider,
            models: envelope.models,
            task: task.name.slice(0, 64),
            promptHash: createHash('sha256').update(prompt).digest('hex'),
            skills: (task.skills ?? []).slice(0, 8),
            costUsd: envelope.costUsd,
            createdAt: new Date().toISOString(),
          },
        };
      } catch (err) {
        lastError = err as Error;
        log(lastError.message);
      }
    }
    throw lastError ?? new ProviderOutputError('No valid reply.');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

/** A tiny structured call used by "Test connection". */
export const ConnectionCheck = z.object({ ok: z.literal(true), note: z.string().max(200) });

export function testConnection(provider: AiProviderId, options: AiRunOptions = {}) {
  return runAiTask(provider, { name: 'connection-test', prompt: 'This is a connection test from Spanda Studio. Set ok to true and write a one-sentence friendly note.', schema: ConnectionCheck, timeoutMs: 120_000 }, options);
}
