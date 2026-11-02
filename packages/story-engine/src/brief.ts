import type { CreativeBrief, CreativeDirection, DiscoveryAnswer } from '@studio/contracts';
import { resolved } from './discovery.ts';

const TONE_WORDS: Record<string, string> = { warm: 'Warm and inviting', elegant: 'Calm and elegant', bold: 'Bold and energetic', mysterious: 'Mysterious and dramatic' };
const CHAPTERS: Record<string, number> = { short: 1, standard: 3, long: 5 };

/** Editable starting brief from discovery answers (no AI involved). */
export function draftBrief(answers: Record<string, DiscoveryAnswer>, directions: CreativeDirection[]): CreativeBrief {
  const motion = resolved(answers, 'motion') as CreativeBrief['motion'];
  return {
    audience: '',
    tone: TONE_WORDS[resolved(answers, 'tone')] ?? 'Warm and inviting',
    directionId: directions[0]!.id,
    direction: directions[0]!,
    motion,
    chapters: CHAPTERS[resolved(answers, 'length')] ?? 3,
    notes: '',
    approved: false,
    approvedAt: null,
  };
}
