import { describe, expect, it } from 'vitest';
import { KickoffOutput } from '@studio/contracts';
import { discoveryNotes, effectiveAnswers, kickoffPrompt, nextQuestion, questionsOf, QUESTIONS, sanitizePlan } from '../src/index.ts';

const provenance = { provider: 'claude-code' as const, models: [], task: 'kickoff', promptHash: 'a'.repeat(64), skills: [], costUsd: null, createdAt: 'now' };
const raw = KickoffOutput.parse({
  projectType: 'Launch‮ page',
  summary: '  A   lamp  launch. ',
  facts: ['It is a lamp.'],
  assumptions: [],
  nextSteps: [{ title: 'One', detail: 'First.' }, { title: 'Two', detail: 'Second.' }],
  core: { tone: 'bold', subject: 'object', motion: 'bold', length: 'short' },
  questions: [
    { prompt: 'Q1?', reason: 'r', options: [{ label: 'A', explanation: 'a' }, { label: 'B', explanation: 'b' }], recommended: 3, why: 'w' },
    { prompt: 'Q2?', reason: 'r', options: [{ label: 'C', explanation: 'c' }, { label: 'D', explanation: 'd' }], recommended: 1, why: 'because' },
    { prompt: 'Q3?', reason: 'r', options: [{ label: 'E', explanation: 'e' }, { label: 'F', explanation: 'f' }], recommended: 0, why: 'w' },
  ],
});

describe('kickoff plan', () => {
  it('assigns safe ids, strips control characters and falls back to the first option for a bad recommendation', () => {
    const plan = sanitizePlan(raw, provenance);
    expect(plan.projectType).toBe('Launch page');
    expect(plan.summary).toBe('A lamp launch.');
    expect(plan.questions.map((q) => q.id)).toEqual(['q-1', 'q-2', 'q-3']);
    expect(plan.questions[0]).toMatchObject({ default: 'o-1', options: [{ id: 'o-1' }, { id: 'o-2' }] });
    expect(plan.questions[1]).toMatchObject({ default: 'o-2', why: 'because' });
    expect(questionsOf(plan)).toBe(plan.questions);
    expect(questionsOf(null)).toBe(QUESTIONS);
  });

  it('uses the plan for core choices unless the user picked one, and turns answers into prompt notes', () => {
    const plan = sanitizePlan(raw, provenance);
    expect(effectiveAnswers({ 'q-1': 'o-1' }, plan)).toEqual({ tone: 'bold', subject: 'object', motion: 'bold', length: 'short' });
    expect(effectiveAnswers({ motion: 'calm', tone: 'skip' }, plan)).toMatchObject({ motion: 'calm', tone: 'bold' });
    expect(effectiveAnswers({ tone: 'warm' }, null)).toEqual({ tone: 'warm' });
    expect(discoveryNotes({ 'q-1': 'o-2', 'q-2': 'ai-decide', 'q-3': 'skip' }, plan)).toEqual([
      { question: 'Q1?', answer: 'B — b' },
      { question: 'Q2?', answer: 'D — d' },
    ]);
    expect(nextQuestion({ 'q-1': 'o-1' }, plan.questions)?.id).toBe('q-2');
  });

  it('puts only the user’s own name and idea in the prompt', () => {
    const prompt = kickoffPrompt({ name: 'Halden "One"', idea: 'A lamp' });
    expect(prompt).toContain('Project name: "Halden \\"One\\""');
    expect(prompt).not.toContain('untrusted');
  });
});
