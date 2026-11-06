import { SCENE_VARIANTS, type Scene, type StorySpec } from './story-spec.ts';

// How a story is filmed on the persistent 3D stage. Shared by both generators so the
// HTML and React exports frame every scene the same way.

/** The scene's composition variant, defaulting to the first one its type allows. */
export function sceneVariant(scene: Scene): string | undefined {
  const variants: readonly string[] = SCENE_VARIANTS[scene.type];
  return scene.visual.variant ?? variants[0];
}

/** The story's protagonist: the hero's object, else the first showcase object (the stage picks a default otherwise). */
export function protagonistOf(spec: StorySpec): string | undefined {
  const scenes = spec.pages[0]?.scenes ?? [];
  return scenes.find((s) => s.type === 'hero')?.visual.object ?? scenes.find((s) => s.type === 'model-showcase')?.visual.object;
}

const centeredHero = (s: Scene | undefined) => s?.type === 'hero' && ['centered', 'monumental', 'top-left'].includes(sceneVariant(s) ?? '');

/**
 * The camera shot for a scene. The object takes the side the copy leaves free; a
 * closing call to action repeats the opening hero shot, so the story ends where it began.
 */
export function shotOf(scene: Scene, index: number, scenes: readonly Scene[]): string {
  switch (scene.type) {
    case 'hero':
      return centeredHero(scene) ? 'hero-center' : 'hero';
    case 'chapter': {
      const layout = scene.visual.layout ?? 'split';
      if (layout === 'split-reverse' || layout === 'asymmetric') return 'left';
      if (layout === 'centered' || layout === 'full-bleed') return 'full';
      return 'right';
    }
    case 'scroll-reveal':
      return 'dolly';
    case 'model-showcase':
      return sceneVariant(scene) === 'split' ? 'showcase-split' : 'showcase';
    case 'gallery':
      return 'gallery';
    case 'cta':
      return index === scenes.length - 1 ? (centeredHero(scenes[0]) ? 'finale-center' : 'finale') : 'full';
    default:
      return 'full';
  }
}

/** Pinned scenes hold on screen while the camera keeps moving. */
export function isPinned(scene: Scene): boolean {
  return scene.motion.type !== 'none' && (scene.type === 'model-showcase' || (scene.type === 'chapter' && scene.visual.layout === 'full-bleed'));
}

/** Per-scene stage directions, for exports that cannot import this module (React template). */
export function cinemaPlan(spec: StorySpec): { protagonist: string | null; scenes: Record<string, { shot: string; pin: boolean }> } {
  const scenes = spec.pages[0]?.scenes ?? [];
  return {
    protagonist: protagonistOf(spec) ?? null,
    scenes: Object.fromEntries(scenes.map((s, i) => [s.id, { shot: shotOf(s, i, scenes), pin: isPinned(s) }])),
  };
}
