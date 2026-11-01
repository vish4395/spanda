import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeJsonSchema } from './json-schema.ts';

const target = fileURLToPath(new URL('../../../schemas/story-spec.schema.json', import.meta.url));
writeFileSync(target, serializeJsonSchema());
console.log(`wrote ${target}`);
