import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { StorySpec } from '@studio/contracts';
import {
  JobManager,
  ProjectWorkspace,
  UnsafePathError,
  childEnv,
  planSpawn,
  resolveInside,
  runAllowlisted,
  spawnBounded,
  writeFileInside,
} from '../src/index.ts';

const example = JSON.parse(
  await readFile(fileURLToPath(new URL('../../../schemas/story-spec.example.json', import.meta.url)), 'utf8'),
) as StorySpec;
const tmp = () => mkdtemp(path.join(tmpdir(), 'studio-core-'));

describe('resolveInside', () => {
  it.each(['../x', 'a/../../x', '/etc/passwd', 'C:\\Windows', 'C:/x', '\\\\server\\share', 'a\\..\\..\\x', '', 'a\0b'])(
    'rejects %j',
    (p) => {
      expect(() => resolveInside('/root/ws', p)).toThrow(UnsafePathError);
    },
  );
  it('accepts nested relative paths', () => {
    expect(resolveInside('/root/ws', 'a/b/c.txt')).toBe(path.resolve('/root/ws', 'a', 'b', 'c.txt'));
  });
});

describe('writeFileInside', () => {
  it('refuses to write through a symlink that points outside the root', async () => {
    const root = await tmp();
    const outside = await tmp();
    await symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(writeFileInside(root, 'link/pwned.txt', 'x')).rejects.toThrow(UnsafePathError);
  });
  it('writes normal files', async () => {
    const root = await tmp();
    await writeFileInside(root, 'nested/dir/file.txt', 'hello');
    expect(await readFile(path.join(root, 'nested/dir/file.txt'), 'utf8')).toBe('hello');
  });
});

describe('process runner', () => {
  const nodePlan = (code: string) => ({ file: process.execPath, args: ['-e', code], windowsVerbatimArguments: false });

  it('rejects binaries outside the allowlist and shell metacharacters', async () => {
    await expect(runAllowlisted({ binary: 'rm' as never, args: [], cwd: '.', timeoutMs: 1000 })).rejects.toThrow('not allowed');
    await expect(runAllowlisted({ binary: 'npm', args: ['run', 'x;rm -rf /'], cwd: '.', timeoutMs: 1000 })).rejects.toThrow('Unsafe argument');
    await expect(runAllowlisted({ binary: 'npm', args: ['$(whoami)'], cwd: '.', timeoutMs: 1000 })).rejects.toThrow('Unsafe argument');
  });

  it('does not leak secrets from the parent environment', () => {
    process.env.STUDIO_TEST_API_KEY = 'secret';
    expect(childEnv()).not.toHaveProperty('STUDIO_TEST_API_KEY');
    delete process.env.STUDIO_TEST_API_KEY;
  });

  it('routes Windows .cmd shims through cmd.exe with verbatim quoting', () => {
    const plan = planSpawn('C:\\Program Files\\nodejs\\npm.cmd', ['ci', '--ignore-scripts'], 'win32');
    expect(plan.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
    expect(plan.args[3]).toBe('""C:\\Program Files\\nodejs\\npm.cmd" ci --ignore-scripts"');
    expect(plan.windowsVerbatimArguments).toBe(true);
    expect(planSpawn('/usr/bin/npm', ['ci'], 'linux')).toEqual({ file: '/usr/bin/npm', args: ['ci'], windowsVerbatimArguments: false });
  });

  it('captures output and exit codes', async () => {
    const result = await spawnBounded(nodePlan('console.log("hi"); process.exit(3)'), { cwd: '.', timeoutMs: 10_000, env: childEnv() });
    expect(result.exitCode).toBe(3);
    expect(result.output).toContain('hi');
  });

  it('passes stdin input without using arguments and separates stdout', async () => {
    const code = 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{console.log(d.toUpperCase());console.error("warn")})';
    const result = await spawnBounded(nodePlan(code), { cwd: '.', timeoutMs: 10_000, env: childEnv(), input: 'secret prompt; rm -rf /' });
    expect(result.stdout.trim()).toBe('SECRET PROMPT; RM -RF /');
    expect(result.output).toContain('warn');
    expect(result.stdout).not.toContain('warn');
  });

  it('allows empty-string arguments and quotes them for cmd.exe', () => {
    const plan = planSpawn('C:\\x\\claude.cmd', ['--tools', ''], 'win32');
    expect(plan.args[3]).toBe('""C:\\x\\claude.cmd" --tools """');
  });

  it('enforces timeouts', async () => {
    const result = await spawnBounded(nodePlan('setInterval(()=>{}, 1000)'), { cwd: '.', timeoutMs: 300, env: childEnv() });
    expect(result.timedOut).toBe(true);
  });

  it('cancels a running process', async () => {
    const controller = new AbortController();
    const pending = spawnBounded(nodePlan('setInterval(()=>{}, 1000)'), { cwd: '.', timeoutMs: 10_000, env: childEnv(), signal: controller.signal });
    setTimeout(() => controller.abort(), 200);
    const result = await pending;
    expect(result.cancelled).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });
});

describe('ProjectWorkspace', () => {
  it('seeds, lists and validates the sample project without overwriting', async () => {
    const ws = new ProjectWorkspace(await tmp());
    await ws.ensureSample(example);
    await ws.ensureSample(example);
    const list = await ws.list();
    expect(list.map((p) => p.id)).toEqual(['demo-heritage']);
    const spec = await ws.readSpec('demo-heritage');
    expect(spec.ok).toBe(true);
    await expect(ws.create(example)).rejects.toThrow();
  });

  it('reports invalid JSON as validation issues', async () => {
    const root = await tmp();
    const ws = new ProjectWorkspace(root);
    await ws.create(example);
    await writeFile(path.join(root, 'projects/demo-heritage/story-spec.json'), '{nope');
    const result = await ws.readSpec('demo-heritage');
    expect(result.ok).toBe(false);
  });

  it('rejects traversal through project ids', () => {
    const ws = new ProjectWorkspace('/tmp/ws');
    expect(() => ws.projectDir('../etc')).toThrow();
  });

  it('skips broken project folders when listing', async () => {
    const root = await tmp();
    await mkdir(path.join(root, 'projects/broken'), { recursive: true });
    expect(await new ProjectWorkspace(root).list()).toEqual([]);
  });
});

describe('JobManager', () => {
  it('runs, fails and cancels jobs', async () => {
    const jobs = new JobManager();
    const ok = jobs.start('p', ['html'], async ({ log }) => log('step'));
    expect((await jobs.wait(ok.id)).status).toBe('succeeded');
    const bad = jobs.start('p', ['html'], async () => {
      throw new Error('boom');
    });
    expect(await jobs.wait(bad.id)).toMatchObject({ status: 'failed', error: 'boom' });
    const slow = jobs.start('p', ['react'], ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
    jobs.cancel(slow.id);
    expect((await jobs.wait(slow.id)).status).toBe('cancelled');
  });
});
