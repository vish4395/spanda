import { LOOKS, LOOK_INFO, type DesignStyle, type DiscoveryQuestion, type Look } from '@studio/contracts';

// Looks: website archetypes modelled on award-level reference sites. A look steers which
// direction families are offered, the 3D hero art, a few style traits and the order of
// sections the planner drafts. Directions remain editable; the look is a starting point.

export interface LookRecipe {
  /** Direction families that suit the look, best first. */
  families: readonly string[];
  heroArt: readonly DesignStyle['heroArt'][];
  /** Style traits the look insists on (the rest come from the family). */
  style: Partial<DesignStyle>;
  /** Non-chapter sections, in story order; chapters are woven between them. */
  extras: readonly ('scroll-reveal' | 'model-showcase' | 'gallery')[];
}

export const LOOK_RECIPES: Record<Look, LookRecipe> = {
  'dark-tech': {
    families: ['signal-noir', 'neon-arcade', 'ocean-depth', 'polar-gallery'],
    heroArt: ['particles', 'rings', 'terrain'],
    style: { texture: 'grid', easing: 'snappy' },
    extras: ['scroll-reveal', 'model-showcase', 'gallery'],
  },
  'bold-color': {
    families: ['swiss-signal', 'brutalist-concrete', 'festival-night', 'neon-arcade'],
    heroArt: ['faceted', 'rings'],
    style: { headingCase: 'uppercase', scale: 'monumental', headingWeight: 'bold' },
    extras: ['scroll-reveal', 'gallery', 'model-showcase'],
  },
  'warm-editorial': {
    families: ['paper-atelier', 'desert-sun', 'botanical-press', 'ember-archive'],
    heroArt: ['ribbons', 'rings', 'faceted'],
    style: { scale: 'editorial', texture: 'grain' },
    extras: ['model-showcase', 'gallery', 'scroll-reveal'],
  },
  'clean-light': {
    families: ['swiss-signal', 'botanical-press', 'paper-atelier', 'monochrome-luxe'],
    heroArt: ['faceted', 'rings'],
    style: { texture: 'none', density: 'airy' },
    extras: ['model-showcase', 'scroll-reveal', 'gallery'],
  },
  'immersive-gallery': {
    families: ['monochrome-luxe', 'polar-gallery', 'violet-hour', 'signal-noir'],
    heroArt: ['particles', 'ribbons'],
    style: { density: 'airy', reveal: 'blur' },
    extras: ['gallery', 'model-showcase', 'gallery'],
  },
  'cinematic-story': {
    families: ['ember-archive', 'verdant-dusk', 'violet-hour', 'ocean-depth'],
    heroArt: ['terrain', 'ribbons', 'particles'],
    style: { easing: 'dramatic', reveal: 'mask' },
    extras: ['scroll-reveal', 'gallery', 'model-showcase'],
  },
};

/** "You decide" without AI: the look that suits each tone. */
export const LOOK_FOR_TONE: Record<string, Look> = { warm: 'warm-editorial', elegant: 'clean-light', bold: 'bold-color', mysterious: 'cinematic-story' };

export const isLook = (value: string | undefined): value is Look => (LOOKS as readonly string[]).includes(value ?? '');

/** First discovery question: what kind of website. `recommended` comes from an AI plan when there is one. */
export function lookQuestion(recommended?: Look, why?: string): DiscoveryQuestion {
  return {
    id: 'look',
    reason: 'Sets the overall kind of site: colours, 3D style and the order of sections.',
    prompt: 'What kind of website should this feel like?',
    default: recommended ?? 'cinematic-story',
    ...(why ? { why } : {}),
    options: LOOKS.map((id) => ({ id, label: LOOK_INFO[id].label, explanation: LOOK_INFO[id].explanation })),
  };
}
