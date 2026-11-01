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
    spec.pages[0]!.scenes[1]!.type = 'gallery';
    expect(() => prepareSpec(spec)).toThrow(UnsupportedSceneError);
    expect(() => prepareSpec({ nope: true })).toThrow(InvalidSpecError);
  });

  it('writes a self-contained export with vendored three.js and notices', async () => {
    const out = path.join(await mkdtemp(path.join(tmpdir(), 'studio-html-')), 'html');
    const files = await generateHtmlSite(example, out);
    expect(files).toEqual(
      expect.arrayContaining(['index.html', 'tokens.css', 'styles.css', 'js/main.js', 'js/hero-scene.js', 'vendor/three/three.module.js', 'vendor/three/three.core.js', 'vendor/three/LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'story-spec.json']),
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
