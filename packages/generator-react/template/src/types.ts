// Subset of the StorySpec contract this site renders (validated by the studio before export).
export interface SceneContent {
  eyebrow?: string;
  heading: string;
  body?: string;
  cta?: { label: string; href: string };
}

export interface Scene {
  id: string;
  type: 'hero' | 'chapter';
  content: SceneContent;
  visual: { background?: 'gradient' | 'solid' | 'procedural-3d'; layout?: 'split' | 'centered'; modelAssetId?: string | null };
  motion: { type: 'none' | 'subtle-reveal' | 'scroll-reveal' };
  responsive: { desktop?: string; tablet?: string; mobile?: string };
  accessibility: { label: string; fallbackText: string };
}

export interface StorySpec {
  project: { id: string; name: string; goal: string };
  pages: { id: string; path: string; scenes: Scene[] }[];
}
