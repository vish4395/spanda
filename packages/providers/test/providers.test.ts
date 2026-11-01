import { describe, expect, it } from 'vitest';
import { CommandNotFoundError } from '@studio/core';
import { PROVIDERS, probeProvider } from '../src/index.ts';

const def = PROVIDERS[0]!;
const ok = { signal: null, timedOut: false, cancelled: false };

describe('provider probe', () => {
  it('reports available CLIs with version and never claims auth state', async () => {
    const status = await probeProvider(def, async (opts) => {
      expect(opts.args).toEqual(['--version']); // the only command ever run
      return { ...ok, exitCode: 0, output: '2.1.0 (Claude Code)\n' };
    });
    expect(status).toMatchObject({ state: 'available', version: '2.1.0 (Claude Code)', authentication: 'managed-by-provider-cli' });
  });

  it('reports missing CLIs honestly', async () => {
    const status = await probeProvider(def, async () => {
      throw new CommandNotFoundError('claude');
    });
    expect(status.state).toBe('not-found');
  });

  it('reports failures as errors', async () => {
    const status = await probeProvider(def, async () => ({ ...ok, exitCode: 1, output: '' }));
    expect(status.state).toBe('error');
  });
});
