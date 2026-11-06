import { z } from 'zod';

// Shapes AI providers must return for each workflow task. They are deliberately
// small and text-only; the studio sanitizes every value before storing it.

const Line = (max: number) => z.string().trim().min(1).max(max);

/** The studio's four core choices; a plan sets their starting values. */
export const CoreChoices = z.object({
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
