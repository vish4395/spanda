import type { StorySpec } from '@studio/contracts';
import { escapeHtml } from './html.ts';

/** Title, description, social cards and structured data, all from the StorySpec. */
export function renderSeoHead(spec: StorySpec): string {
  const scenes = spec.pages[0]!.scenes;
  const hero = scenes.find((s) => s.type === 'hero');
  const title = hero && hero.content.heading !== spec.project.name ? `${spec.project.name} — ${hero.content.heading}` : spec.project.name;
  const description = (hero?.content.body || spec.project.goal).replace(/\s+/g, ' ').trim().slice(0, 160);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: spec.project.name,
    headline: hero?.content.heading ?? spec.project.name,
    description,
    hasPart: scenes.filter((s) => s.type !== 'hero').map((s) => ({ '@type': 'WebPageElement', name: s.content.heading })),
  };
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    '<meta name="robots" content="index, follow">',
    `<meta name="theme-color" content="${escapeHtml(spec.design.colors.background)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    // A data block, not executable script (CSP allows it); `<` is escaped so text cannot close the tag.
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

