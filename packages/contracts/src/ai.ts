import { z } from 'zod';

// AI provider settings. The studio drives the user's own, locally installed
// official CLIs; it never sees or stores their credentials.

export const AiProviderId = z.enum(['claude-code', 'codex']);
export type AiProviderId = z.infer<typeof AiProviderId>;

/** A provider, or `none` for the local (no-AI) path. */
export const AiChoice = z.enum(['claude-code', 'codex', 'none']);
export type AiChoice = z.infer<typeof AiChoice>;

/** Workflow steps that can use AI; each may override the default provider. */
export const AI_STEPS = ['kickoff', 'direction', 'brief', 'storyboard', 'scene', 'chat', 'research'] as const;
export const AiStep = z.enum(AI_STEPS);
export type AiStep = z.infer<typeof AiStep>;

export const AI_STEP_LABELS: Record<AiStep, string> = {
  kickoff: 'Project plan and questions',
  direction: 'Art directions',
  brief: 'Creative brief',
  storyboard: 'Storyboard',
  scene: 'Scene edits',
  chat: 'Studio chat',
  research: 'Deep research',
};

/** Guided: plain language, one next step at a time. Pro: every control, IDs, logs and history. */
export const Experience = z.enum(['guided', 'pro']);
export type Experience = z.infer<typeof Experience>;

export const StudioSettings = z.object({
  /** First-run setup finished (provider chosen or skipped). */
  onboarded: z.boolean(),
  experience: Experience.default('guided'),
  /** Default provider for every AI step. */
  provider: AiChoice,
  /** Per-step overrides of `provider`. */
  steps: z.partialRecord(AiStep, AiChoice),
  /** Opt-in: allow web search and page fetches during deep research. */
  deepResearch: z.boolean(),
});
export type StudioSettings = z.infer<typeof StudioSettings>;
export type StudioSettingsInput = z.input<typeof StudioSettings>;

export const DEFAULT_SETTINGS: StudioSettings = { onboarded: false, experience: 'guided', provider: 'none', steps: {}, deepResearch: false };

/** The provider a step uses, after overrides. */
export function providerForStep(settings: StudioSettings, step: AiStep): AiChoice {
  return settings.steps[step] ?? settings.provider;
}

/** Provenance recorded with every AI result. */
export const AiProvenance = z.object({
  provider: AiProviderId,
  /** Model names the CLI reported, when it reports them. */
  models: z.array(z.string()).max(8),
  task: z.string().max(64),
  promptHash: z.string().regex(/^[0-9a-f]{64}$/),
  skills: z.array(z.string()).max(8),
  costUsd: z.number().nonnegative().nullable(),
  createdAt: z.string(),
});
export type AiProvenance = z.infer<typeof AiProvenance>;
