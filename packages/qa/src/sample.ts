import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHtmlSite } from '@studio/generator-html';
import { generateReactProject } from '@studio/generator-react';
import { buildReactExport } from '@studio/preview';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const artifactsDir = path.join(repoRoot, 'artifacts');
export const sampleDir = path.join(artifactsDir, 'sample');

export interface SampleManifest {
  htmlRoot: string;
  reactRoot: string;
  generatedAt: string;
}

export const SAMPLES = {
  heritage: 'schemas/story-spec.example.json',
  primitives: 'fixtures/benchmarks/all-primitives.json',
} as const;

/** Generate both targets from a sample spec and build the React one. */
export async function generateSample(log: (line: string) => void = console.log, sample: keyof typeof SAMPLES = 'heritage'): Promise<SampleManifest> {
  const spec = JSON.parse(await readFile(path.join(repoRoot, SAMPLES[sample]), 'utf8')) as unknown;
  const base = sample === 'heritage' ? sampleDir : path.join(artifactsDir, `sample-${sample}`);
  const htmlRoot = path.join(base, 'html');
  const reactProject = path.join(base, 'react');
  log(`html-three: ${(await generateHtmlSite(spec, htmlRoot)).length} files -> ${htmlRoot}`);
  log(`react-r3f: ${(await generateReactProject(spec, reactProject)).length} files -> ${reactProject}`);
  const reactRoot = await buildReactExport(reactProject, { signal: new AbortController().signal, log: (l) => log(`  ${l}`) });
  const manifest = { htmlRoot, reactRoot, generatedAt: new Date().toISOString() };
  await writeFile(path.join(base, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
