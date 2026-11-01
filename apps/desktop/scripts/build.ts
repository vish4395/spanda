// Build the desktop app into dist/: main (ESM), preload (CJS, sandboxed), renderer (Vite), resources.
import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = path.resolve(appDir, '../..');
const dist = path.join(appDir, 'dist');

await rm(dist, { recursive: true, force: true });

await esbuild({
  entryPoints: [path.join(appDir, 'src/main/index.ts')],
  outfile: path.join(dist, 'main.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['electron'],
  sourcemap: 'linked',
  // Some CJS dependencies call require() for Node built-ins.
  banner: { js: "import { createRequire as __studioCreateRequire } from 'node:module'; const require = __studioCreateRequire(import.meta.url);" },
  logLevel: 'warning',
});

await esbuild({
  entryPoints: [path.join(appDir, 'src/preload/index.ts')],
  outfile: path.join(dist, 'preload.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'chrome140',
  external: ['electron'],
  logLevel: 'warning',
});

await viteBuild({
  root: path.join(appDir, 'src/renderer'),
  base: './',
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  build: { outDir: path.join(dist, 'renderer'), emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 800 },
});

// Generator resources (read at runtime by the main process).
const resources = path.join(dist, 'resources');
await mkdir(resources, { recursive: true });
await cp(path.join(repoRoot, 'packages/generator-html/runtime'), path.join(resources, 'html-runtime'), { recursive: true });
await cp(path.join(repoRoot, 'packages/generator-react/template'), path.join(resources, 'react-template'), {
  recursive: true,
  filter: (src) => !/[\\/](node_modules|dist)([\\/]|$)/.test(src),
});
const threeDir = path.dirname(path.dirname(createRequire(path.join(repoRoot, 'packages/generator-html/package.json')).resolve('three')));
for (const file of ['LICENSE', 'package.json', 'build/three.module.js', 'build/three.core.js']) {
  await cp(path.join(threeDir, file), path.join(resources, 'three', file));
}
await cp(path.join(repoRoot, 'skills'), path.join(resources, 'skills'), { recursive: true });
await cp(path.join(repoRoot, 'schemas/story-spec.example.json'), path.join(resources, 'story-spec.example.json'));

console.log(`Built desktop app -> ${path.relative(repoRoot, dist)}`);
