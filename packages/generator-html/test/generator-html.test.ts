import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InvalidSpecError, UnsupportedSceneError, type StorySpec } from '@studio/contracts';
import { escapeHtml, generateHtmlSite, renderHtmlSite, renderIndexHtml, prepareSpec } from '../src/index.ts';

const example = JSON.parse(
  await readFile(fileURLToPath(new URL('../../../schemas/story-spec.example.json', import.meta.url)), 'utf8'),
) as StorySpec;
const clone = (): StorySpec => structuredClone(example);

describe('html-three generator', () => {
  it('renders semantic HTML with one h1, scene ids and fallbacks', () => {
    const html = renderIndexHtml(prepareSpec(example));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('<h1 id="hero-01-title">A Place With a Story</h1>');
    expect(html).toContain('<h2 id="chapter-02-title">Explore the Journey</h2>');
    expect(html).toContain('id="main"');
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('A heritage introduction with scenic imagery.');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-webgl="off"');
    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toMatch(/https?:\/\/(?!github)/); // no CDN or remote references
  });

  it('escapes all spec text (no markup injection)', () => {
    const spec = clone();
    spec.project.name = '<img src=x onerror=alert(1)>';
    spec.pages[0]!.scenes[0]!.content.heading = '"><script>alert(1)</script>';
    spec.pages[0]!.scenes[0]!.content.cta = { label: "Go'", href: 'https://example.com/?a=1&b=2' };
    const html = renderIndexHtml(prepareSpec(spec));
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2" rel="noopener noreferrer"');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('fails loudly on unsupported primitives and invalid specs', () => {
    const spec = clone();
    spec.pages.push({ id: 'second', path: '/second', scenes: [spec.pages[0]!.scenes[0]!] });
    spec.pages[1]!.scenes = [{ ...spec.pages[0]!.scenes[0]!, id: 'hero-99' }];
    expect(() => prepareSpec(spec)).toThrow(UnsupportedSceneError);
    expect(() => prepareSpec({ nope: true })).toThrow(InvalidSpecError);
  });

  it('writes a self-contained export with vendored three.js and notices', async () => {
    const out = path.join(await mkdtemp(path.join(tmpdir(), 'studio-html-')), 'html');
    const files = await generateHtmlSite(example, out);
    expect(files).toEqual(
      expect.arrayContaining(['index.html', 'tokens.css', 'styles.css', 'js/main.js', 'js/scene3d.js', 'vendor/three/three.module.js', 'vendor/three/three.core.js', 'vendor/three/LICENSE', 'vendor/three/package.json', 'THIRD_PARTY_NOTICES.md', 'README.md', 'story-spec.json']),
    );
    const notices = await readFile(path.join(out, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    expect(notices).toContain('MIT');
    expect(await readFile(path.join(out, 'tokens.css'), 'utf8')).toContain('--color-accent: #d9a76c;');
    // regeneration replaces the folder atomically, leaving no staging dirs
    await generateHtmlSite(example, out);
    expect((await readdir(path.dirname(out))).filter((n) => n.includes('staging'))).toEqual([]);
  });

  it('is deterministic for the same spec', async () => {
    const a = await renderHtmlSite(example);
    const b = await renderHtmlSite(example);
    expect(a.get('index.html')).toBe(b.get('index.html'));
  });
});

describe('M3 primitives (html-three)', () => {
  it('renders every primitive with semantic markup and escaped item text', async () => {
    const bench = JSON.parse(await readFile(fileURLToPath(new URL('../../../fixtures/benchmarks/all-primitives.json', import.meta.url)), 'utf8')) as StorySpec;
    bench.pages[0]!.scenes[4]!.content.items![0]!.title = '<img src=x onerror=alert(1)>';
    const html = renderIndexHtml(prepareSpec(bench));
    for (const id of ['hero-01', 'reveal-02', 'showcase-03', 'chapter-04', 'gallery-05', 'cta-06']) expect(html).toContain(`id="${id}"`);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('<ol class="reveal-steps">');
    expect(html).toContain('data-scene3d="showcase" data-object="vessel" data-camera="orbit"');
    const gallery = bench.pages[0]!.scenes[4]!;
    gallery.visual.variant = 'carousel';
    const carousel = renderIndexHtml(prepareSpec(bench));
    expect(carousel).toContain('class="gallery__track" tabindex="0"');
    expect(carousel).toContain('aria-label="Next items"');
    gallery.visual.variant = 'grid';
    const grid = renderIndexHtml(prepareSpec(bench));
    expect(grid).toContain('data-variant="grid"');
    expect(grid).not.toContain('aria-label="Next items"'); // no carousel controls on a grid
    expect(html).toContain('href="#hero-01"');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toMatch(/ style="/); // strict CSP: no inline style attributes
    expect(html).toContain("style-src 'self';");
  });
});
