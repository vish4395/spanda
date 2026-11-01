import { z } from 'zod';
import { StorySpecSchema } from './story-spec.ts';

/** JSON Schema generated from the Zod source of truth (committed at schemas/story-spec.schema.json). */
export function storySpecJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(StorySpecSchema, { target: 'draft-2020-12', io: 'input' }),
    $id: 'https://example.invalid/schemas/story-spec.schema.json',
    title: 'AI Cinematic Studio StorySpec MVP',
    description: 'GENERATED from packages/contracts/src/story-spec.ts — run `pnpm --filter @studio/contracts schema:write`. Cross-field rules (unique ids, asset references) are enforced by the Zod validator only.',
  };
}

export function serializeJsonSchema(): string {
  return `${JSON.stringify(storySpecJsonSchema(), null, 2)}\n`;
}
