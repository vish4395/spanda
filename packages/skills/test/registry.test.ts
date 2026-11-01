import { chmod, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadRegistry, loadSkill, parseFrontmatter, selectSkills, type SkillLock } from '../src/index.ts';

const skillMd = (name: string, extra = '') => `---\nname: ${name}\ndescription: Test skill\nversion: 1.0.0\nlicense: MIT\nsupportedTargets: [html]\ntriggers: [hero, scene]\n${extra}---\n# ${name}\nInstructions.\n`;

async function makeSkill(root: string, name: string, files: Record<string, string> = {}) {
  const dir = path.join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'SKILL.md'), skillMd(name));
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), content);
  }
  return dir;
}

describe('frontmatter parser', () => {
  it('reads scalars and lists', () => {
    const { attributes, body } = parseFrontmatter('---\nname: x\nlist: [a, "b c"]\n---\nBody');
    expect(attributes).toEqual({ name: 'x', list: ['a', 'b c'] });
    expect(body).toBe('Body');
  });
  it.each([
    ['no frontmatter', '# hi'],
    ['unterminated', '---\nname: x\n'],
    ['anchor', '---\nname: &a x\n---\n'],
    ['block scalar', '---\nname: |\n---\n'],
    ['duplicate', '---\nname: a\nname: b\n---\n'],
    ['bad key', '---\n__proto__: x\n---\n'],
  ])('rejects %s', (_label, text) => {
    expect(() => parseFrontmatter(text)).toThrow();
  });
});

describe('skill registry', () => {
  it('enables only pinned, unmodified, script-free (or approved) skills', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'skills-'));
    const dir = await makeSkill(root, 'hero-helper', { 'references/notes.md': 'notes' });
    const unpinned = await loadSkill(dir, {});
    expect(unpinned.manifest).toMatchObject({ pin: 'unpinned', enabled: false });

    const lock: SkillLock = { 'hero-helper': { version: '1.0.0', hash: unpinned.manifest.hash, scriptsApproved: false, reviewedBy: 't', reviewedAt: '2026-11-01' } };
    const pinned = await loadSkill(dir, lock);
    expect(pinned.manifest).toMatchObject({ pin: 'pinned', enabled: true, reason: null, files: 2, supportedTargets: ['html'] });
    expect(await pinned.readInstructions()).toContain('Instructions.');

    await writeFile(path.join(dir, 'references/notes.md'), 'tampered');
    expect((await loadSkill(dir, lock)).manifest).toMatchObject({ pin: 'modified', enabled: false });
  });

  it('treats scripts as disabled until explicitly approved', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'skills-'));
    const dir = await makeSkill(root, 'with-script', { 'scripts/run.txt': 'echo hi', 'tool.py': 'print(1)' });
    const hash = (await loadSkill(dir, {})).manifest.hash;
    const base = { version: '1.0.0', hash, reviewedBy: 't', reviewedAt: '2026-11-01' };
    expect((await loadSkill(dir, { 'with-script': { ...base, scriptsApproved: false } })).manifest).toMatchObject({ hasScripts: true, enabled: false });
    expect((await loadSkill(dir, { 'with-script': { ...base, scriptsApproved: true } })).manifest).toMatchObject({ hasScripts: true, scriptsApproved: true, enabled: true });
  });

  it.skipIf(process.platform === 'win32')('flags executable files as scripts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'skills-'));
    const dir = await makeSkill(root, 'exec-bit', { 'helper.md': 'x' });
    await chmod(path.join(dir, 'helper.md'), 0o755);
    expect((await loadSkill(dir, {})).manifest.hasScripts).toBe(true);
  });

  it('reports broken skills instead of dropping them silently', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'skills-'));
    await makeSkill(root, 'good-skill');
    await mkdir(path.join(root, 'mismatch'));
    await writeFile(path.join(root, 'mismatch/SKILL.md'), skillMd('other-name'));
    const linked = await makeSkill(root, 'linked');
    await symlink(tmpdir(), path.join(linked, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const { skills, errors } = await loadRegistry(root);
    expect(skills.map((s) => s.manifest.id)).toEqual(['good-skill']);
    expect(errors.map((e) => e.id).sort()).toEqual(['linked', 'mismatch']);
  });

  it('selects at most a few enabled skills by target and trigger', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'skills-'));
    const lock: SkillLock = {};
    for (const name of ['a-skill', 'b-skill']) {
      const s = await loadSkill(await makeSkill(root, name), {});
      lock[name] = { version: '1.0.0', hash: s.manifest.hash, scriptsApproved: false, reviewedBy: 't', reviewedAt: 'x' };
    }
    await writeFile(path.join(root, 'skills.lock.json'), JSON.stringify(lock));
    const { skills } = await loadRegistry(root);
    expect(skills.every((s) => s.manifest.enabled)).toBe(true);
    expect(selectSkills(skills, { target: 'html', keywords: ['hero'] }).map((s) => s.manifest.id)).toEqual(['a-skill', 'b-skill']);
    expect(selectSkills(skills, { target: 'react', keywords: ['hero'] })).toEqual([]);
    expect(selectSkills(skills, { target: 'html', keywords: ['gallery'] })).toEqual([]);
    expect(selectSkills(skills, { keywords: ['hero'] }, 1)).toHaveLength(1);
  });
});

describe('studio skills in this repository', () => {
  it('are all pinned and enabled', async () => {
    const { skills, errors } = await loadRegistry(fileURLToPath(new URL('../../../skills/', import.meta.url)));
    expect(errors).toEqual([]);
    expect(skills.map((s) => [s.manifest.id, s.manifest.pin, s.manifest.enabled])).toEqual([
      ['cinematic-story-architect', 'pinned', true],
      ['html-experience-engineer', 'pinned', true],
      ['react-experience-engineer', 'pinned', true],
      ['visual-qa', 'pinned', true],
    ]);
  });
});
