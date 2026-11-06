import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { cinemaPlan, isPinned, shotOf, validateStorySpec, type StorySpec } from '../src/index.ts';

const load = async (file: string) => {
  const result = validateStorySpec(JSON.parse(await readFile(new URL(`../../../${file}`, import.meta.url), 'utf8')));
  if (!result.ok) throw new Error('fixture invalid');
  return result.spec as StorySpec;
};

describe('cinema plan', () => {
  it('films every scene and closes on the opening shot', async () => {
    const spec = await load('fixtures/benchmarks/all-primitives.json');
    expect(cinemaPlan(spec)).toEqual({
      protagonist: 'vessel',
      scenes: {
        'hero-01': { shot: 'hero', pin: false },
        'reveal-02': { shot: 'dolly', pin: false },
        'showcase-03': { shot: 'showcase-split', pin: true },
        'chapter-04': { shot: 'right', pin: false },
        'gallery-05': { shot: 'gallery', pin: false },
        'cta-06': { shot: 'finale', pin: false },
      },
    });
  });

  it('puts the object on the side the copy leaves free, and matches a centred hero at the end', async () => {
    const spec = await load('fixtures/benchmarks/all-primitives.json');
    const scenes = spec.pages[0]!.scenes;
    const chapter = scenes.find((s) => s.type === 'chapter')!;
    const as = (layout: string) => shotOf({ ...chapter, visual: { ...chapter.visual, layout } } as typeof chapter, 3, scenes);
    expect([as('split'), as('split-reverse'), as('asymmetric'), as('full-bleed'), as('editorial')]).toEqual(['right', 'left', 'left', 'full', 'right']);
    const centred = [{ ...scenes[0]!, visual: { ...scenes[0]!.visual, variant: 'centered' } }, ...scenes.slice(1)] as typeof scenes;
    expect(shotOf(centred[0]!, 0, centred)).toBe('hero-center');
    expect(shotOf(centred.at(-1)!, centred.length - 1, centred)).toBe('finale-center');
    expect(isPinned({ ...chapter, visual: { ...chapter.visual, layout: 'full-bleed' } } as typeof chapter)).toBe(true);
    expect(isPinned({ ...chapter, motion: { type: 'none' }, visual: { ...chapter.visual, layout: 'full-bleed' } } as typeof chapter)).toBe(false);
  });
});
