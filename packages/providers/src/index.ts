import { tmpdir } from 'node:os';
import type { ProviderStatus } from '@studio/contracts';
import { CommandNotFoundError, runAllowlisted, type AllowedBinary } from '@studio/core';

// T004: detect official provider CLIs WITHOUT touching authentication.
// We only run `<cli> --version`. Login state, tokens and subscriptions are
// managed by each provider's own tooling; the studio never reads, copies or
// proxies them. Real generation runs arrive in a later milestone after a
// terms review of each CLI's supported automation modes (docs/07).

interface ProviderDef {
  id: ProviderStatus['id'];
  displayName: string;
  binary: AllowedBinary;
}

export const PROVIDERS: readonly ProviderDef[] = [
  { id: 'claude-code', displayName: 'Claude Code CLI', binary: 'claude' },
  { id: 'codex', displayName: 'Codex CLI', binary: 'codex' },
];

type Runner = typeof runAllowlisted;

export async function probeProvider(def: ProviderDef, run: Runner = runAllowlisted): Promise<ProviderStatus> {
  const base = { id: def.id, displayName: def.displayName, authentication: 'managed-by-provider-cli' as const };
  try {
    const result = await run({ binary: def.binary, args: ['--version'], cwd: tmpdir(), timeoutMs: 15_000 });
    if (result.exitCode !== 0) {
      return { ...base, state: 'error', version: null, detail: result.timedOut ? 'Timed out running --version' : `--version exited with ${result.exitCode}` };
    }
    const version = result.output.trim().split(/\r?\n/)[0]?.slice(0, 120) ?? null;
    return { ...base, state: 'available', version, detail: 'CLI found. Sign-in status is managed by the CLI itself and is not checked.' };
  } catch (err) {
    if (err instanceof CommandNotFoundError) {
      return { ...base, state: 'not-found', version: null, detail: `Install the official ${def.displayName} to use it as a provider.` };
    }
    return { ...base, state: 'error', version: null, detail: (err as Error).message };
  }
}

export function probeAll(run?: Runner): Promise<ProviderStatus[]> {
  return Promise.all(PROVIDERS.map((def) => probeProvider(def, run)));
}
export * from './claude-code.ts';
