import { describe, expect, it } from 'vitest';
import { validateStorySpec } from '@studio/contracts';
import { createStarterSpec, projectIdFor } from '../src/index.ts';

describe('starter spec', () => {
  it('derives safe unique ids from any name', () => {
    expect(projectIdFor('Café Résumé!', () => 'abc123')).toBe('cafe-resume-abc123');
    expect(projectIdFor('../../etc/passwd', () => '000000')).toBe('etc-passwd-000000');
    expect(projectIdFor('日本語', () => 'ffffff')).toBe('project-ffffff');
    expect(projectIdFor('x'.repeat(100), () => '1').length).toBeLessThanOrEqual(42);
    expect(projectIdFor('Same')).not.toBe(projectIdFor('Same'));
  });

  it('creates a valid two-scene spec carrying the user text verbatim', () => {
    const spec = createStarterSpec({ name: '  Orbital Bakery ', goal: 'Launch a <neighbourhood> bakery' });
    expect(validateStorySpec(spec).ok).toBe(true);
    expect(spec.project.name).toBe('Orbital Bakery');
    expect(spec.pages[0]!.scenes[0]!.content).toEqual({ heading: 'Orbital Bakery', body: 'Launch a <neighbourhood> bakery' });
    expect(spec.pages[0]!.scenes[1]!.content.eyebrow).toBe('Starter text');
  });

  it('gives each new project its own generated look instead of one shared starter design', () => {
    const looks = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((k) => JSON.stringify(createStarterSpec({ name: 'Same', goal: 'g', id: `same-${k}00000` }).design)));
    expect(looks.size).toBeGreaterThanOrEqual(4);
  });
});
