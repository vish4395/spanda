import { z } from 'zod';
import { DesignStyleSchema, SCENE_LAYOUTS, SCENE_VARIANTS } from './story-spec.ts';

// Shapes AI providers must return for each workflow task. They are deliberately
// small and text-only; the studio sanitizes every value before storing it.

const Line = (max: number) => z.string().trim().min(1).max(max);

/** Website archetypes ("looks"), modelled on award-level reference sites. */
export const LOOKS = ['dark-tech', 'bold-color', 'warm-editorial', 'clean-light', 'immersive-gallery', 'cinematic-story'] as const;
export const Look = z.enum(LOOKS);
export type Look = z.infer<typeof Look>;

export const LOOK_INFO: Record<Look, { label: string; explanation: string }> = {
  'dark-tech': { label: 'Dark tech glow', explanation: 'Near-black stage, glowing particles or a point-cloud globe, crisp product proof. For SaaS, fintech and AI.' },
  'bold-color': { label: 'Bold colour statement', explanation: 'One saturated colour, huge uppercase headlines, playful 3D. For brands that want to be remembered.' },
  'warm-editorial': { label: 'Warm editorial', explanation: 'Cream paper, rich serif type, products turning in soft light. For food, craft, fashion and hospitality.' },
  'clean-light': { label: 'Clean and light', explanation: 'Bright, calm and precise, with a tidy 3D object or scene. For portfolios, studios and tools.' },
  'immersive-gallery': { label: 'Immersive gallery', explanation: 'Dark, spacious and image-led, with work floating in depth. For artists, agencies and showcases.' },
  'cinematic-story': { label: 'Cinematic story', explanation: 'A slow, atmospheric journey through chapters, like a film. For places, causes, launches and heritage.' },
};

/** The studio's core choices; a plan sets their starting values. */
export const CoreChoices = z.object({
  look: Look.optional(),
  tone: z.enum(['warm', 'elegant', 'bold', 'mysterious']),
  subject: z.enum(['place', 'object', 'abstract', 'type']),
  motion: z.enum(['calm', 'balanced', 'bold']),
  length: z.enum(['short', 'standard', 'long']),
});
export type CoreChoices = z.infer<typeof CoreChoices>;

/** Kickoff: from a project name and idea, a plan, next steps and questions made for this project. */
export const KickoffOutput = z.object({
  projectType: Line(80),
  summary: Line(600),
  facts: z.array(Line(200)).max(8),
  assumptions: z.array(Line(200)).max(8),
  nextSteps: z.array(z.object({ title: Line(80), detail: Line(300) })).min(2).max(6),
  core: CoreChoices,
  questions: z
    .array(
      z.object({
        prompt: Line(160),
        reason: Line(200),
        options: z.array(z.object({ label: Line(80), explanation: Line(200) })).min(2).max(4),
        /** Index of the option the studio picks for "You decide". */
        recommended: z.number().int().min(0).max(3),
        why: Line(200),
      }),
    )
    .min(3)
    .max(6),
});
export type KickoffOutput = z.infer<typeof KickoffOutput>;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Art directions proposed by AI; palettes are contrast-checked (and repaired or dropped) by the studio. */
export const DirectionsOutput = z.object({
  directions: z
    .array(
      z.object({
        name: Line(40),
        description: Line(160),
        colors: z.object({ background: Hex, foreground: Hex, accent: Hex, secondary: Hex }),
        /** Ids from the studio's font list (see the prompt). */
        headingFont: Line(40),
        bodyFont: Line(40),
        style: DesignStyleSchema,
        composition: z.object({
          hero: z.enum(SCENE_VARIANTS.hero),
          chapterLayouts: z.array(z.enum(SCENE_LAYOUTS)).min(1).max(6),
          steps: z.enum(SCENE_VARIANTS['scroll-reveal']),
          showcase: z.enum(SCENE_VARIANTS['model-showcase']),
          gallery: z.enum(SCENE_VARIANTS.gallery),
          cta: z.enum(SCENE_VARIANTS.cta),
        }),
        rationale: Line(200),
      }),
    )
    .min(2)
    .max(4),
});
export type DirectionsOutput = z.infer<typeof DirectionsOutput>;

/** A filled-in creative brief; the user still edits and approves it. */
export const BriefOutput = z.object({
  audience: Line(200),
  tone: Line(120),
  motion: z.enum(['calm', 'balanced', 'bold']),
  chapters: z.number().int().min(1).max(6),
  notes: z.string().trim().max(1000),
  reasons: Line(300),
});
export type BriefOutput = z.infer<typeof BriefOutput>;
