import { z } from 'zod';
import { AiProvenance, AiStep } from './ai.ts';
import { DesignStyleSchema, SCENE_LAYOUTS, SCENE_VARIANTS } from './story-spec.ts';

// Creative workflow contracts (M2: discovery → brief → storyboard → StorySpec).

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const ShortText = (max: number) => z.string().trim().max(max);

export const DiscoveryOption = z.object({ id: Id, label: z.string(), explanation: z.string() });
export const DiscoveryQuestion = z.object({
  id: Id,
  reason: z.string(),
  prompt: z.string(),
  options: z.array(DiscoveryOption).min(2).max(4),
  default: Id,
});
export type DiscoveryQuestion = z.infer<typeof DiscoveryQuestion>;

/** An option id, or the user explicitly skipping / letting the studio decide. */
export const DiscoveryAnswer = z.union([Id, z.literal('skip'), z.literal('ai-decide')]);
export type DiscoveryAnswer = z.infer<typeof DiscoveryAnswer>;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** How a direction arranges scenes: hero variant, the rhythm of chapter layouts, and section variants. */
export const DirectionComposition = z.object({
  hero: z.enum(SCENE_VARIANTS.hero),
  chapterLayouts: z.array(z.enum(SCENE_LAYOUTS)).min(1).max(6),
  steps: z.enum(SCENE_VARIANTS['scroll-reveal']),
  showcase: z.enum(SCENE_VARIANTS['model-showcase']),
  gallery: z.enum(SCENE_VARIANTS.gallery),
  cta: z.enum(SCENE_VARIANTS.cta),
});
export type DirectionComposition = z.infer<typeof DirectionComposition>;

export const CreativeDirection = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  colors: z.object({ background: Hex, foreground: Hex, accent: Hex, secondary: Hex }),
  typography: z.object({ heading: z.string(), body: z.string(), label: z.string() }),
  motion: z.enum(['calm', 'balanced', 'bold']),
  style: DesignStyleSchema,
  composition: DirectionComposition,
  /** Where the direction came from: a studio family, or a reference's design DNA. */
  basis: z.string().max(200),
});
export type CreativeDirection = z.infer<typeof CreativeDirection>;

export const ReferenceObservation = z.object({ text: z.string(), confidence: z.enum(['high', 'medium', 'low']), source: z.enum(['html', 'css', 'screenshot']) });

export const ReferenceReport = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  finalUrl: z.string().url(),
  fetchedAt: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  headings: z.array(z.string()),
  colors: z.array(z.object({ hex: z.string(), count: z.number() })),
  fonts: z.array(z.string()),
  observations: z.array(ReferenceObservation),
  screenshot: z.string().nullable(),
  truncated: z.boolean(),
  /** What the user wants to take from this reference (free text, their words). */
  inspiration: ShortText(300),
  rightsNotice: z.string(),
});
export type ReferenceReport = z.infer<typeof ReferenceReport>;

export const CreativeBrief = z.object({
  audience: ShortText(200),
  tone: ShortText(120),
  directionId: Id,
  /** Snapshot of the chosen direction, so regenerating options never changes an approved brief. */
  direction: CreativeDirection.optional(),
  motion: z.enum(['calm', 'balanced', 'bold']),
  chapters: z.number().int().min(1).max(6),
  notes: ShortText(1000),
  approved: z.boolean(),
  approvedAt: z.string().nullable(),
});
export type CreativeBrief = z.infer<typeof CreativeBrief>;

export const StoryboardScene = z.object({
  id: Id,
  type: z.enum(['hero', 'chapter', 'scroll-reveal', 'model-showcase', 'gallery', 'cta']),
  eyebrow: ShortText(120).optional(),
  heading: ShortText(200).min(1),
  // Same limits as the StorySpec fields they become, so scoped scene edits sync back losslessly (T020).
  body: ShortText(4000),
  layout: z.enum(SCENE_LAYOUTS).optional(),
  variant: z.string().max(40).optional(),
  visualNote: ShortText(1000),
  items: z.array(z.object({ title: ShortText(120).min(1), text: ShortText(600) })).max(8).optional(),
  cta: z.object({ label: ShortText(80).min(1), href: z.string().max(2048) }).optional(),
  object: z.enum(['monolith', 'vessel', 'orb']).optional(),
});
export type StoryboardScene = z.infer<typeof StoryboardScene>;

/** Who drafts a storyboard: the local planner (no AI) or one of the provider CLIs. */
export const StoryboardPlanner = z.enum(['local-planner', 'claude-code', 'codex']);
export type StoryboardPlanner = z.infer<typeof StoryboardPlanner>;

export const StoryboardSource = z.object({
  kind: StoryboardPlanner,
  detail: z.string(),
  createdAt: z.string(),
  /** Set when a provider drafted it. */
  provenance: AiProvenance.optional(),
});

export const Storyboard = z.object({
  scenes: z.array(StoryboardScene).min(1).max(8),
  source: StoryboardSource,
  approved: z.boolean(),
  approvedAt: z.string().nullable(),
});
export type Storyboard = z.infer<typeof Storyboard>;

export const ProjectStage = z.enum(['draft', 'discovery', 'brief_ready', 'storyboard_ready', 'approved']);
export type ProjectStage = z.infer<typeof ProjectStage>;

/** Persisted per project in creative.json. */
export const CreativeFile = z.object({
  version: z.literal(1),
  answers: z.record(z.string(), DiscoveryAnswer),
  brief: CreativeBrief.nullable(),
  storyboard: Storyboard.nullable(),
  references: z.array(ReferenceReport).max(10),
  /** Bumped by "Show other directions"; directions are generated deterministically from it. */
  directionSeed: z.number().int().min(0).optional(),
});
export type CreativeFile = z.infer<typeof CreativeFile>;

export const CreativeState = z.object({
  stage: ProjectStage,
  idea: z.string(),
  nextQuestion: DiscoveryQuestion.nullable(),
  answered: z.array(z.object({ question: DiscoveryQuestion, answer: DiscoveryAnswer })),
  directions: z.array(CreativeDirection),
  brief: CreativeBrief.nullable(),
  storyboard: Storyboard.nullable(),
  references: z.array(ReferenceReport),
  planners: z.array(z.object({ id: StoryboardPlanner, label: z.string(), available: z.boolean(), reason: z.string().nullable() })),
  /** The AI task running for this project, if any (poll it with `ai.job`). */
  aiJob: z.object({ id: z.string().uuid(), step: AiStep, title: z.string() }).nullable(),
  /** The last AI task that failed, so the error stays visible after the job ends. */
  aiError: z.string().nullable(),
});
export type CreativeState = z.infer<typeof CreativeState>;

/** Shape an AI provider must return when drafting a storyboard (validated, then sanitised). */
export const DraftStoryboardOutput = z.object({
  scenes: z
    .array(
      z.object({
        type: z.enum(['hero', 'chapter', 'scroll-reveal', 'model-showcase', 'gallery', 'cta']),
        eyebrow: z.string().max(120).optional(),
        heading: z.string().min(1).max(200),
        body: z.string().max(1200).default(''),
        visualNote: z.string().max(300).default(''),
        layout: z.string().max(40).optional(),
        items: z.array(z.object({ title: z.string().min(1).max(120), text: z.string().max(600) })).max(8).optional(),
        cta: z.object({ label: z.string().min(1).max(80) }).optional(),
        object: z.string().max(40).optional(),
      }),
    )
    .min(2)
    .max(8),
});
export type DraftStoryboardOutput = z.infer<typeof DraftStoryboardOutput>;
