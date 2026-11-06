import type { CreativeDirection, DiscoveryAnswer, DiscoveryQuestion, ProjectPlan } from '@studio/contracts';
import { generateDirections, type DirectionOptions } from './directions.ts';
import { LOOK_FOR_TONE, lookQuestion } from './looks.ts';

// Visual discovery (FR-02): at most one focused question at a time, 2–4 options,
// always skippable. Deterministic so the flow works without any AI provider.

export const QUESTIONS: readonly DiscoveryQuestion[] = [
  lookQuestion(),
  {
    id: 'tone',
    reason: 'Tone decides colour temperature, typography and pacing.',
    prompt: 'How should the story feel?',
    default: 'warm',
    options: [
      { id: 'warm', label: 'Warm and inviting', explanation: 'Golden light, soft contrast, human pacing.' },
      { id: 'elegant', label: 'Calm and elegant', explanation: 'Quiet neutrals, generous space, restrained motion.' },
      { id: 'bold', label: 'Bold and energetic', explanation: 'High contrast, vivid accent, confident motion.' },
      { id: 'mysterious', label: 'Mysterious and dramatic', explanation: 'Deep shadows, slow reveals, cinematic tension.' },
    ],
  },
  {
    id: 'subject',
    reason: 'The visual subject sets what the 3D layer and imagery focus on.',
    prompt: 'What should the visuals focus on?',
    default: 'place',
    options: [
      { id: 'place', label: 'A place or environment', explanation: 'Landscapes, spaces and atmosphere.' },
      { id: 'object', label: 'A product or object', explanation: 'One hero object shown from several angles.' },
      { id: 'abstract', label: 'Abstract shapes', explanation: 'Geometry and light that suggest the idea.' },
      { id: 'type', label: 'Words and typography', explanation: 'Editorial, type-led storytelling.' },
    ],
  },
  {
    id: 'motion',
    reason: 'Motion intensity affects comfort, performance and accessibility.',
    prompt: 'How much motion do you want?',
    default: 'balanced',
    options: [
      { id: 'calm', label: 'Calm', explanation: 'Gentle fades; easiest on all devices.' },
      { id: 'balanced', label: 'Balanced', explanation: 'Scroll reveals with a moving 3D hero.' },
      { id: 'bold', label: 'Bold', explanation: 'Stronger reveals and a more present 3D scene.' },
    ],
  },
  {
    id: 'length',
    reason: 'Story length sets how many chapters the storyboard starts with.',
    prompt: 'How long should the story be?',
    default: 'standard',
    options: [
      { id: 'short', label: 'Short', explanation: 'Hero plus one chapter.' },
      { id: 'standard', label: 'Standard', explanation: 'Hero plus three chapters.' },
      { id: 'long', label: 'Long', explanation: 'Hero plus five chapters.' },
    ],
  },
];

/** The questions a project asks: its AI plan's, or the studio's fixed set. */
export function questionsOf(plan: ProjectPlan | null | undefined): readonly DiscoveryQuestion[] {
  if (!plan?.questions.length) return QUESTIONS;
  return [lookQuestion(plan.core.look, plan.core.look ? `It suits a ${plan.projectType.toLowerCase()}.` : undefined), ...plan.questions];
}

/** The choices that shape directions, brief and planner (a plan's starting values, else the fixed questions). */
const CORE_IDS = ['look', 'tone', 'subject', 'motion', 'length'];

export function nextQuestion(answers: Record<string, DiscoveryAnswer>, questions: readonly DiscoveryQuestion[] = QUESTIONS): DiscoveryQuestion | null {
  return questions.find((q) => !(q.id in answers)) ?? null;
}

export function isValidAnswer(questionId: string, answer: DiscoveryAnswer, questions: readonly DiscoveryQuestion[] = QUESTIONS): boolean {
  const q = questions.find((x) => x.id === questionId);
  if (!q) return false;
  return answer === 'skip' || answer === 'ai-decide' || q.options.some((o) => o.id === answer);
}

/**
 * Answers for the four core choices: the AI plan's starting values, overridden by
 * any core question the user answered with a concrete option.
 */
export function effectiveAnswers(answers: Record<string, DiscoveryAnswer>, plan: ProjectPlan | null | undefined): Record<string, DiscoveryAnswer> {
  const out: Record<string, DiscoveryAnswer> = { ...answers };
  if (plan) {
    for (const id of Object.keys(out)) if (!CORE_IDS.includes(id) || out[id] === 'skip' || out[id] === 'ai-decide') delete out[id];
    for (const [id, value] of Object.entries(plan.core)) if (value !== undefined && !(id in out)) out[id] = value;
  }
  // The look: a concrete choice, else "You decide" (the plan's pick, or one that suits the tone); "Skip" means no particular look.
  const look = answers.look;
  if (look === 'ai-decide') out.look = plan?.core.look ?? LOOK_FOR_TONE[resolved(out, 'tone')] ?? 'cinematic-story';
  else if (look === 'skip' || (look === undefined && !plan?.core.look)) delete out.look;
  return out;
}

/** The plan's questions with the user's answers as readable text, for AI prompts. */
export function discoveryNotes(answers: Record<string, DiscoveryAnswer>, plan: ProjectPlan | null | undefined): { question: string; answer: string }[] {
  if (!plan) return [];
  return plan.questions.flatMap((q) => {
    const a = answers[q.id];
    if (!a || a === 'skip') return [];
    const id = a === 'ai-decide' ? q.default : a;
    const option = q.options.find((o) => o.id === id);
    return option ? [{ question: q.prompt, answer: `${option.label} — ${option.explanation}` }] : [];
  });
}

/** Resolve an answer to a concrete option (skip and "you decide" use the question default). */
export function resolved(answers: Record<string, DiscoveryAnswer>, questionId: string): string {
  const q = QUESTIONS.find((x) => x.id === questionId)!;
  if (!q) return answers[questionId] ?? '';
  const a = answers[questionId];
  return a && a !== 'skip' && a !== 'ai-decide' ? a : q.default;
}

/** Three generated, accessible and clearly different art directions (see directions.ts). */
export function directionsFor(answers: Record<string, DiscoveryAnswer>, options: DirectionOptions = {}): CreativeDirection[] {
  return generateDirections(answers, options);
}
