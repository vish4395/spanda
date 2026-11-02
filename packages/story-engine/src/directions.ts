import type { CreativeDirection, DesignStyle, DirectionComposition, DiscoveryAnswer } from '@studio/contracts';

// Art-direction generator (Phase 1 design language). Directions are built from design
// families: each family fixes a palette and character, and lists the alternatives it
// allows for type, texture, motion and composition. A seed picks among them, so
// "show other directions" yields new combinations while every result stays coherent
// and passes the contrast checks below. Deterministic: same inputs, same directions.

/** Font stacks that resolve on stock macOS, Windows and Linux; no downloads, no licences to ship. */
export const FONT_STACKS = {
  'classic-serif': { name: 'Classic serif', stack: 'Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, serif' },
  'didone': { name: 'High-contrast didone', stack: 'Didot, Bodoni MT, Noto Serif Display, Georgia, serif' },
  'book-serif': { name: 'Book serif', stack: 'Charter, Bitstream Charter, Cambria, Georgia, serif' },
  'geometric': { name: 'Geometric sans', stack: 'Futura, Century Gothic, Avenir Next, URW Gothic, sans-serif' },
  'humanist': { name: 'Humanist sans', stack: 'Avenir Next, Avenir, Segoe UI, Ubuntu, Helvetica Neue, sans-serif' },
  'grotesk': { name: 'Grotesk', stack: 'Helvetica Neue, Helvetica, Arial, Liberation Sans, sans-serif' },
  'calligraphic': { name: 'Calligraphic sans', stack: 'Optima, Candara, Segoe UI, Noto Sans, sans-serif' },
  'condensed': { name: 'Condensed display', stack: 'Avenir Next Condensed, Arial Narrow, Roboto Condensed, Liberation Sans Narrow, sans-serif' },
  'mono': { name: 'Monospace', stack: 'SF Mono, Menlo, Consolas, Liberation Mono, monospace' },
  'slab': { name: 'Slab serif', stack: 'Rockwell, Roboto Slab, DejaVu Serif, Georgia, serif' },
  'system': { name: 'System sans', stack: 'system-ui, Segoe UI, Roboto, Ubuntu, sans-serif' },
} as const;
export type FontId = keyof typeof FONT_STACKS;

type Palette = { background: string; foreground: string; accent: string; secondary: string };
type Options<K extends keyof DesignStyle> = readonly DesignStyle[K][];

interface Family {
  id: string;
  name: string;
  description: string;
  tones: readonly string[];
  subjects: readonly string[];
  palettes: readonly Palette[];
  fonts: readonly (readonly [heading: FontId, body: FontId])[];
  style: { [K in keyof DesignStyle]: Options<K> };
  composition: { hero: readonly DirectionComposition['hero'][]; chapterLayouts: readonly (readonly DirectionComposition['chapterLayouts'][number][])[]; steps: readonly DirectionComposition['steps'][]; showcase: readonly DirectionComposition['showcase'][]; gallery: readonly DirectionComposition['gallery'][]; cta: readonly DirectionComposition['cta'][] };
}

