import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { StorySpec } from '@studio/contracts';
import { generateHtmlSite } from '@studio/generator-html';
import { generateReactProject } from '@studio/generator-react';
import { buildExport, createZip, ExportError, readZip } from '../src/index.ts';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const sample = JSON.parse(await readFile(path.join(repo, 'schemas/story-spec.example.json'), 'utf8')) as StorySpec;

/** A real generator-react project, with the build output and installed packages faked (no npm in unit tests). */
async function fakeReactOutput(dir: string, spec: StorySpec, lockPackages: Record<string, unknown> = {}) {
  await generateReactProject(spec, dir);
  const lockFile = path.join(dir, 'package-lock.json');
  const lock = JSON.parse(await readFile(lockFile, 'utf8')) as { packages: Record<string, unknown> };
  await writeFile(lockFile, JSON.stringify({ ...lock, packages: { ...lock.packages, ...lockPackages } }));
  await mkdir(path.join(dir, 'dist'), { recursive: true });
  await mkdir(path.join(dir, 'node_modules', 'react'), { recursive: true });
  await writeFile(path.join(dir, 'dist', 'index.html'), '<!doctype html>');
  await writeFile(path.join(dir, 'dist', 'THIRD_PARTY_NOTICES.md'), '# Third-party notices\n\n## react 19.3.1 (MIT)\n\nfull text\n');
  await writeFile(path.join(dir, 'node_modules', 'react', 'index.js'), 'module.exports = {}');
  await writeFile(path.join(dir, '.env'), 'SECRET=1');
}

async function outputs(spec: StorySpec = sample) {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-export-'));
  const html = path.join(root, 'html');
  const react = path.join(root, 'react');
  await generateHtmlSite(spec, html);
  await fakeReactOutput(react, spec);
  return { root, html, react };
}

describe('createZip', () => {
  it('round-trips files and is byte-for-byte reproducible', () => {
    const entries = [
      { path: 'b/two.txt', data: Buffer.from('two '.repeat(100)) },
      { path: 'a.bin', data: Buffer.from([1, 2, 3]) },
      { path: 'ünïcode.md', data: Buffer.from('ok') },
    ];
    const zip = createZip(entries);
    expect(createZip([...entries].reverse()).equals(zip)).toBe(true);
    const files = readZip(zip);
    expect([...files.keys()]).toEqual(['a.bin', 'b/two.txt', 'ünïcode.md']);
    expect(files.get('b/two.txt')!.toString()).toBe('two '.repeat(100));
  });

  it.each(['/abs', '../up', 'a/../b', 'a//b', 'C:/x', 'a\\b', ''])('rejects unsafe path %j', (p) => {
    expect(() => createZip([{ path: p, data: Buffer.alloc(0) }])).toThrow(/Unsafe/);
  });

  it('reader rejects corrupted data', () => {
    const zip = createZip([{ path: 'a.txt', data: Buffer.from('hello hello hello hello') }]);
    zip[40] = zip[40]! ^ 0xff; // flip a byte inside the compressed body
    expect(() => readZip(zip)).toThrow();
    expect(() => readZip(Buffer.from('nope'))).toThrow(/Not a ZIP/);
  });

  it('rejects duplicate paths', () => {
    expect(() => createZip([{ path: 'x', data: Buffer.alloc(0) }, { path: 'x', data: Buffer.alloc(1) }])).toThrow(/Duplicate/);
  });
});

