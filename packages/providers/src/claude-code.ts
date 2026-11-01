import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DraftStoryboardOutput, type DraftStoryboardOutput as DraftOutput } from '@studio/contracts';
import { runAllowlisted } from '@studio/core';

// Storyboard drafting through the user's own, locally installed Claude Code CLI
// in its documented non-interactive mode (`-p --output-format json`).
// - The prompt goes through stdin; arguments are fixed constants.
// - All tools are disabled (`--tools ""`), MCP servers are not loaded, sessions
//   are not persisted, and it runs in an empty temporary directory.
// - Output is parsed and schema-validated; nothing it returns is executed.
// Disabled by default; the user enables it in Settings after reviewing the terms.

export const CLAUDE_STORYBOARD_ARGS = ['-p', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--strict-mcp-config'] as const;

type Runner = typeof runAllowlisted;

export class ProviderOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderOutputError';
  }
}

/** Extract the model's final text from `--output-format json` stdout. */
export function parseClaudeResult(stdout: string): string {
  const line = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .reverse()
    .find((l) => l.startsWith('{') && l.includes('"result"'));
  if (!line) throw new ProviderOutputError('Claude Code returned no JSON result.');
  let parsed: { is_error?: boolean; result?: unknown; subtype?: string };
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new ProviderOutputError('Claude Code returned malformed JSON.');
  }
  if (parsed.is_error || typeof parsed.result !== 'string') throw new ProviderOutputError(`Claude Code reported an error (${parsed.subtype ?? 'unknown'}).`);
  return parsed.result;
}

/** Find and validate the storyboard JSON object inside model text. */
export function parseStoryboardText(text: string): DraftOutput {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new ProviderOutputError('The response did not contain a JSON object.');
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ProviderOutputError('The response JSON could not be parsed.');
  }
  const result = DraftStoryboardOutput.safeParse(json);
  if (!result.success) throw new ProviderOutputError(`The response did not match the storyboard schema: ${result.error.issues[0]?.message ?? 'invalid'}`);
  return result.data;
}

export async function draftStoryboardWithClaude(prompt: string, options: { signal?: AbortSignal; timeoutMs?: number; run?: Runner; onLog?: (line: string) => void } = {}): Promise<DraftOutput> {
  const run = options.run ?? runAllowlisted;
  const cwd = await mkdtemp(path.join(tmpdir(), 'studio-claude-'));
  try {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const input = attempt === 1 ? prompt : `${prompt}\n\nYour previous reply was rejected (${lastError?.message}). Reply with the JSON object only.`;
      options.onLog?.(`claude-code: drafting storyboard (attempt ${attempt}/2)`);
      const result = await run({ binary: 'claude', args: [...CLAUDE_STORYBOARD_ARGS], cwd, timeoutMs: options.timeoutMs ?? 180_000, input, ...(options.signal ? { signal: options.signal } : {}) });
      if (result.cancelled) throw new Error('Cancelled');
      if (result.timedOut) throw new ProviderOutputError('Claude Code timed out.');
      if (result.exitCode !== 0) throw new ProviderOutputError(`Claude Code exited with code ${result.exitCode}. Check that the CLI is signed in (run \`claude\` once in a terminal).`);
      try {
        return parseStoryboardText(parseClaudeResult(result.stdout));
      } catch (err) {
        lastError = err as Error;
        options.onLog?.(`claude-code: ${lastError.message}`);
      }
    }
    throw lastError ?? new ProviderOutputError('No valid storyboard returned.');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
