// Structured, conservative observations from page HTML. The page is untrusted:
// we only count and quote short snippets as data — nothing is executed, and
// extracted text is never treated as instructions.

export interface ReferenceObservation {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'html' | 'css' | 'screenshot';
}

export interface PageFacts {
  title: string | null;
  description: string | null;
  language: string | null;
  headings: string[];
  sectionCount: number;
  imageCount: number;
  hasVideo: boolean;
  hasCanvasOrWebGL: boolean;
  colors: { hex: string; count: number }[];
  fonts: string[];
  observations: ReferenceObservation[];
}

const decode = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)));

const clean = (text: string, max = 160) => decode(text.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, max);

/** Analysis input cap; together with the linear scanners below this bounds work on hostile pages. */
export const MAX_EXTRACT_CHARS = 512_000;

/** Linear scan for `<tag ...>content</tag>` blocks (no backtracking regex on the full page). */
function blocks(html: string, lower: string, tag: string, limit = Infinity): { start: number; end: number; inner: string }[] {
  const out: { start: number; end: number; inner: string }[] = [];
  const open = `<${tag}`;
  const close = `</${tag}`;
  let pos = 0;
  let nextClose = -2;
  while (out.length < limit) {
    const start = lower.indexOf(open, pos);
    if (start === -1) break;
    const after = lower.charCodeAt(start + open.length);
    // Require a tag boundary: `<h1` must not match `<h1x`, `<style` must not match `<styled`.
    if (!(after === 62 || after === 32 || after === 9 || after === 10 || after === 13 || after === 47)) {
      pos = start + open.length;
      continue;
    }
    const gt = lower.indexOf('>', start);
    if (gt === -1) break;
    if (nextClose !== -1 && nextClose < gt) nextClose = lower.indexOf(close, gt); // monotonic → amortised linear
    if (nextClose === -1) {
      out.push({ start, end: html.length, inner: html.slice(gt + 1) });
      break;
    }
    const endGt = lower.indexOf('>', nextClose);
    const end = endGt === -1 ? html.length : endGt + 1;
    out.push({ start, end, inner: html.slice(gt + 1, nextClose) });
    pos = end;
  }
  return out;
}

function stripBlocks(html: string, tag: string): string {
  const lower = html.toLowerCase();
  let result = '';
  let cursor = 0;
  for (const b of blocks(html, lower, tag)) {
    result += `${html.slice(cursor, b.start)} `;
    cursor = b.end;
  }
  return result + html.slice(cursor);
}

function meta(html: string, lower: string, name: string): string | null {
  let pos = 0;
  for (let i = 0; i < 200; i += 1) {
    const start = lower.indexOf('<meta', pos);
    if (start === -1) return null;
    const tag = html.slice(start, Math.min(html.length, start + 2000, (lower.indexOf('>', start) + 1) || html.length));
    pos = start + 5;
    if (new RegExp(`(?:name|property)=["']${name}["']`, 'i').test(tag)) {
      const content = /content=["']([^"']{0,1000})["']/i.exec(tag)?.[1];
      return content ? clean(content, 300) : null;
    }
  }
  return null;
}

function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h.slice(0, 7);
}

export function extractFacts(input: string): PageFacts {
  const html = input.slice(0, MAX_EXTRACT_CHARS);
  const withoutScripts = stripBlocks(stripBlocks(html, 'script'), 'noscript');
  const lower = withoutScripts.toLowerCase();
  const titleBlock = blocks(withoutScripts, lower, 'title', 1)[0];
  const title = titleBlock ? clean(titleBlock.inner.slice(0, 2000), 200) || null : null;
  const description = meta(withoutScripts, lower, 'description') ?? meta(withoutScripts, lower, 'og:description');
  const language = /<html[^>]{0,500}\blang=["']([a-zA-Z-]{2,15})["']/i.exec(withoutScripts.slice(0, 5000))?.[1] ?? null;
  const headings = (['h1', 'h2', 'h3'] as const)
    .flatMap((tag) => blocks(withoutScripts, lower, tag, 12))
    .sort((a, b) => a.start - b.start)
    .map((b) => clean(b.inner.slice(0, 2000), 120))
    .filter(Boolean)
    .slice(0, 12);
  const sectionCount = (lower.match(/<section\b/g) ?? []).length;
  const imageCount = (lower.match(/<img\b/g) ?? []).length;
  const hasVideo = lower.includes('<video');
  const hasCanvasOrWebGL = lower.includes('<canvas') || /three(\.module)?(\.min)?\.js|webgl/i.test(html);

  const htmlLower = html.toLowerCase();
  const css = blocks(html, htmlLower, 'style').map((b) => b.inner).join('\n') + [...html.matchAll(/style=["']([^"']{0,2000})["']/gi)].map((m) => m[1]).join(';');
  const colorCounts = new Map<string, number>();
  for (const m of css.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    const hex = normalizeHex(m[0]);
    colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1);
  }
  const colors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex, count]) => ({ hex, count }));
  const fonts = [...new Set([...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((m) => clean(m[1]!.split(',')[0]!.replace(/['"]/g, ''), 40)).filter(Boolean))].slice(0, 6);

  const observations: ReferenceObservation[] = [];
  if (title) observations.push({ text: `Page title: “${title}”`, confidence: 'high', source: 'html' });
  if (headings.length) observations.push({ text: `${headings.length} top-level headings; first: “${headings[0]}”`, confidence: 'high', source: 'html' });
  if (sectionCount) observations.push({ text: `${sectionCount} <section> blocks suggest a chaptered, scrolling layout`, confidence: sectionCount >= 4 ? 'medium' : 'low', source: 'html' });
  if (hasCanvasOrWebGL) observations.push({ text: 'Uses canvas/WebGL (likely 3D or generative visuals)', confidence: 'medium', source: 'html' });
  if (hasVideo) observations.push({ text: 'Includes video media', confidence: 'high', source: 'html' });
  if (colors.length) observations.push({ text: `Most-used inline CSS colours: ${colors.slice(0, 4).map((c) => c.hex).join(', ')}`, confidence: 'low', source: 'css' });
  if (fonts.length) observations.push({ text: `Declared fonts include ${fonts.slice(0, 3).join(', ')} (licences not checked)`, confidence: 'low', source: 'css' });
  return { title, description, language, headings, sectionCount, imageCount, hasVideo, hasCanvasOrWebGL, colors, fonts, observations };
}
