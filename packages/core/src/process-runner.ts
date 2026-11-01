import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';

// Only these binaries may ever be started. Agents and the renderer never
// choose a binary or a shell string — callers pass a name from this list and
// an argument array that is validated below.
export const ALLOWED_BINARIES = ['npm', 'claude', 'codex'] as const;
export type AllowedBinary = (typeof ALLOWED_BINARIES)[number];

const SAFE_ARG = /^[A-Za-z0-9@%+=:,./_-]+$/;

export interface RunOptions {
  binary: AllowedBinary;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  onOutput?: (line: string) => void;
  /** Extra environment variables (values only from trusted code). */
  env?: Record<string, string>;
}

export interface RunResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  cancelled: boolean;
  output: string;
}

export class CommandNotFoundError extends Error {
  constructor(binary: string) {
    super(`"${binary}" was not found on PATH`);
    this.name = 'CommandNotFoundError';
  }
}

// Environment passed to child processes: enough to run toolchains, without
// leaking arbitrary host secrets (API keys, tokens) from the studio process.
const ENV_ALLOWLIST = [
  'PATH', 'Path', 'PATHEXT', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR',
  'SystemRoot', 'ComSpec', 'LANG', 'LC_ALL', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME',
  'npm_config_cache', 'NPM_CONFIG_CACHE', 'SHELL', 'USER', 'LOGNAME',
];

export function childEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...extra };
}

/** Locate a binary on PATH, honouring PATHEXT on Windows. */
export async function findOnPath(binary: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const pathValue = env.PATH ?? env.Path ?? '';
  const isWin = process.platform === 'win32';
  const exts = isWin ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const candidate = path.join(dir, binary + ext.toLowerCase());
      try {
        await access(candidate);
        return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return null;
}

export interface SpawnPlan {
  file: string;
  args: string[];
  windowsVerbatimArguments: boolean;
}

/**
 * Windows cannot spawn .cmd/.bat files without a shell (Node CVE-2024-27980
 * hardening). We go through cmd.exe only after every argument matched
 * SAFE_ARG, so no shell metacharacters can be interpreted.
 */
export function planSpawn(resolved: string, args: readonly string[], platform = process.platform): SpawnPlan {
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    const quoted = [`"${resolved}"`, ...args].join(' ');
    return { file: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${quoted}"`], windowsVerbatimArguments: true };
  }
  return { file: resolved, args: [...args], windowsVerbatimArguments: false };
}

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

export async function runAllowlisted(options: RunOptions): Promise<RunResult> {
  if (!ALLOWED_BINARIES.includes(options.binary)) throw new Error(`Binary not allowed: ${options.binary}`);
  for (const arg of options.args) {
    if (!SAFE_ARG.test(arg)) throw new Error(`Unsafe argument rejected: ${JSON.stringify(arg)}`);
  }
  const env = childEnv(options.env);
  const resolved = await findOnPath(options.binary, env);
  if (!resolved) throw new CommandNotFoundError(options.binary);
  return spawnBounded(planSpawn(resolved, options.args), { ...options, env });
}

interface BoundedOptions {
  cwd: string;
  timeoutMs: number;
  env: Record<string, string>;
  signal?: AbortSignal | undefined;
  onOutput?: ((line: string) => void) | undefined;
}

/** Internal: run an already-vetted spawn plan with timeout, cancellation and output cap. */
export function spawnBounded(plan: SpawnPlan, options: BoundedOptions): Promise<RunResult> {
  return new Promise<RunResult>((resolve, reject) => {
    if (options.signal?.aborted) {
      resolve({ exitCode: null, signal: null, timedOut: false, cancelled: true, output: '' });
      return;
    }
    const child = spawn(plan.file, plan.args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
      windowsVerbatimArguments: plan.windowsVerbatimArguments,
      // Own process group on POSIX so cancellation kills the whole tree.
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;
    let cancelled = false;
    const MAX_OUTPUT = 1_000_000;
    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (output.length < MAX_OUTPUT) output += text;
      for (const line of text.split(/\r?\n/)) if (line.trim()) options.onOutput?.(line);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const stop = () => {
      if (child.pid !== undefined && child.exitCode === null) killTree(child.pid);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, options.timeoutMs);
    const onAbort = () => {
      cancelled = true;
      stop();
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', (err) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({ exitCode, signal, timedOut, cancelled, output });
    });
  });
}
