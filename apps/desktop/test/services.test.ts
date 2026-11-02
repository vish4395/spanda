import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { StorySpec } from '@studio/contracts';
import { StudioServices, type ResourcePaths } from '../src/main/services.ts';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const resources: ResourcePaths = {
  htmlRuntimeDir: path.join(repo, 'packages/generator-html/runtime'),
  threeDir: path.dirname(path.dirname(createRequire(path.join(repo, 'packages/generator-html/package.json')).resolve('three'))),
  reactTemplateDir: path.join(repo, 'packages/generator-react/template'),
  skillsDir: path.join(repo, 'skills'),
};
const sample = JSON.parse(await readFile(path.join(repo, 'schemas/story-spec.example.json'), 'utf8')) as StorySpec;
const open: StudioServices[] = [];

async function boot(root?: string) {
  const dir = root ?? (await mkdtemp(path.join(tmpdir(), 'studio-svc-')));
  const services = new StudioServices(dir, resources);
  open.push(services);
  await services.init(sample);
  return { services, dir };
}

afterEach(async () => {
  while (open.length) await open.pop()!.dispose();
});

describe('StudioServices (M1)', () => {
  it('seeds and imports the sample with an initial version', async () => {
    const { services } = await boot();
    expect(services.listProjects().map((p) => p.id)).toEqual(['demo-heritage']);
    const detail = services.openProject('demo-heritage');
    expect(detail.versions.map((v) => v.label)).toEqual(['Imported']);
  });

  it('creates projects from a name and idea, most recent first', async () => {
    const { services } = await boot();
    const created = await services.createProject({ name: 'Orbital Bakery', goal: 'Launch a neighbourhood bakery' });
    expect(created.id).toMatch(/^orbital-bakery-[0-9a-f]{6}$/);
    expect(services.listProjects()[0]?.id).toBe(created.id);
    expect((await services.validate(created.id)).ok).toBe(true);
    expect(services.openProject(created.id).versions.map((v) => v.label)).toEqual(['Created']);
  });

  it('snapshots without duplicates and restores without losing work', async () => {
    const { services, dir } = await boot();
    const id = 'demo-heritage';
    const imported = services.openProject(id).versions[0]!;
    expect((await services.snapshot(id)).id).toBe(imported.id); // unchanged spec → no duplicate

    const specPath = path.join(dir, 'projects', id, 'story-spec.json');
    const edited = JSON.parse(await readFile(specPath, 'utf8')) as StorySpec;
    edited.pages[0]!.scenes[0]!.content.heading = 'Edited heading';
    await writeFile(specPath, JSON.stringify(edited));

    const restored = await services.restore(id, imported.id);
    expect(restored).toMatchObject({ parentId: imported.id, label: 'Restored “Imported”' });
    expect(JSON.parse(await readFile(specPath, 'utf8')).pages[0].scenes[0].content.heading).toBe('A Place With a Story');
    const labels = services.openProject(id).versions.map((v) => v.label);
    expect(labels).toEqual(['Restored “Imported”', 'Before restore', 'Imported']);
  });

  it('refuses to restore a tampered snapshot', async () => {
    const { services, dir } = await boot();
    const version = services.openProject('demo-heritage').versions[0]!;
    const file = path.join(dir, 'projects/demo-heritage/snapshots', `${version.id}.json`);
    await writeFile(file, (await readFile(file, 'utf8')).replace('A Place With a Story', 'Injected'));
    await expect(services.restore('demo-heritage', version.id)).rejects.toThrow(/does not match its recorded hash/);
  });

  it('persists projects, recents and job logs across restarts', async () => {
    const first = await boot();
    const created = await first.services.createProject({ name: 'Persist Me', goal: 'Survive a restart' });
    const job = first.services.startGeneration(created.id, ['html']);
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (first.services.getJob(job.id).status !== 'running') {
          clearInterval(t);
          resolve();
        }
      }, 20);
    });
    await first.services.dispose();
    open.splice(open.indexOf(first.services), 1);

    const second = await boot(first.dir);
    expect(second.services.listProjects()[0]?.id).toBe(created.id);
    const jobs = second.services.openProject(created.id).jobs;
    expect(jobs[0]).toMatchObject({ id: job.id, status: 'succeeded' });
    expect(jobs[0]?.log.at(-1)).toBe('Done.');
  });

  it('scoped scene edits change only that scene and are reversible', async () => {
    const { services, dir } = await boot();
    const id = 'demo-heritage';
    const before = JSON.parse(await readFile(path.join(dir, 'projects', id, 'story-spec.json'), 'utf8')) as StorySpec;
    const imported = services.openProject(id).versions[0]!;
    const version = await services.updateScene(id, 'chapter-02', { content: { heading: 'A new chapter title', body: 'Rewritten.' } });
    expect(version.label).toBe('Edited “Journey”');
    const after = JSON.parse(await readFile(path.join(dir, 'projects', id, 'story-spec.json'), 'utf8')) as StorySpec;
    expect(JSON.stringify(after.pages[0]!.scenes[0])).toBe(JSON.stringify(before.pages[0]!.scenes[0])); // untouched scene identical
    expect(after.pages[0]!.scenes[1]!.content).toEqual({ heading: 'A new chapter title', body: 'Rewritten.' });
    expect(after.pages[0]!.scenes[1]!.id).toBe('chapter-02');
    await expect(services.updateScene(id, 'chapter-02', { content: { heading: '', script: 'x' } })).rejects.toThrow(/content/);
    await expect(services.updateScene(id, 'nope', { content: { heading: 'x' } })).rejects.toThrow(/not found/);
    await services.restore(id, imported.id);
    const restored = JSON.parse(await readFile(path.join(dir, 'projects', id, 'story-spec.json'), 'utf8')) as StorySpec;
    expect(restored.pages[0]!.scenes[1]!.content.heading).toBe('Explore the Journey');
  });

  it('rejects unknown projects and lists pinned skills', async () => {
    const { services } = await boot();
    expect(() => services.openProject('nope-123')).toThrow(/not found/);
    expect(() => services.startGeneration('nope-123', ['html'])).toThrow(/not found/);
    const skills = await services.listSkills();
    expect(skills.filter((s) => s.enabled).map((s) => s.id)).toHaveLength(4);
  });
});
