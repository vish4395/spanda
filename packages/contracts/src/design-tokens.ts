import type { DesignStyle, StorySpec } from './story-spec.ts';

// One mapping from the design language to CSS, shared by both generators so the HTML
// and React outputs can never drift. Values are schema enums or validated hex/font
// stacks, so nothing user-controlled reaches CSS unchecked.

const SCALE: Record<DesignStyle['scale'], { h1: string; h2: string; h3: string; body: string }> = {
  quiet: { h1: 'clamp(2.25rem, 5vw, 4rem)', h2: 'clamp(1.75rem, 3.4vw, 2.75rem)', h3: '1.125rem', body: '1rem' },
  editorial: { h1: 'clamp(2.75rem, 8vw, 6.5rem)', h2: 'clamp(2.25rem, 5vw, 4rem)', h3: '1.25rem', body: '1.0625rem' },
  monumental: { h1: 'clamp(3.25rem, 12.5vw, 11rem)', h2: 'clamp(2.5rem, 7.5vw, 6.5rem)', h3: '1.375rem', body: '1.125rem' },
};
const WEIGHT: Record<DesignStyle['headingWeight'], string> = { light: '300', regular: '450', bold: '650' };
const RADIUS: Record<DesignStyle['radius'], { lg: string; md: string; pill: string }> = {
  sharp: { lg: '0', md: '0', pill: '0.125rem' },
  soft: { lg: '1.5rem', md: '0.875rem', pill: '999px' },
  round: { lg: '2.5rem', md: '1.5rem', pill: '999px' },
};
const DENSITY: Record<DesignStyle['density'], { section: string; gap: string }> = {
  airy: { section: 'clamp(6rem, 14vw, 12rem)', gap: 'clamp(2.5rem, 8vw, 7rem)' },
  balanced: { section: 'clamp(4rem, 10vw, 8rem)', gap: 'clamp(2rem, 6vw, 5rem)' },
  compact: { section: 'clamp(3rem, 6vw, 5rem)', gap: 'clamp(1.25rem, 4vw, 3rem)' },
};
const EASING: Record<DesignStyle['easing'], { curve: string; duration: string }> = {
  gentle: { curve: 'cubic-bezier(0.2, 0.7, 0.2, 1)', duration: '700ms' },
  snappy: { curve: 'cubic-bezier(0.16, 1, 0.3, 1)', duration: '450ms' },
  dramatic: { curve: 'cubic-bezier(0.7, 0, 0.2, 1)', duration: '1100ms' },
};

export function renderDesignTokensCss(spec: StorySpec): string {
  const { colors, typography, style } = spec.design;
  const scale = SCALE[style.scale];
  const radius = RADIUS[style.radius];
  const density = DENSITY[style.density];
  const easing = EASING[style.easing];
  return `:root {
  color-scheme: ${style.mode};
  --color-bg: ${colors.background};
  --color-fg: ${colors.foreground};
  --color-accent: ${colors.accent};
  --color-secondary: ${colors.secondary};
  --color-fg-muted: color-mix(in srgb, var(--color-fg) 80%, var(--color-bg));
  --color-shade: ${style.mode === 'dark' ? '#000' : '#fff'};
  --font-heading: ${typography.heading};
  --font-body: ${typography.body};
  --size-h1: ${scale.h1};
  --size-h2: ${scale.h2};
  --size-h3: ${scale.h3};
  --size-body: ${scale.body};
  --heading-weight: ${WEIGHT[style.headingWeight]};
  --heading-case: ${style.headingCase === 'uppercase' ? 'uppercase' : 'none'};
  --heading-tracking: ${style.headingCase === 'uppercase' ? '0.01em' : style.headingWeight === 'light' ? '-0.03em' : '-0.02em'};
  --radius-lg: ${radius.lg};
  --radius-md: ${radius.md};
  --radius-pill: ${radius.pill};
  --space-section: ${density.section};
  --space-gap: ${density.gap};
  --ease: ${easing.curve};
  --reveal-duration: ${easing.duration};
}
`;
}

/** Attributes for the root <html> element; the stylesheet keys its variants off these. */
export function designRootAttributes(spec: StorySpec): Record<string, string> {
  const { style } = spec.design;
  return { 'data-mode': style.mode, 'data-texture': style.texture, 'data-reveal-style': style.reveal, 'data-panel': style.panelArt, 'data-hero-art': style.heroArt };
}
