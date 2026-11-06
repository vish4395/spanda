import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { claudeArgs, codexArgs, draftStoryboardWithAi, parseClaudeEnvelope, parseJsonReply, runAiTask, testConnection } from '../src/index.ts';

const valid = { scenes: [{ type: 'hero', heading: 'H', body: 'b', visualNote: '' }, { type: 'chapter', heading: 'C', body: 'c', visualNote: '' }] };
const cliJson = (result: string, extra = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result, ...extra });
const base = { signal: null, timedOut: false, cancelled: false, output: '' };
type Seen = { binary: string; args: readonly string[]; input: string | undefined; cwd: string };

describe('AI runner', () => {
  it('gives Claude no tools in plain mode and sends the prompt (with the schema) via stdin', async () => {
    let seen: Seen | undefined;
    const out = await draftStoryboardWithAi('claude-code', 'PROMPT; $(rm -rf ~)', {
      run: async (opts) => {
        seen = { binary: opts.binary, args: opts.args, input: opts.input, cwd: opts.cwd };
        return { ...base, exitCode: 0, stdout: cliJson(`Here you go:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``, { modelUsage: { 'claude-sonnet-5-5': {} }, total_cost_usd: 0.012 }) };
      },
    });
    expect(seen?.binary).toBe('claude');
    expect(seen?.args).toEqual(['-p', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--strict-mcp-config']);
    expect(seen?.input).toMatch(/^PROMPT; \$\(rm -rf ~\)/);
    expect(seen?.input).toContain('JSON Schema');
    expect(out.value.scenes).toHaveLength(2);
    expect(out.provenance).toMatchObject({ provider: 'claude-code', models: ['claude-sonnet-5-5'], task: 'storyboard', costUsd: 0.012 });
    expect(out.provenance.promptHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('limits tools per mode: reading files or web research only', () => {
    expect(claudeArgs('read-files')).toEqual(expect.arrayContaining(['--tools', 'Read,Glob', '--allowedTools', 'Read', 'Glob']));
    expect(claudeArgs('research')).toEqual(expect.arrayContaining(['--tools', 'WebSearch,WebFetch', '--allowedTools', 'WebSearch', 'WebFetch']));
    for (const mode of ['plain', 'read-files', 'research'] as const) {
      expect(claudeArgs(mode).join(' ')).not.toMatch(/Bash|Edit|Write|dangerously/);
      expect(codexArgs(mode, 'out.txt')).toEqual(expect.arrayContaining(['exec', '--sandbox', 'read-only']));
    }
    expect(codexArgs('research', 'o')).toContain('--search');
  });

  it('copies reference files into the run folder for read-files mode and refuses unsafe names', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const dir = await mkdtemp(path.join(tmpdir(), 'ref-'));
    await writeFile(path.join(dir, 'brief.md'), 'teal');
    let listed: string[] = [];
    await runAiTask('claude-code', { name: 't', prompt: 'p', schema: z.object({ a: z.number() }), mode: 'read-files', files: { 'brief.md': path.join(dir, 'brief.md') } }, {
      run: async (opts) => {
        listed = (await import('node:fs')).readdirSync(opts.cwd);
        return { ...base, exitCode: 0, stdout: cliJson('{"a":1}') };
      },
    });
    expect(listed).toEqual(['brief.md']);
    await expect(runAiTask('claude-code', { name: 't', prompt: 'p', schema: z.object({}), mode: 'read-files', files: { '../x': path.join(dir, 'brief.md') } }, { run: async () => ({ ...base, exitCode: 0, stdout: '' }) })).rejects.toThrow(/Unsafe/);
  });

  it('reads the Codex final message from its output file', async () => {
    const out = await testConnection('codex', {
      run: async (opts) => {
        const fs = await import('node:fs/promises');
        await fs.writeFile((await import('node:path')).join(opts.cwd, '.codex-last-message.txt'), '{"ok":true,"note":"hi"}');
        return { ...base, exitCode: 0, stdout: 'log noise' };
      },
    });
    expect(out.value).toEqual({ ok: true, note: 'hi' });
    expect(out.provenance.provider).toBe('codex');
  });

  it('retries once on invalid output, then fails clearly', async () => {
    let calls = 0;
    await expect(
      draftStoryboardWithAi('claude-code', 'p', {
        run: async () => {
          calls += 1;
          return { ...base, exitCode: 0, stdout: cliJson('{"scenes":[]}') };
        },
      }),
    ).rejects.toThrow(/expected shape/);
    expect(calls).toBe(2);
  });

  it('reports CLI errors, timeouts and cancellation honestly', async () => {
    await expect(draftStoryboardWithAi('claude-code', 'p', { run: async () => ({ ...base, exitCode: 1, stdout: '' }) })).rejects.toThrow(/exited with code 1/);
    await expect(draftStoryboardWithAi('codex', 'p', { run: async () => ({ ...base, exitCode: null, timedOut: true, stdout: '' }) })).rejects.toThrow(/Codex timed out/);
    await expect(draftStoryboardWithAi('claude-code', 'p', { run: async () => ({ ...base, exitCode: null, cancelled: true, stdout: '' }) })).rejects.toThrow(/Cancelled/);
    expect(() => parseClaudeEnvelope(cliJson('x', { is_error: true, subtype: 'error_max_turns' }))).toThrow(/error_max_turns/);
    expect(() => parseClaudeEnvelope('not json')).toThrow(/no JSON result/);
    expect(() => parseJsonReply('no braces', z.object({}))).toThrow(/JSON object/);
  });
});
