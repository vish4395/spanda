import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InvalidSpecError,
  UnsupportedSceneError,
  findUnsupportedScenes,
  validateStorySpec,
  type Scene,
  type SceneType,
  type StorySpec,
} from '@studio/contracts';
import { escapeHtml, writeGeneratedFiles, type GeneratedFiles } from '@studio/core';

export { escapeHtml };

export const HTML_TARGET = 'html-three';
export const SUPPORTED_SCENES: readonly SceneType[] = ['hero', 'chapter', 'scroll-reveal', 'model-showcase', 'gallery', 'cta'];

/** Where static runtime files come from. Bundled hosts (Electron) pass copied locations. */
export interface HtmlResources {
  runtimeDir: string;
  threeDir: string;
}

export function defaultHtmlResources(): HtmlResources {
  const require = createRequire(import.meta.url);
  return {
    runtimeDir: fileURLToPath(new URL('../runtime/', import.meta.url)),
    threeDir: path.dirname(path.dirname(require.resolve('three'))),
  };
}

/** Validate untrusted input and check this target can render every scene. */
export function prepareSpec(input: unknown): StorySpec {
  const result = validateStorySpec(input);
  if (!result.ok) throw new InvalidSpecError(result.issues);
  const issues = findUnsupportedScenes(result.spec, SUPPORTED_SCENES);
  result.spec.pages.forEach((page, pi) =>
    page.scenes.forEach((scene, si) => {
      if (scene.visual.modelAssetId) issues.push({ path: `pages.${pi}.scenes.${si}.visual.modelAssetId`, message: 'Model asset files arrive with asset import (M4); use an object preset for now' });
    }),
  );
  if (result.spec.pages.length !== 1 || result.spec.pages[0]?.path !== '/') {
    issues.push({ path: 'pages', message: 'M0 renders exactly one page at "/"' });
  }
  if (issues.length) throw new UnsupportedSceneError(HTML_TARGET, issues);
  return result.spec;
}

function sceneAttributes(scene: Scene): string {
  const attrs: Record<string, string | undefined> = {
    id: scene.id,
    class: `scene scene--${scene.type}`,
    'aria-labelledby': `${scene.id}-title`,
    'data-background': scene.visual.background,
    'data-layout': scene.visual.layout ?? (scene.type === 'chapter' ? 'split' : undefined),
    'data-mobile': scene.responsive.mobile,
  };
  return Object.entries(attrs)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(' ');
}

function sceneCopy(scene: Scene, headingLevel: 1 | 2): string {
  const c = scene.content;
  const reveal = scene.motion.type === 'none' ? '' : ' data-reveal';
  const tag = `h${headingLevel}`;
  return [
    `<div class="scene__copy"${reveal}>`,
    c.eyebrow ? `  <p class="eyebrow">${escapeHtml(c.eyebrow)}</p>` : '',
    `  <${tag} id="${escapeHtml(scene.id)}-title">${escapeHtml(c.heading)}</${tag}>`,
    c.body ? `  <p class="scene__body">${escapeHtml(c.body)}</p>` : '',
    c.cta ? `  <a class="cta" href="${escapeHtml(c.cta.href)}"${c.cta.href.startsWith('https:') ? ' rel="noopener noreferrer"' : ''}>${escapeHtml(c.cta.label)}</a>` : '',
    `  <p class="scene__fallback">${escapeHtml(scene.accessibility.fallbackText)}</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderScene(scene: Scene, index: number): string {
  const heading = index === 0 ? 1 : 2;
  const label = `data-scene-label="${escapeHtml(scene.accessibility.label)}"`;
  switch (scene.type) {
    case 'hero':
      return `<section ${sceneAttributes(scene)} ${label}>
<canvas class="scene__canvas" data-scene3d="hero" aria-hidden="true"></canvas>
<div class="scene__inner">
${sceneCopy(scene, heading)}
</div>
</section>`;
    case 'chapter':
      return `<section ${sceneAttributes(scene)} ${label}>
<div class="scene__inner">
${sceneCopy(scene, heading)}
<div class="chapter-visual" role="img" aria-label="${escapeHtml(scene.accessibility.fallbackText)}"${scene.motion.type === 'none' ? '' : ' data-reveal'}></div>
</div>
</section>`;
    case 'scroll-reveal': {
      const reveal = scene.motion.type === 'none' ? '' : ' data-reveal';
      const steps = (scene.content.items ?? [])
        .map((item, i) => `<li class="reveal-step reveal-step--${i}"${reveal}><span class="reveal-step__index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></li>`)
        .join('\n');
      return `<section ${sceneAttributes(scene)} ${label}>
<div class="scene__inner">
${sceneCopy(scene, heading)}
<ol class="reveal-steps">
${steps}
</ol>
</div>
</section>`;
    }
    case 'model-showcase':
      return `<section ${sceneAttributes(scene)} ${label}>
<div class="scene__inner">
${sceneCopy(scene, heading)}
<div class="showcase-stage" data-object="${escapeHtml(scene.visual.object ?? 'orb')}">
<canvas class="scene__canvas" data-scene3d="showcase" data-object="${escapeHtml(scene.visual.object ?? 'orb')}" data-camera="${escapeHtml(scene.visual.camera ?? 'orbit')}" aria-hidden="true"></canvas>
</div>
</div>
</section>`;
    case 'gallery': {
      const items = (scene.content.items ?? [])
        .map((item, i) => `<li class="gallery__item"><article><div class="gallery__art gallery__art--${i}" aria-hidden="true"></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article></li>`)
        .join('\n');
      return `<section ${sceneAttributes(scene)} ${label}>
<div class="scene__inner">
${sceneCopy(scene, heading)}
<div class="gallery" data-gallery>
<ul class="gallery__track" tabindex="0" aria-label="${escapeHtml(scene.content.heading)} — scroll horizontally or use the buttons">
${items}
</ul>
<div class="gallery__controls">
<button type="button" class="gallery__button" data-gallery-prev aria-label="Previous items">‹</button>
<button type="button" class="gallery__button" data-gallery-next aria-label="Next items">›</button>
</div>
</div>
</div>
</section>`;
    }
    case 'cta':
      return `<section ${sceneAttributes(scene)} ${label}>
<div class="scene__inner">
${sceneCopy(scene, heading)}
</div>
</section>`;
    default:
      // prepareSpec rejects these; keep the switch exhaustive for future primitives.
      throw new UnsupportedSceneError(HTML_TARGET, [{ path: scene.id, message: `Unsupported scene type ${scene.type}` }]);
  }
}

