import { DraftStoryboardOutput, type AiProviderId } from '@studio/contracts';
import { runAiTask, type AiRunOptions } from './ai-runner.ts';

/** Storyboard drafting (T015) through the chosen provider CLI; the caller sanitizes the scenes. */
export function draftStoryboardWithAi(provider: AiProviderId, prompt: string, options: AiRunOptions & { skills?: string[] } = {}) {
  return runAiTask(provider, { name: 'storyboard', prompt, schema: DraftStoryboardOutput, ...(options.skills ? { skills: options.skills } : {}) }, options);
}
