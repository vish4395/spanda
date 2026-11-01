import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafePathError';
  }
}

/**
 * Resolve a relative, untrusted path inside `root`. Rejects absolute paths,
 * drive letters, UNC paths, NUL bytes and `..` traversal on every OS.
 */
export function resolveInside(root: string, relative: string): string {
  if (relative.length === 0 || relative.includes('\0')) throw new UnsafePathError('Empty or NUL-containing path');
  if (path.isAbsolute(relative) || path.win32.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) {
    throw new UnsafePathError(`Absolute paths are not allowed: ${relative}`);
  }
  const segments = relative.split(/[\\/]+/);
  if (segments.includes('..')) throw new UnsafePathError(`Path traversal is not allowed: ${relative}`);
  const base = path.resolve(root);
  const resolved = path.resolve(base, ...segments);
  const rel = path.relative(base, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new UnsafePathError(`Path escapes root: ${relative}`);
  }
  return resolved;
}

/** Throws if any existing component between root (exclusive) and target is a symlink. */
export async function assertNoSymlinks(root: string, target: string): Promise<void> {
  const base = path.resolve(root);
  const parts = path.relative(base, target).split(path.sep);
  let current = base;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new UnsafePathError(`Refusing to follow symlink: ${current}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }
}

/** Write a generated file to `root/relative` after path and symlink checks. */
export async function writeFileInside(root: string, relative: string, data: string | Uint8Array): Promise<string> {
  const target = resolveInside(root, relative);
  await assertNoSymlinks(root, target);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return target;
}

export type GeneratedFiles = Map<string, string | Uint8Array>;

/**
 * Generate into a fresh staging directory, then swap it into place so a
 * failed generation never leaves a half-written export behind.
 */
export async function writeGeneratedFiles(files: GeneratedFiles, outDir: string): Promise<string[]> {
  const staging = `${outDir}.staging-${process.pid}-${Date.now()}`;
  await rm(staging, { recursive: true, force: true });
  try {
    for (const [relative, data] of files) await writeFileInside(staging, relative, data);
    await rm(outDir, { recursive: true, force: true });
    await rename(staging, outDir);
  } catch (err) {
    await rm(staging, { recursive: true, force: true });
    throw err;
  }
  return [...files.keys()].sort();
}
