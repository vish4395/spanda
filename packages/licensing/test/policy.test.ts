import { describe, expect, it } from 'vitest';
import { evaluateLicense, evaluatePackages, packagesFromLockfile } from '../src/index.ts';

describe('license policy', () => {
  it.each([
    ['MIT', 'allowed'],
    ['Apache-2.0', 'allowed'],
    ['(MIT OR GPL-3.0)', 'allowed'],
    ['MIT AND GPL-3.0', 'blocked'],
    ['MPL-2.0', 'review_required'],
    ['LGPL-3.0-or-later', 'review_required'],
    ['GPL-3.0', 'blocked'],
    ['AGPL-3.0', 'blocked'],
    ['SSPL-1.0', 'blocked'],
    ['CC-BY-NC-4.0', 'blocked'],
    ['SEE LICENSE IN LICENSE.txt', 'blocked'],
    ['', 'blocked'],
    [undefined, 'blocked'],
  ] as const)('%s -> %s', (license, verdict) => {
    expect(evaluateLicense(license)).toBe(verdict);
  });

  it('derives commercial status from the worst finding', () => {
    expect(evaluatePackages([{ name: 'a', version: '1.0.0', license: 'MIT', scope: 'runtime' }]).status).toBe('passed');
    expect(evaluatePackages([{ name: 'a', version: '1.0.0', license: 'MPL-2.0', scope: 'build' }]).status).toBe('review_required');
    expect(evaluatePackages([{ name: 'a', version: '1.0.0', license: null, scope: 'runtime' }]).status).toBe('blocked');
  });

  it('reads npm lockfiles with runtime/build scope', () => {
    const pkgs = packagesFromLockfile({
      packages: {
        '': {},
        'node_modules/react': { version: '19.3.1', license: 'MIT' },
        'node_modules/vite': { version: '7.3.7', license: 'MIT', dev: true },
        'node_modules/a/node_modules/@scope/b': { version: '1.0.0', license: 'ISC' },
      },
    });
    expect(pkgs).toEqual([
      { name: 'react', version: '19.3.1', license: 'MIT', scope: 'runtime' },
      { name: 'vite', version: '7.3.7', license: 'MIT', scope: 'build' },
      { name: '@scope/b', version: '1.0.0', license: 'ISC', scope: 'runtime' },
    ]);
  });
});
