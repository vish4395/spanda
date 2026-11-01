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

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? clean(content, 300) : null;
}

function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h.slice(0, 7);
}

export function extractFacts(html: string): PageFacts {
  const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(withoutScripts)?.[1] ?? '', 200) || null;
  const description = meta(withoutScripts, 'description') ?? meta(withoutScripts, 'og:description');
  const language = /<html[^>]*\blang=["']([a-zA-Z-]{2,15})["']/i.exec(withoutScripts)?.[1] ?? null;
  const headings = [...withoutScripts.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => clean(m[2] ?? '', 120)).filter(Boolean).slice(0, 12);
  const sectionCount = (withoutScripts.match(/<section\b/gi) ?? []).length;
  const imageCount = (withoutScripts.match(/<img\b/gi) ?? []).length;
  const hasVideo = /<video\b/i.test(withoutScripts);
  const hasCanvasOrWebGL = /<canvas\b/i.test(withoutScripts) || /three(\.module)?(\.min)?\.js|webgl/i.test(html);

  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n') + [...html.matchAll(/style=["']([^"']*)["']/gi)].map((m) => m[1]).join(';');
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
