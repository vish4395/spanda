import { randomBytes } from 'node:crypto';
import { STORY_SPEC_VERSION, validateStorySpec, type StorySpec } from '@studio/contracts';

/** URL-safe, lowercase project ID with a random suffix so names never collide. */
export function projectIdFor(name: string, random: () => string = () => randomBytes(3).toString('hex')): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return `${slug || 'project'}-${random()}`;
}

/**
 * Deterministic starter StorySpec for a new project (no AI involved).
 * Copy beyond the user's own name and idea is labelled as starter text so it
 * is never mistaken for generated content.
 */
export function createStarterSpec(input: { name: string; goal: string; id?: string }): StorySpec {
  const name = input.name.trim();
  const goal = input.goal.trim();
  const spec: StorySpec = {
    schemaVersion: STORY_SPEC_VERSION,
    project: { id: input.id ?? projectIdFor(name), name, goal },
    design: {
      theme: 'studio starter',
      colors: { background: '#0f1115', foreground: '#f3f1ec', accent: '#a998ff' },
      typography: { heading: 'system-ui', body: 'system-ui' },
    },
    pages: [
      {
        id: 'home',
        path: '/',
        scenes: [
          {
            id: 'hero-01',
            type: 'hero',
            content: { heading: name, body: goal },
            visual: { background: 'gradient', modelAssetId: null },
            motion: { type: 'subtle-reveal' },
            responsive: { mobile: 'static-hero' },
            accessibility: { label: 'Introduction', fallbackText: `Decorative 3D artwork introducing ${name}.` },
          },
          {
            id: 'chapter-02',
            type: 'chapter',
            content: { eyebrow: 'Starter text', heading: 'Chapter one', body: 'Replace this starter text with the first chapter of your story.' },
            visual: { layout: 'split' },
            motion: { type: 'scroll-reveal' },
            responsive: { mobile: 'stacked' },
            accessibility: { label: 'Chapter one', fallbackText: 'Abstract decorative artwork for the first chapter.' },
          },
        ],
      },
    ],
    assets: [],
    quality: { reducedMotion: true, webglFallback: true, targetBrowsers: ['chromium', 'firefox', 'webkit'] },
  };
  const result = validateStorySpec(spec);
  if (!result.ok) throw new Error(`Starter spec invalid: ${result.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  return result.spec;
}
