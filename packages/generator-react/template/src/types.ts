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
    layout?: 'split' | 'centered';
    modelAssetId?: string | null;
    object?: 'monolith' | 'vessel' | 'orb';
    camera?: 'orbit' | 'front' | 'low';
  };
  motion: { type: 'none' | 'subtle-reveal' | 'scroll-reveal' };
  responsive: { desktop?: string; tablet?: string; mobile?: string };
  accessibility: { label: string; fallbackText: string };
}

export interface StorySpec {
  project: { id: string; name: string; goal: string };
  pages: { id: string; path: string; scenes: Scene[] }[];
}