const FAMILIES: readonly Family[] = [
  {
    id: 'ember-archive', name: 'Ember Archive', description: 'Charcoal night with candle-gold light; warm, human and timeless.',
    tones: ['warm', 'mysterious'], subjects: ['place', 'object'],
    palettes: [{ background: '#12100e', foreground: '#f5efe6', accent: '#e0a458', secondary: '#b5653a' }, { background: '#16110d', foreground: '#f7efe2', accent: '#f0b66a', secondary: '#c9733d' }],
    fonts: [['classic-serif', 'humanist'], ['book-serif', 'system']],
    style: { mode: ['dark'], scale: ['editorial'], headingCase: ['normal'], headingWeight: ['bold', 'regular'], radius: ['soft'], texture: ['grain', 'none'], density: ['balanced'], reveal: ['fade-up', 'blur'], easing: ['gentle'], heroArt: ['faceted', 'rings'], panelArt: ['arcs', 'mesh'] },
    composition: { hero: ['bottom-left', 'split'], chapterLayouts: [['split', 'split-reverse', 'full-bleed'], ['split', 'centered', 'split-reverse']], steps: ['cards', 'timeline'], showcase: ['split'], gallery: ['carousel', 'grid'], cta: ['card'] },
  },
  {
    id: 'paper-atelier', name: 'Paper Atelier', description: 'Warm cream paper, ink type and a single terracotta mark; crafted and editorial.',
    tones: ['warm', 'elegant'], subjects: ['object', 'type', 'place'],
    palettes: [{ background: '#f4ede1', foreground: '#1f1a14', accent: '#a8431f', secondary: '#4f6b4a' }, { background: '#f6f0e6', foreground: '#231c16', accent: '#8c3b1c', secondary: '#2f5a6b' }],
    fonts: [['classic-serif', 'book-serif'], ['didone', 'humanist']],
    style: { mode: ['light'], scale: ['editorial', 'monumental'], headingCase: ['normal'], headingWeight: ['regular', 'light'], radius: ['sharp', 'soft'], texture: ['grain'], density: ['airy'], reveal: ['mask', 'fade-up'], easing: ['gentle', 'dramatic'], heroArt: ['rings', 'none'], panelArt: ['stripes', 'blobs'] },
    composition: { hero: ['top-left', 'monumental'], chapterLayouts: [['editorial', 'asymmetric', 'stacked'], ['asymmetric', 'split-reverse', 'editorial']], steps: ['timeline'], showcase: ['stage'], gallery: ['mosaic', 'grid'], cta: ['minimal'] },
  },
  {
    id: 'swiss-signal', name: 'Swiss Signal', description: 'White grid, black grotesk and a red signal; precise, confident and clear.',
    tones: ['bold', 'elegant'], subjects: ['type', 'abstract', 'object'],
    palettes: [{ background: '#fafaf7', foreground: '#111111', accent: '#d7261e', secondary: '#1c3faa' }, { background: '#f3f3ef', foreground: '#0d0d0d', accent: '#c4161c', secondary: '#0f6e52' }],
    fonts: [['grotesk', 'grotesk'], ['condensed', 'grotesk']],
    style: { mode: ['light'], scale: ['monumental'], headingCase: ['uppercase', 'normal'], headingWeight: ['bold'], radius: ['sharp'], texture: ['grid', 'none'], density: ['compact', 'balanced'], reveal: ['slide', 'mask'], easing: ['snappy'], heroArt: ['none', 'terrain'], panelArt: ['grid', 'stripes'] },
    composition: { hero: ['monumental', 'top-left'], chapterLayouts: [['editorial', 'split', 'stacked'], ['stacked', 'asymmetric', 'editorial']], steps: ['cards', 'sticky'], showcase: ['split'], gallery: ['grid'], cta: ['banner'] },
  },
  {
    id: 'neon-arcade', name: 'Neon Arcade', description: 'Ink-black stage with magenta and cyan light; electric, playful and loud.',
    tones: ['bold'], subjects: ['abstract', 'object', 'type'],
    palettes: [{ background: '#07060d', foreground: '#f2f0ff', accent: '#ff3fa4', secondary: '#25e2f0' }, { background: '#0a0714', foreground: '#f5f2ff', accent: '#b6ff3b', secondary: '#ff5ecf' }],
    fonts: [['mono', 'system'], ['condensed', 'mono']],
    style: { mode: ['dark'], scale: ['monumental', 'editorial'], headingCase: ['uppercase'], headingWeight: ['bold'], radius: ['sharp', 'round'], texture: ['lines', 'dots'], density: ['compact'], reveal: ['scale', 'slide'], easing: ['snappy'], heroArt: ['particles', 'terrain'], panelArt: ['duotone', 'grid'] },
    composition: { hero: ['centered', 'monumental'], chapterLayouts: [['full-bleed', 'split', 'asymmetric'], ['split-reverse', 'full-bleed', 'stacked']], steps: ['sticky', 'cards'], showcase: ['stage'], gallery: ['mosaic', 'carousel'], cta: ['banner', 'card'] },
  },
  {
    id: 'desert-sun', name: 'Desert Sun', description: 'Sand, clay and a low sun; earthy, open and slow.',
    tones: ['warm'], subjects: ['place', 'object'],
    palettes: [{ background: '#efe2cf', foreground: '#2b1d14', accent: '#a5481f', secondary: '#7a5c1f' }, { background: '#f2e6d4', foreground: '#2a1c12', accent: '#9a3e1d', secondary: '#45624b' }],
    fonts: [['geometric', 'humanist'], ['slab', 'humanist']],
    style: { mode: ['light'], scale: ['editorial'], headingCase: ['normal', 'uppercase'], headingWeight: ['regular', 'bold'], radius: ['round'], texture: ['grain', 'none'], density: ['airy', 'balanced'], reveal: ['fade-up', 'blur'], easing: ['gentle'], heroArt: ['terrain', 'rings'], panelArt: ['blobs', 'arcs'] },
    composition: { hero: ['centered', 'bottom-left'], chapterLayouts: [['full-bleed', 'split', 'centered'], ['split-reverse', 'stacked', 'split']], steps: ['timeline', 'cards'], showcase: ['stage'], gallery: ['carousel', 'mosaic'], cta: ['card'] },
  },
  {
    id: 'monochrome-luxe', name: 'Monochrome Luxe', description: 'Black and ivory, hairline type and long pauses; quiet luxury.',
    tones: ['elegant', 'mysterious'], subjects: ['object', 'type', 'place'],
    palettes: [{ background: '#0b0b0b', foreground: '#f3eee6', accent: '#d8c7a6', secondary: '#8f8676' }, { background: '#f5f1ea', foreground: '#141210', accent: '#6b5a3c', secondary: '#3d3a35' }],
    fonts: [['didone', 'humanist'], ['didone', 'calligraphic']],
    style: { mode: ['dark', 'light'], scale: ['monumental', 'editorial'], headingCase: ['uppercase', 'normal'], headingWeight: ['light'], radius: ['sharp'], texture: ['none'], density: ['airy'], reveal: ['mask', 'blur'], easing: ['dramatic'], heroArt: ['rings', 'faceted'], panelArt: ['mesh', 'stripes'] },
    composition: { hero: ['centered', 'monumental'], chapterLayouts: [['full-bleed', 'centered', 'split-reverse'], ['editorial', 'full-bleed', 'asymmetric']], steps: ['timeline'], showcase: ['stage'], gallery: ['grid'], cta: ['minimal'] },
  },
  {
    id: 'ocean-depth', name: 'Ocean Depth', description: 'Deep teal water with aqua light; immersive, fluid and calm.',
    tones: ['elegant', 'mysterious'], subjects: ['place', 'abstract'],
    palettes: [{ background: '#06171c', foreground: '#e9f6f6', accent: '#4fd1c5', secondary: '#7fa7ff' }, { background: '#071a24', foreground: '#eaf4fa', accent: '#5cc8ff', secondary: '#7be0b0' }],
    fonts: [['humanist', 'humanist'], ['calligraphic', 'system']],
    style: { mode: ['dark'], scale: ['editorial', 'quiet'], headingCase: ['normal'], headingWeight: ['light', 'regular'], radius: ['round', 'soft'], texture: ['none', 'dots'], density: ['airy', 'balanced'], reveal: ['blur', 'fade-up'], easing: ['gentle'], heroArt: ['ribbons', 'particles'], panelArt: ['mesh', 'blobs'] },
    composition: { hero: ['centered', 'bottom-left'], chapterLayouts: [['full-bleed', 'split', 'split-reverse'], ['centered', 'full-bleed', 'split']], steps: ['sticky', 'timeline'], showcase: ['stage', 'split'], gallery: ['carousel'], cta: ['card'] },
  },
  {
    id: 'botanical-press', name: 'Botanical Press', description: 'Sage paper and forest ink; natural, grounded and gentle.',
    tones: ['warm', 'elegant'], subjects: ['place', 'object'],
    palettes: [{ background: '#e8ece2', foreground: '#17231a', accent: '#2f6a3a', secondary: '#8a4b2a' }, { background: '#eef0e6', foreground: '#1a2418', accent: '#3d5f2a', secondary: '#7a3e5c' }],
    fonts: [['calligraphic', 'humanist'], ['book-serif', 'calligraphic']],
    style: { mode: ['light'], scale: ['editorial', 'quiet'], headingCase: ['normal'], headingWeight: ['regular'], radius: ['soft', 'round'], texture: ['grain', 'none'], density: ['airy'], reveal: ['fade-up', 'mask'], easing: ['gentle'], heroArt: ['ribbons', 'none'], panelArt: ['blobs', 'arcs'] },
    composition: { hero: ['split', 'top-left'], chapterLayouts: [['asymmetric', 'split', 'stacked'], ['split-reverse', 'editorial', 'split']], steps: ['timeline', 'cards'], showcase: ['split'], gallery: ['mosaic', 'grid'], cta: ['card', 'minimal'] },
  },
  {
    id: 'brutalist-concrete', name: 'Brutalist Concrete', description: 'Raw grey, heavy mono type and an electric blue; honest and direct.',
    tones: ['bold'], subjects: ['type', 'abstract'],
    palettes: [{ background: '#d9d9d4', foreground: '#0e0e0e', accent: '#1636d6', secondary: '#9b1c1c' }, { background: '#e2e0d8', foreground: '#111111', accent: '#3a1fd1', secondary: '#0b6b45' }],
    fonts: [['mono', 'mono'], ['grotesk', 'mono']],
    style: { mode: ['light'], scale: ['monumental'], headingCase: ['uppercase'], headingWeight: ['bold'], radius: ['sharp'], texture: ['grid', 'lines'], density: ['compact'], reveal: ['slide', 'scale'], easing: ['snappy'], heroArt: ['none', 'terrain'], panelArt: ['grid', 'stripes'] },
    composition: { hero: ['monumental', 'top-left'], chapterLayouts: [['stacked', 'editorial', 'split'], ['editorial', 'stacked', 'asymmetric']], steps: ['cards'], showcase: ['split'], gallery: ['grid'], cta: ['banner'] },
  },
  {
    id: 'festival-night', name: 'Festival Night', description: 'Indigo night lit by saffron and rose; celebratory, rich and warm.',
    tones: ['warm', 'bold'], subjects: ['place', 'abstract', 'object'],
    palettes: [{ background: '#110d2b', foreground: '#fbf4ea', accent: '#ffb02e', secondary: '#ff5c8a' }, { background: '#14092a', foreground: '#fff4e8', accent: '#ffc247', secondary: '#ff6f61' }],
    fonts: [['geometric', 'humanist'], ['slab', 'system']],
    style: { mode: ['dark'], scale: ['editorial', 'monumental'], headingCase: ['normal'], headingWeight: ['bold'], radius: ['round'], texture: ['dots', 'none'], density: ['balanced'], reveal: ['scale', 'fade-up'], easing: ['snappy', 'gentle'], heroArt: ['particles', 'ribbons'], panelArt: ['duotone', 'mesh'] },
    composition: { hero: ['centered', 'split'], chapterLayouts: [['split', 'full-bleed', 'split-reverse'], ['asymmetric', 'split', 'full-bleed']], steps: ['cards', 'sticky'], showcase: ['stage'], gallery: ['carousel', 'mosaic'], cta: ['banner'] },
  },
  {
    id: 'polar-gallery', name: 'Polar Gallery', description: 'Ink-blue calm with frost highlights; spacious and precise.',
    tones: ['elegant'], subjects: ['object', 'abstract', 'place'],
    palettes: [{ background: '#0c1118', foreground: '#eef3f8', accent: '#8fc3ff', secondary: '#b9a2ff' }],
    fonts: [['system', 'system'], ['humanist', 'humanist']],
    style: { mode: ['dark'], scale: ['quiet', 'editorial'], headingCase: ['normal'], headingWeight: ['regular', 'light'], radius: ['soft'], texture: ['none'], density: ['airy'], reveal: ['fade-up', 'blur'], easing: ['gentle'], heroArt: ['faceted', 'particles'], panelArt: ['mesh', 'arcs'] },
    composition: { hero: ['bottom-left', 'centered'], chapterLayouts: [['split', 'centered', 'split-reverse'], ['stacked', 'split', 'centered']], steps: ['cards'], showcase: ['split', 'stage'], gallery: ['grid', 'carousel'], cta: ['card'] },
  },
  {
    id: 'violet-hour', name: 'Violet Hour', description: 'Deep plum with lilac glow; dreamy and cinematic.',
    tones: ['mysterious', 'bold'], subjects: ['abstract', 'place'],
    palettes: [{ background: '#110e17', foreground: '#f3effa', accent: '#b9a2ff', secondary: '#ff9ec7' }],
    fonts: [['didone', 'system'], ['system', 'system']],
    style: { mode: ['dark'], scale: ['editorial', 'monumental'], headingCase: ['normal', 'uppercase'], headingWeight: ['regular', 'bold'], radius: ['soft', 'round'], texture: ['grain', 'none'], density: ['balanced'], reveal: ['blur', 'mask'], easing: ['dramatic', 'gentle'], heroArt: ['ribbons', 'faceted'], panelArt: ['mesh', 'duotone'] },
    composition: { hero: ['centered', 'bottom-left'], chapterLayouts: [['full-bleed', 'split-reverse', 'split'], ['split', 'full-bleed', 'centered']], steps: ['sticky', 'timeline'], showcase: ['stage'], gallery: ['carousel'], cta: ['card', 'minimal'] },
  },
  {
    id: 'verdant-dusk', name: 'Verdant Dusk', description: 'Forest-dark green with moss light; grounded and atmospheric.',
    tones: ['elegant', 'warm', 'mysterious'], subjects: ['place'],
    palettes: [{ background: '#0d1310', foreground: '#eef4ee', accent: '#9fd49a', secondary: '#e3c57a' }],
    fonts: [['classic-serif', 'system'], ['book-serif', 'humanist']],
    style: { mode: ['dark'], scale: ['editorial', 'quiet'], headingCase: ['normal'], headingWeight: ['regular'], radius: ['soft'], texture: ['grain', 'none'], density: ['airy', 'balanced'], reveal: ['fade-up', 'mask'], easing: ['gentle', 'dramatic'], heroArt: ['terrain', 'particles'], panelArt: ['arcs', 'blobs'] },
    composition: { hero: ['bottom-left', 'top-left'], chapterLayouts: [['full-bleed', 'split', 'editorial'], ['split-reverse', 'full-bleed', 'split']], steps: ['timeline'], showcase: ['split'], gallery: ['carousel', 'grid'], cta: ['card'] },
  },
  {
    id: 'signal-noir', name: 'Signal Noir', description: 'Near-black stage with an electric coral signal; confident and fast.',
    tones: ['bold', 'mysterious'], subjects: ['object', 'type', 'abstract'],
    palettes: [{ background: '#0b0b0d', foreground: '#fafafa', accent: '#ff6b5b', secondary: '#ffd166' }],
    fonts: [['grotesk', 'system'], ['condensed', 'grotesk']],
    style: { mode: ['dark'], scale: ['monumental', 'editorial'], headingCase: ['uppercase', 'normal'], headingWeight: ['bold'], radius: ['sharp', 'soft'], texture: ['none', 'lines'], density: ['compact', 'balanced'], reveal: ['slide', 'scale'], easing: ['snappy'], heroArt: ['faceted', 'terrain'], panelArt: ['stripes', 'duotone'] },
    composition: { hero: ['monumental', 'split'], chapterLayouts: [['split', 'stacked', 'split-reverse'], ['asymmetric', 'split', 'stacked']], steps: ['sticky', 'cards'], showcase: ['split'], gallery: ['mosaic'], cta: ['banner'] },
  },
];

