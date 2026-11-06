// SPDX-License-Identifier: MIT-0
// Subset of the StorySpec contract this site renders (validated by the studio before export).
export interface SceneItem {
  title: string;
  text: string;
}

export interface SceneContent {
  eyebrow?: string;
  heading: string;
  body?: string;
  cta?: { label: string; href: string };
  items?: SceneItem[];
}

export interface Scene {
  id: string;
  type: 'hero' | 'chapter' | 'scroll-reveal' | 'model-showcase' | 'gallery' | 'cta';
  content: SceneContent;
  visual: {
    background?: 'gradient' | 'solid' | 'procedural-3d';
    layout?: 'split' | 'split-reverse' | 'centered' | 'full-bleed' | 'editorial' | 'asymmetric' | 'stacked';
    variant?: string;
    modelAssetId?: string | null;
    object?: 'monolith' | 'vessel' | 'orb' | 'crystal' | 'lantern' | 'bottle' | 'cup' | 'knot' | 'arch';
    camera?: 'orbit' | 'front' | 'low';
  };
  motion: { type: 'none' | 'subtle-reveal' | 'scroll-reveal' };
  responsive: { desktop?: string; tablet?: string; mobile?: string };
  accessibility: { label: string; fallbackText: string };
}

export interface StorySpec {
  project: { id: string; name: string; goal: string };
  design: { style: { heroArt: 'faceted' | 'rings' | 'particles' | 'ribbons' | 'terrain' | 'none' } };
  pages: { id: string; path: string; scenes: Scene[] }[];
}

/** Default composition per scene type (the first variant the StorySpec allows). */
const DEFAULT_VARIANT: Partial<Record<Scene['type'], string>> = {
  hero: 'bottom-left',
  'scroll-reveal': 'cards',
  'model-showcase': 'split',
  gallery: 'carousel',
  cta: 'card',
};

export function variantOf(scene: Scene): string | undefined {
  return scene.visual.variant ?? DEFAULT_VARIANT[scene.type];
}
