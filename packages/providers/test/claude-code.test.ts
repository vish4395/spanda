import { describe, expect, it } from 'vitest';
import { CLAUDE_STORYBOARD_ARGS, draftStoryboardWithClaude, parseClaudeResult, parseStoryboardText } from '../src/index.ts';

const valid = { scenes: [{ type: 'hero', heading: 'H', body: 'b', visualNote: '' }, { type: 'chapter', heading: 'C', body: 'c', visualNote: '' }] };
const cliJson = (result: string, extra = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result, ...extra });
const base = { signal: null, timedOut: false, cancelled: false, output: '' };

describe('Claude Code storyboard adapter', () => {
  it('uses fixed, tool-free arguments and sends the prompt via stdin', async () => {
    let seen: { args: readonly string[]; input: string | undefined } | undefined;
    const out = await draftStoryboardWithClaude('PROMPT; $(rm -rf ~)', {
      run: async (opts) => {
        seen = { args: opts.args, input: opts.input };
        return { ...base, exitCode: 0, stdout: cliJson(`Here you go:\n${JSON.stringify(valid)}`) };
      },
    });
    expect(seen?.args).toEqual([...CLAUDE_STORYBOARD_ARGS]);
    expect(seen?.args).toContain('--tools');
    expect(seen?.input).toBe('PROMPT; $(rm -rf ~)');
    expect(out.scenes).toHaveLength(2);
  });

  it('retries once on invalid output, then fails clearly', async () => {
    let calls = 0;
    await expect(
      draftStoryboardWithClaude('p', {
        run: async () => {
          calls += 1;
          return { ...base, exitCode: 0, stdout: cliJson('{"scenes":[]}') };
        },
      }),
    ).rejects.toThrow(/schema/);
    expect(calls).toBe(2);
  });

  it('reports CLI errors and non-zero exits honestly', async () => {
    await expect(draftStoryboardWithClaude('p', { run: async () => ({ ...base, exitCode: 1, stdout: '' }) })).rejects.toThrow(/exited with code 1/);
    expect(() => parseClaudeResult(cliJson('x', { is_error: true, subtype: 'error_max_turns' }))).toThrow(/error_max_turns/);
    expect(() => parseClaudeResult('not json')).toThrow(/no JSON result/);
    expect(() => parseStoryboardText('no braces')).toThrow(/JSON object/);
  });
});