// ---- colour maths (WCAG 2.x) ----
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
/** Body text ≥ 7:1 (AAA), accent and secondary ≥ 4.5:1 against the background (used for links, labels, buttons). */
export function paletteIsAccessible(p: Palette): boolean {
  return contrastRatio(p.foreground, p.background) >= 7 && contrastRatio(p.accent, p.background) >= 4.5 && contrastRatio(p.secondary, p.background) >= 3;
}

// ---- deterministic choice ----
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]!;

const answerOf = (answers: Record<string, DiscoveryAnswer>, id: string, fallback: string) => {
  const a = answers[id];
  return a && a !== 'skip' && a !== 'ai-decide' ? a : fallback;
};

function build(family: Family, r: () => number, motion: CreativeDirection['motion'], seedTag: string): CreativeDirection {
  const palette = pick(r, family.palettes.filter(paletteIsAccessible).length ? family.palettes.filter(paletteIsAccessible) : family.palettes);
  const [heading, body] = pick(r, family.fonts);
  const style = Object.fromEntries(Object.entries(family.style).map(([k, list]) => [k, pick(r, list as readonly string[])])) as DesignStyle;
  // Motion answer tunes intensity without breaking the family's character.
  if (motion === 'calm') {
    style.easing = 'gentle';
    if (style.reveal === 'scale' || style.reveal === 'slide') style.reveal = 'fade-up';
  } else if (motion === 'bold' && style.heroArt === 'none') {
    style.heroArt = family.style.heroArt.find((a) => a !== 'none') ?? 'particles';
  }
  // Mode follows the palette (a family may offer both).
  style.mode = luminance(palette.background) > 0.4 ? 'light' : 'dark';
  const c = family.composition;
  const composition: DirectionComposition = { hero: pick(r, c.hero), chapterLayouts: [...pick(r, c.chapterLayouts)], steps: pick(r, c.steps), showcase: pick(r, c.showcase), gallery: pick(r, c.gallery), cta: pick(r, c.cta) };
  return {
    id: `${family.id}-${seedTag}`.slice(0, 64),
    name: family.name,
    description: family.description,
    colors: palette,
    typography: { heading: FONT_STACKS[heading].stack, body: FONT_STACKS[body].stack, label: `${FONT_STACKS[heading].name} with ${FONT_STACKS[body].name.toLowerCase()}` },
    motion,
    style,
    composition,
    basis: `Studio family “${family.name}”`,
  };
}

