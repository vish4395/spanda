import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InvalidSpecError, UnsupportedSceneError, type StorySpec } from '@studio/contracts';
import { generateReactProject, prepareSpec, renderReactProject } from '../src/index.ts';

const example = JSON.parse(
  await readFile(fileURLToPath(new URL('../../../schemas/story-spec.example.json', import.meta.url)), 'utf8'),
) as StorySpec;
const clone = (): StorySpec => structuredClone(example);

describe('react-r3f generator', () => {
  it('emits a complete Vite/TS/R3F project with pinned dependencies', async () => {
    const files = await renderReactProject(example);
    for (const f of ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'src/main.tsx', 'src/App.tsx', 'src/scenes/HeroScene.tsx', 'src/scenes/ChapterScene.tsx', 'src/three/HeroCanvas.tsx', 'src/story-spec.json', 'src/tokens.css', 'README.md', 'THIRD_PARTY_NOTICES.md']) {
      expect(files.has(f), f).toBe(true);
    }
    const pkg = JSON.parse(files.get('package.json') as string) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    for (const version of [...Object.values(pkg.dependencies), ...Object.values(pkg.devDependencies)]) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/); // exact pins, no ranges
    }
  });

  it('keeps package.json and package-lock.json in sync', async () => {
    const files = await renderReactProject(example);
    const pkg = JSON.parse(files.get('package.json') as string);
    const lock = JSON.parse(files.get('package-lock.json') as string);
    expect(lock.packages[''].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[''].devDependencies).toEqual(pkg.devDependencies);
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(lock.packages[`node_modules/${name}`].version, name).toBe(version);
    }
  });

  it('lockfile contains only policy-allowed licenses', async () => {
    const files = await renderReactProject(example);
    const lock = JSON.parse(files.get('package-lock.json') as string) as { packages: Record<string, { license?: string }> };
    const allowed = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'CC-BY-4.0']);
    const offenders = Object.entries(lock.packages).filter(([k, v]) => k && !allowed.has(v.license ?? 'UNKNOWN'));
    expect(offenders).toEqual([]);
  });

  it('escapes spec text in index.html and keeps content as JSON data', async () => {
    const spec = clone();
    spec.project.name = '</title><script>alert(1)</script>';
    spec.pages[0]!.scenes[0]!.content.heading = '$& <b>bold</b>';
    const files = await renderReactProject(spec);
    const html = files.get('index.html') as string;
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;/title&gt;');
    expect(html).toContain('$&amp; &lt;b&gt;bold&lt;/b&gt;');
    expect(html).not.toContain('%STUDIO_');
    expect(JSON.parse(files.get('src/story-spec.json') as string).project.name).toBe(spec.project.name);
  });

  it('fails loudly on unsupported primitives and invalid specs', () => {
    const spec = clone();
    spec.pages[0]!.scenes[0]!.type = 'model-showcase';
    expect(() => prepareSpec(spec)).toThrow(UnsupportedSceneError);
    expect(() => prepareSpec(null)).toThrow(InvalidSpecError);
  });

  it('writes the project to disk', async () => {
    const out = path.join(await mkdtemp(path.join(tmpdir(), 'studio-react-')), 'react');
    const written = await generateReactProject(example, out);
    expect(written).toContain('src/App.tsx');
    expect(await readFile(path.join(out, 'src/tokens.css'), 'utf8')).toContain('#d9a76c');
  });
});