export function renderTokensCss(spec: StorySpec): string {
  const { colors, typography } = spec.design;
  return `:root {
  --color-bg: ${colors.background};
  --color-fg: ${colors.foreground};
  --color-accent: ${colors.accent};
  --color-fg-muted: color-mix(in srgb, var(--color-fg) 80%, var(--color-bg));
  --font-heading: ${typography.heading};
  --font-body: ${typography.body};
}
`;
}

export function renderIndexHtml(spec: StorySpec): string {
  const page = spec.pages[0]!;
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return `<!doctype html>
<html lang="en" data-webgl="off">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="description" content="${escapeHtml(spec.project.goal)}">
<meta name="generator" content="AI Cinematic Studio (${HTML_TARGET})">
<title>${escapeHtml(spec.project.name)}</title>
<link rel="stylesheet" href="./tokens.css">
<link rel="stylesheet" href="./styles.css">
<script type="module" src="./js/main.js"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><span class="brand">${escapeHtml(spec.project.name)}</span></header>
<main id="main">
${page.scenes.map(renderScene).join('\n')}
</main>
<footer class="site-footer"><p>${escapeHtml(spec.project.name)}</p></footer>
</body>
</html>
`;
}

export function renderReadme(spec: StorySpec): string {
  return `# ${spec.project.name} — static HTML export

Generated by AI Cinematic Studio (\`${HTML_TARGET}\` target) from \`story-spec.json\`.
No build step and no backend: plain HTML, CSS and ES modules. Three.js is vendored in \`vendor/three/\` (no CDN).

## Run locally
ES modules do not load from \`file://\`, so serve the folder with any static server, for example:

\`\`\`sh
npx --yes serve@14 .        # or: python3 -m http.server 8080
\`\`\`

## Host
Upload the folder to any static host. All paths are relative.

## Accessibility and fallbacks
- All content is real HTML; the 3D layer is decorative (\`aria-hidden\`).
- Without WebGL or JavaScript, the static gradient art and a text description are shown.
- \`prefers-reduced-motion\` disables reveal animations and renders the 3D scene as a still frame.

## Licenses
See \`THIRD_PARTY_NOTICES.md\`. Generated code and procedural visuals contain no third-party assets.
`;
}

export async function renderHtmlSite(input: unknown, resources: HtmlResources = defaultHtmlResources()): Promise<GeneratedFiles> {
  const spec = prepareSpec(input);
  const { runtimeDir, threeDir } = resources;
  const files: GeneratedFiles = new Map();
  files.set('index.html', renderIndexHtml(spec));
  files.set('tokens.css', renderTokensCss(spec));
  files.set('styles.css', await readFile(path.join(runtimeDir, 'styles.css'), 'utf8'));
  files.set('js/main.js', await readFile(path.join(runtimeDir, 'js/main.js'), 'utf8'));
  files.set('js/scene3d.js', await readFile(path.join(runtimeDir, 'js/scene3d.js'), 'utf8'));
  files.set('vendor/three/three.module.js', await readFile(path.join(threeDir, 'build/three.module.js')));
  files.set('vendor/three/three.core.js', await readFile(path.join(threeDir, 'build/three.core.js')));
  const threeLicense = await readFile(path.join(threeDir, 'LICENSE'), 'utf8');
  const threeManifest = JSON.parse(await readFile(path.join(threeDir, 'package.json'), 'utf8')) as { version: string; license: string };
  const threeVersion = threeManifest.version;
  files.set('vendor/three/LICENSE', threeLicense);
  // Machine-readable record of the vendored package, for license checks and the export SBOM.
  files.set('vendor/three/package.json', `${JSON.stringify({ name: 'three', version: threeVersion, license: threeManifest.license }, null, 2)}\n`);
  files.set(
    'THIRD_PARTY_NOTICES.md',
    `# Third-party notices\n\n## three ${threeVersion} (MIT)\nhttps://github.com/mrdoob/three.js — files in \`vendor/three/\`.\n\n\`\`\`\n${threeLicense.trim()}\n\`\`\`\n`,
  );
  files.set('README.md', renderReadme(spec));
  files.set('story-spec.json', `${JSON.stringify(spec, null, 2)}\n`);
  return files;
}

export async function generateHtmlSite(input: unknown, outDir: string, resources?: HtmlResources): Promise<string[]> {
  return writeGeneratedFiles(await renderHtmlSite(input, resources), outDir);
}