/** Rough distance between two directions; used to keep the three offers visibly different. */
function distance(a: CreativeDirection, b: CreativeDirection): number {
  const keys = Object.keys(a.style) as (keyof DesignStyle)[];
  return keys.filter((k) => a.style[k] !== b.style[k]).length + (a.typography.heading === b.typography.heading ? 0 : 2) + (a.composition.hero === b.composition.hero ? 0 : 1);
}

export interface DirectionOptions {
  /** Bumped by "show other directions". */
  seed?: number;
  /** Project identity, so two projects with the same answers still get different offers. */
  salt?: string;
  count?: number;
}

/** Three (by default) coherent, accessible and clearly different art directions for these answers. */
export function generateDirections(answers: Record<string, DiscoveryAnswer>, options: DirectionOptions = {}): CreativeDirection[] {
  const tone = answerOf(answers, 'tone', '');
  const subject = answerOf(answers, 'subject', '');
  const motion = answerOf(answers, 'motion', 'balanced') as CreativeDirection['motion'];
  const seed = options.seed ?? 0;
  const count = options.count ?? 3;
  const r = rng(hash(`${options.salt ?? ''}|${tone}|${subject}|${motion}|${seed}`));
  // Fit first, with a seeded jitter so later seeds surface other good families.
  const ranked = FAMILIES.map((f) => ({ f, score: (tone && f.tones.includes(tone) ? 3 : tone ? 0 : 1) + (subject && f.subjects.includes(subject) ? 2 : subject ? 0 : 1) + r() * 2.5 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);
  const pool = ranked.slice(0, Math.min(ranked.length, 6 + seed * 2));
  const tag = (i: number) => `${seed}${i}${hash(`${options.salt ?? ''}${seed}`).toString(36).slice(0, 4)}`;
  const out: CreativeDirection[] = [];
  for (let i = 0; i < pool.length && out.length < count; i += 1) {
    const candidate = build(pool[(i + seed) % pool.length]!, r, motion, tag(out.length));
    // Prefer a mix of light and dark, and directions that differ in at least 5 traits.
    const tooClose = out.some((d) => distance(d, candidate) < 5);
    const sameMode = out.length === 2 && out.every((d) => d.style.mode === candidate.style.mode);
    if (!tooClose && !sameMode) out.push(candidate);
  }
  for (let i = 0; out.length < count && i < ranked.length; i += 1) {
    const candidate = build(ranked[i]!, r, motion, tag(out.length));
    if (!out.some((d) => d.name === candidate.name)) out.push(candidate);
  }
  return out;
}

export function directionFamilies(): { id: string; name: string; description: string }[] {
  return FAMILIES.map(({ id, name, description }) => ({ id, name, description }));
}

/** The five 0.1.0 preset ids, for briefs approved before directions carried a snapshot. */
export function legacyDirection(id: string): CreativeDirection | null {
  const family = FAMILIES.find((f) => f.id === id);
  if (!family) return null;
  const palette = family.palettes[0]!;
  return {
    id,
    name: family.name,
    description: family.description,
    colors: palette,
    typography: { heading: id === 'ember-archive' || id === 'verdant-dusk' ? 'Georgia, serif' : 'system-ui', body: 'system-ui', label: 'Legacy pairing' },
    motion: 'balanced',
    style: { mode: 'dark', scale: 'editorial', headingCase: 'normal', headingWeight: 'bold', radius: 'soft', texture: 'none', density: 'balanced', reveal: 'fade-up', easing: 'gentle', heroArt: 'faceted', panelArt: 'arcs' },
    composition: { hero: 'bottom-left', chapterLayouts: ['split', 'centered'], steps: 'cards', showcase: 'split', gallery: 'carousel', cta: 'card' },
    basis: 'Preset from an earlier studio version',
  };
}
