import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SkillManifest } from '@studio/contracts';
import { evaluateLicense } from '@studio/licensing';
import { parseFrontmatter, type FrontmatterValue } from './frontmatter.ts';

// Skill registry (T008, docs/05): metadata-first loading, content pinning and
// a permission policy. Skills are guidance text for agents; nothing here ever
// executes skill content.

export const LOCKFILE = 'skills.lock.json';
const SKILL_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 1_000_000;
const SCRIPT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.py', '.rb', '.pl', '.php', '.bat', '.cmd', '.exe', '.dll', '.so', '.dylib', '.wasm']);
// Studio-authored skills use this license reference; third-party skills must carry an SPDX id.
export const STUDIO_ORIGINAL_LICENSE = 'LicenseRef-Studio-Original';

export interface SkillLockEntry {
  version: string;
  hash: string;
  scriptsApproved: boolean;
  reviewedBy: string;
  reviewedAt: string;
}

export type SkillLock = Record<string, SkillLockEntry>;

interface SkillFile {
  rel: string;
  sha256: string;
  script: boolean;
}

export interface LoadedSkill {
  manifest: SkillManifest;
  /** Full instructions, loaded on demand (progressive disclosure). */
  readInstructions(): Promise<string>;
}

async function walk(root: string, dir = root, files: SkillFile[] = []): Promise<SkillFile[]> {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error(`Symlinks are not allowed in skills (${rel})`);
    if (info.isDirectory()) {
      await walk(root, full, files);
      continue;
    }
    if (!info.isFile()) throw new Error(`Unsupported file type in skill (${rel})`);
    if (info.size > MAX_FILE_BYTES) throw new Error(`File too large in skill (${rel})`);
    if (files.length >= MAX_FILES) throw new Error(`Too many files in skill (> ${MAX_FILES})`);
    const data = await readFile(full);
    const executableBit = process.platform !== 'win32' && (info.mode & 0o111) !== 0;
    const script = SCRIPT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) || rel.startsWith('scripts/') || executableBit;
    files.push({ rel, sha256: createHash('sha256').update(data).digest('hex'), script });
  }
  return files;
}

/** Content hash over every file path and digest, independent of OS path separators. */
export function skillHash(files: readonly { rel: string; sha256: string }[]): string {
  const h = createHash('sha256');
  for (const f of [...files].sort((a, b) => a.rel.localeCompare(b.rel))) h.update(`${f.rel}\0${f.sha256}\n`);
  return h.digest('hex');
}

const list = (v: FrontmatterValue | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);
const str = (v: FrontmatterValue | undefined, fallback: string): string => (typeof v === 'string' && v ? v : fallback);

export async function loadSkill(dir: string, lock: SkillLock): Promise<LoadedSkill> {
  const id = path.basename(dir);
  if (!SKILL_ID.test(id)) throw new Error(`Invalid skill directory name "${id}"`);
  const files = await walk(dir);
  const skillFile = path.join(dir, 'SKILL.md');
  const { attributes } = parseFrontmatter(await readFile(skillFile, 'utf8'));
  if (attributes.name !== id) throw new Error(`Skill "${id}": frontmatter name must equal the directory name`);
  const hash = skillHash(files);
  const entry = lock[id];
  const version = str(attributes.version, '0.0.0');
  const license = str(attributes.license, 'UNKNOWN');
  const hasScripts = files.some((f) => f.script);
  const pin: SkillManifest['pin'] = !entry ? 'unpinned' : entry.hash === hash && entry.version === version ? 'pinned' : 'modified';
  const scriptsApproved = Boolean(entry?.scriptsApproved && pin === 'pinned');
  const licenseOk = license === STUDIO_ORIGINAL_LICENSE || evaluateLicense(license) === 'allowed';

  let reason: string | null = null;
  if (pin === 'unpinned') reason = 'Not reviewed yet: pin it after review to enable.';
  else if (pin === 'modified') reason = 'Content changed since it was reviewed; disabled until re-pinned.';
  else if (hasScripts && !scriptsApproved) reason = 'Contains scripts that have not been approved.';
  else if (!licenseOk) reason = `License "${license}" needs review before use.`;

  return {
    manifest: {
      id,
      name: id,
      description: str(attributes.description, ''),
      version,
      source: str(attributes.source, 'local'),
      license,
      supportedTargets: list(attributes.supportedTargets),
      triggers: list(attributes.triggers),
      permissions: list(attributes.permissions),
      hash,
      files: files.length,
      pin,
      hasScripts,
      scriptsApproved,
      enabled: reason === null,
      reason,
    },
    readInstructions: async () => parseFrontmatter(await readFile(skillFile, 'utf8')).body,
  };
}

export async function readLock(root: string): Promise<SkillLock> {
  try {
    return JSON.parse(await readFile(path.join(root, LOCKFILE), 'utf8')) as SkillLock;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

/** Load every skill under `root`. Broken skills are reported, never silently dropped. */
export async function loadRegistry(root: string): Promise<{ skills: LoadedSkill[]; errors: { id: string; error: string }[] }> {
  const lock = await readLock(root);
  const skills: LoadedSkill[] = [];
  const errors: { id: string; error: string }[] = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    try {
      skills.push(await loadSkill(path.join(root, entry.name), lock));
    } catch (err) {
      errors.push({ id: entry.name, error: (err as Error).message });
    }
  }
  return { skills, errors };
}

/**
 * Select enabled skills for a task (docs/05: phase + scene + target, 2–4 skills).
 * Only metadata is consulted; instructions are read later for the chosen few.
 */
export function selectSkills(skills: readonly LoadedSkill[], query: { target?: string; keywords: string[] }, max = 4): LoadedSkill[] {
  const words = query.keywords.map((k) => k.toLowerCase());
  return skills
    .filter((s) => s.manifest.enabled)
    .filter((s) => !query.target || s.manifest.supportedTargets.length === 0 || s.manifest.supportedTargets.includes(query.target))
    .map((s) => ({ s, score: s.manifest.triggers.filter((t) => words.includes(t.toLowerCase())).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.manifest.id.localeCompare(b.s.manifest.id))
    .slice(0, max)
    .map((x) => x.s);
}
