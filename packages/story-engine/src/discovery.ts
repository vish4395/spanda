import type { CreativeDirection, DiscoveryAnswer, DiscoveryQuestion } from '@studio/contracts';

// Visual discovery (FR-02): at most one focused question at a time, 2–4 options,
// always skippable. Deterministic so the flow works without any AI provider.

export const QUESTIONS: readonly DiscoveryQuestion[] = [
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

export function nextQuestion(answers: Record<string, DiscoveryAnswer>): DiscoveryQuestion | null {
  return QUESTIONS.find((q) => !(q.id in answers)) ?? null;
}

export function isValidAnswer(questionId: string, answer: DiscoveryAnswer): boolean {
  const q = QUESTIONS.find((x) => x.id === questionId);
  if (!q) return false;
  return answer === 'skip' || answer === 'ai-decide' || q.options.some((o) => o.id === answer);
}

/** Resolve an answer to a concrete option (skip and "you decide" use the question default). */
export function resolved(answers: Record<string, DiscoveryAnswer>, questionId: string): string {
  const q = QUESTIONS.find((x) => x.id === questionId)!;
  const a = answers[questionId];
  return a && a !== 'skip' && a !== 'ai-decide' ? a : q.default;
}

// Original direction presets. Foreground/background pairs are ≥ 12:1; accents ≥ 4.5:1 on background.
const DIRECTIONS: readonly (CreativeDirection & { tones: string[] })[] = [
  { id: 'ember-archive', name: 'Ember Archive', description: 'Charcoal night with candle-gold accents; warm, human and timeless.', colors: { background: '#12100e', foreground: '#f5efe6', accent: '#e0a458' }, typography: { heading: 'Georgia, serif', body: 'system-ui' }, motion: 'balanced', tones: ['warm', 'mysterious'] },
  { id: 'polar-gallery', name: 'Polar Gallery', description: 'Ink-blue calm with frost highlights; spacious and precise.', colors: { background: '#0c1118', foreground: '#eef3f8', accent: '#8fc3ff' }, typography: { heading: 'system-ui', body: 'system-ui' }, motion: 'calm', tones: ['elegant'] },
  { id: 'signal-noir', name: 'Signal Noir', description: 'Near-black stage with an electric coral signal; confident and fast.', colors: { background: '#0b0b0d', foreground: '#fafafa', accent: '#ff6b5b' }, typography: { heading: 'system-ui', body: 'system-ui' }, motion: 'bold', tones: ['bold'] },
  { id: 'verdant-dusk', name: 'Verdant Dusk', description: 'Forest-dark green with moss light; grounded and atmospheric.', colors: { background: '#0d1310', foreground: '#eef4ee', accent: '#9fd49a' }, typography: { heading: 'Georgia, serif', body: 'system-ui' }, motion: 'calm', tones: ['elegant', 'warm'] },
  { id: 'violet-hour', name: 'Violet Hour', description: 'Deep plum dark with lilac glow; dreamy and cinematic.', colors: { background: '#110e17', foreground: '#f3effa', accent: '#b9a2ff' }, typography: { heading: 'system-ui', body: 'system-ui' }, motion: 'balanced', tones: ['mysterious', 'bold'] },
];

/** Three directions ordered by fit with the chosen tone. */
export function directionsFor(answers: Record<string, DiscoveryAnswer>): CreativeDirection[] {
  const tone = resolved(answers, 'tone');
  return [...DIRECTIONS]
    .sort((a, b) => Number(b.tones.includes(tone)) - Number(a.tones.includes(tone)) || DIRECTIONS.indexOf(a) - DIRECTIONS.indexOf(b))
    .slice(0, 3)
    .map(({ tones: _tones, ...direction }) => direction);
}

export function allDirections(): CreativeDirection[] {
  return DIRECTIONS.map(({ tones: _tones, ...d }) => d);
}