describe('buildExport (T024)', () => {
  it('packages both targets with notices, credits, SBOM and metadata', async () => {
    const { html, react } = await outputs();
    // Symlinks need elevated rights on Windows runners; the skip logic is platform-independent.
    if (process.platform !== 'win32') await symlink(path.join(html, 'index.html'), path.join(react, 'src', 'linked.txt'));
    const result = await buildExport({ spec: sample, outputs: { html, react }, studioVersion: '0.0.1' });
    expect(result).toMatchObject({ licenses: 'passed', rights: 'passed' });
    const files = readZip(result.zip);
    const names = [...files.keys()];
    for (const required of ['README.md', 'LICENSES.md', 'THIRD_PARTY_NOTICES.md', 'ASSET_CREDITS.md', 'sbom.cdx.json', 'metadata/story-spec.json', 'metadata/licenses.json', 'metadata/asset-provenance.json', 'html/index.html', 'html/vendor/three/three.module.js', 'html/vendor/three/package.json', 'react/package-lock.json', 'react/src/App.tsx', 'react/src/story-spec.json']) {
      expect(names).toContain(required);
    }
    // Source only, no installed packages, build output, dotfiles or followed symlinks.
    expect(names.some((n) => n.startsWith('react/node_modules/') || n.startsWith('react/dist/') || n.includes('/.') || n.endsWith('linked.txt'))).toBe(false);
    expect(JSON.parse(files.get('metadata/story-spec.json')!.toString())).toEqual(sample);
    const sbom = JSON.parse(files.get('sbom.cdx.json')!.toString());
    expect(sbom).toMatchObject({ bomFormat: 'CycloneDX', specVersion: '1.5' });
    const purls = new Map(sbom.components.map((c: { name: string; purl: string; scope: string }) => [c.name, c]));
    expect(purls.get('react')).toMatchObject({ purl: expect.stringMatching(/^pkg:npm\/react@\d/), scope: 'required' });
    expect(purls.get('three')).toMatchObject({ purl: expect.stringMatching(/^pkg:npm\/three@\d/), scope: 'required' });
    expect(purls.get('vite')).toMatchObject({ purl: 'pkg:npm/vite@7.3.7', scope: 'excluded' });
    expect(purls.get('@react-three/fiber')).toMatchObject({ purl: expect.stringMatching(/^pkg:npm\/%40react-three\/fiber@/) });
    const notices = files.get('THIRD_PARTY_NOTICES.md')!.toString();
    expect(notices).toContain('## three');
    expect(notices).toContain('full text'); // full React texts from the build, not the summary
    expect(files.get('LICENSES.md')!.toString()).toContain('MIT No Attribution');
    expect(files.get('README.md')!.toString()).toContain('npm ci');
    // Reproducible: the same outputs export to the same bytes.
    expect((await buildExport({ spec: sample, outputs: { html, react }, studioVersion: '0.0.1' })).zip.equals(result.zip)).toBe(true);
  });

  it('carries no Apache-2.0 obligation into exported code; template sources are marked MIT-0 (T035)', async () => {
    const { html, react } = await outputs();
    const files = readZip((await buildExport({ spec: sample, outputs: { html, react }, studioVersion: '0' })).zip);
    // Third-party code keeps its own license (vendored three.js, notices); everything else is ours.
    const ours = [...files.keys()].filter((n) => !n.startsWith('html/vendor/') && !/THIRD_PARTY_NOTICES\.md$|sbom\.cdx\.json$|package-lock\.json$|metadata\/licenses\.json$/.test(n));
    for (const name of ours) expect(files.get(name)!.toString('utf8'), name).not.toMatch(/Apache/i);
    const templated = ours.filter((n) => /^html\/(js\/.*\.js|styles\.css)$|^react\/src\/(?!story-spec).*\.(tsx?|css)$|^react\/vite\.config\.ts$/.test(n) && !/tokens\.css$/.test(n));
    expect(templated.length).toBeGreaterThan(10);
    for (const name of templated) expect(files.get(name)!.toString('utf8').split('\n')[0], name).toMatch(/SPDX-License-Identifier: MIT-0/);
  });

  it('exports only the selected target', async () => {
    const { html } = await outputs();
    const files = readZip((await buildExport({ spec: sample, outputs: { html }, studioVersion: '0.0.1' })).zip);
    expect([...files.keys()].some((n) => n.startsWith('react/'))).toBe(false);
    expect(files.get('README.md')!.toString()).not.toContain('npm ci');
  });

  it('refuses stale, missing or unbuilt outputs', async () => {
    const { root, html, react } = await outputs();
    const edited = structuredClone(sample);
    edited.pages[0]!.scenes[0]!.content.heading = 'Changed since the last build';
    await expect(buildExport({ spec: edited, outputs: { html }, studioVersion: '0' })).rejects.toThrow(/HTML output is out of date/);
    await expect(buildExport({ spec: sample, outputs: { react: path.join(root, 'missing') }, studioVersion: '0' })).rejects.toThrow(/no React output yet/);
    await writeFile(path.join(react, 'dist', 'index.html'), '');
    const { rm } = await import('node:fs/promises');
    await rm(path.join(react, 'dist'), { recursive: true });
    await expect(buildExport({ spec: sample, outputs: { react }, studioVersion: '0' })).rejects.toThrow(/not been built/);
    await expect(buildExport({ spec: sample, outputs: {}, studioVersion: '0' })).rejects.toBeInstanceOf(ExportError);
  });

  it('refuses blocked licenses and blocked asset rights, and reports unknown rights', async () => {
    const { root, html } = await outputs();
    const gpl = path.join(root, 'react-gpl');
    await fakeReactOutput(gpl, sample, { 'node_modules/copyleft-lib': { version: '1.0.0', license: 'GPL-3.0' } });
    await expect(buildExport({ spec: sample, outputs: { react: gpl }, studioVersion: '0' })).rejects.toThrow(/blocked licenses: copyleft-lib@1.0.0 \(GPL-3.0\)/);

    const withAsset = (rightsStatus: 'blocked' | 'unknown') => ({ ...structuredClone(sample), assets: [{ id: 'photo-01', kind: 'image' as const, path: 'assets/photo.jpg', rightsStatus }] });
    const blocked = withAsset('blocked');
    const out = await outputs(blocked);
    await expect(buildExport({ spec: blocked, outputs: { html: out.html }, studioVersion: '0' })).rejects.toThrow(/blocked rights.*photo-01/);
    const unknown = withAsset('unknown');
    const out2 = await outputs(unknown);
    const result = await buildExport({ spec: unknown, outputs: { html: out2.html }, studioVersion: '0' });
    expect(result.rights).toBe('review_required');
    const files = readZip(result.zip);
    expect(files.get('README.md')!.toString()).toMatch(/1 asset\(s\) have unknown rights/);
    expect(files.get('ASSET_CREDITS.md')!.toString()).toContain('| photo-01 | image | unknown |');
    void html;
  });

  it('produces archives that standard unzip tools accept', async () => {
    let unzip = true;
    try {
      execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    } catch {
      unzip = false;
    }
    if (!unzip) return; // not installed (e.g. Windows runners); the reader above still checks CRCs
    const { root, html, react } = await outputs();
    const file = path.join(root, 'export.zip');
    await writeFile(file, (await buildExport({ spec: sample, outputs: { html, react }, studioVersion: '0' })).zip);
    expect(execFileSync('unzip', ['-tq', file]).toString()).toMatch(/No errors detected/);
  });
});
