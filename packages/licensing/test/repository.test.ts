import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// T035/T036: the repository carries its license and policy files, and no studio package is unlicensed.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (p: string) => readFileSync(`${root}${p}`, 'utf8');

describe('repository licensing', () => {
  it('ships the Apache-2.0 license, NOTICE and policy files', () => {
    expect(read('LICENSE')).toMatch(/Apache License\s+Version 2\.0, January 2004/);
    expect(read('NOTICE')).toMatch(/Copyright 2026 Vishal Sharma \(NewAi\.in\) and contributors/);
    for (const file of ['CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'TRADEMARKS.md']) expect(read(file).length, file).toBeGreaterThan(200);
    expect(read('CONTRIBUTING.md')).toMatch(/Signed-off-by/);
  });

  it('every studio package declares Apache-2.0 (generators also MIT-0 for exported code)', () => {
    const manifests = ['package.json', ...['apps', 'packages'].flatMap((dir) => readdirSync(`${root}${dir}`).map((name) => `${dir}/${name}/package.json`))];
    for (const manifest of manifests) {
      const { license } = JSON.parse(read(manifest)) as { license?: string };
      const generator = /packages\/generator-(html|react)\//.test(manifest);
      expect(license, manifest).toBe(generator ? 'Apache-2.0 AND MIT-0' : 'Apache-2.0');
      if (generator) expect(read(manifest.replace('package.json', 'LICENSE-MIT-0'))).toMatch(/MIT No Attribution/);
    }
  });
});
