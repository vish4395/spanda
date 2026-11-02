import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGACY_DESIGN_STYLE, MIGRATIONS, loadStorySpec, migrateStorySpec, type SpecMigration } from '../src/index.ts';

const example = JSON.parse(readFileSync(fileURLToPath(new URL('../../../schemas/story-spec.example.json', import.meta.url)), 'utf8'));

// The 0.1.0 design block: three colours and two fonts, no design language.
const designV1 = { theme: example.design.theme, colors: { background: '#12100e', foreground: '#f5efe6', accent: '#e0a458' }, typography: example.design.typography };
// A hypothetical pre-release format: `title` instead of `project.name`, no quality block.
const legacy = {
  schemaVersion: '0.0.9',
  project: { id: example.project.id, title: example.project.name, goal: example.project.goal },
  design: designV1,
  pages: example.pages,
  assets: [],
};
const fixtures: SpecMigration[] = [
  {
    from: '0.0.9',
    to: '0.1.0',
    migrate: (spec) => {
      const project = spec.project as { id: string; title: string; goal: string };
      return { ...spec, schemaVersion: '0.1.0', project: { id: project.id, name: project.title, goal: project.goal }, quality: { reducedMotion: true, webglFallback: true } };
    },
  },
  ...MIGRATIONS,
];

describe('StorySpec migrations', () => {
  it('passes current specs through unchanged', () => {
    const result = loadStorySpec(example);
    expect(result.ok).toBe(true);
    expect(result.migrated).toEqual([]);
  });

  it('upgrades older specs and preserves scene ids', () => {
    const result = loadStorySpec(legacy, fixtures);
    expect(result.migrated).toEqual(['0.0.9→0.1.0', '0.1.0→0.2.0']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.project.name).toBe('Heritage Journey');
      expect(result.spec.pages[0]!.scenes.map((s) => s.id)).toEqual(['hero-01', 'chapter-02']);
    }
    expect((legacy.project as { title?: string }).title).toBe('Heritage Journey'); // input not mutated
  });

  it('0.1.0 → 0.2.0 adds the design language that reproduces the 0.1.0 look', () => {
    const v1 = { ...example, schemaVersion: '0.1.0', design: designV1 };
    const result = loadStorySpec(v1);
    expect(result.migrated).toEqual(['0.1.0→0.2.0']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.design.style).toEqual(LEGACY_DESIGN_STYLE);
      expect(result.spec.design.colors.secondary).toBe('#e0a458');
    }
  });

  it('reports unknown versions, cycles and bad steps as issues', () => {
    expect(loadStorySpec({ ...example, schemaVersion: '9.0.0' }).issues[0]?.message).toContain('No migration path from schemaVersion 9.0.0');
    const cyclic: SpecMigration[] = [
      { from: 'a', to: 'b', migrate: (s) => ({ ...s, schemaVersion: 'b' }) },
      { from: 'b', to: 'a', migrate: (s) => ({ ...s, schemaVersion: 'a' }) },
    ];
    expect(migrateStorySpec({ schemaVersion: 'a' }, cyclic)).toMatchObject({ ok: false, error: expect.stringContaining('cycle') });
    const lying: SpecMigration[] = [{ from: 'x', to: '0.1.0', migrate: (s) => ({ ...s, schemaVersion: 'y' }) }];
    expect(migrateStorySpec({ schemaVersion: 'x' }, lying)).toMatchObject({ ok: false });
    expect(migrateStorySpec('nope')).toMatchObject({ ok: false });
  });
});
