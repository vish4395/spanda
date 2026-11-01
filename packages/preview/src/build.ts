import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runAllowlisted, throwIfCancelled, type RunResult } from '@studio/core';
import { collectRuntimeNotices } from '@studio/licensing';

export interface BuildOptions {
  signal: AbortSignal;
  log: (line: string) => void;
  /** Per-step timeout; defaults to 10 minutes. */
  timeoutMs?: number;
}

function check(step: string, result: RunResult): void {
  if (result.cancelled) throw new Error(`${step} cancelled`);
  if (result.timedOut) throw new Error(`${step} timed out`);
  if (result.exitCode !== 0) {
    const tail = result.output.trim().split(/\r?\n/).slice(-15).join('\n');
    throw new Error(`${step} failed (exit ${result.exitCode ?? result.signal})\n${tail}`);
  }
}

/**
 * Install the pinned dependency tree and build a generated React project.
 * Dependency lifecycle scripts are disabled (`--ignore-scripts`).
 * Returns the `dist/` directory, which also receives full license notices.
 */
export async function buildReactExport(projectDir: string, options: BuildOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const common = { cwd: projectDir, timeoutMs, signal: options.signal, onOutput: options.log };
  options.log('$ npm ci --ignore-scripts --no-audit --no-fund');
  check('npm ci', await runAllowlisted({ ...common, binary: 'npm', args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'] }));
  throwIfCancelled(options.signal);
  options.log('$ npm run build');
  check('npm run build', await runAllowlisted({ ...common, binary: 'npm', args: ['run', 'build'] }));
  const dist = path.join(projectDir, 'dist');
  await access(path.join(dist, 'index.html'));
  await writeFile(path.join(dist, 'THIRD_PARTY_NOTICES.md'), await collectRuntimeNotices(projectDir));
  options.log('Build complete; wrote dist/THIRD_PARTY_NOTICES.md');
  return dist;
}
