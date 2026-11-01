// `pnpm --filter @studio/skills pin -- <skill-id> --reviewer "<name>" [--approve-scripts]`
// Records the reviewed content hash. Run only after a human has read the skill.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCKFILE, loadSkill, readLock } from './registry.ts';

const root = fileURLToPath(new URL('../../../skills/', import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== '--');
const id = args[0];
const reviewerIndex = args.indexOf('--reviewer');
const reviewer = reviewerIndex >= 0 ? args[reviewerIndex + 1] : undefined;
if (!id || !reviewer) {
  console.error('Usage: pin <skill-id> --reviewer "<name>" [--approve-scripts]');
  process.exit(1);
}
const lock = await readLock(root);
const { manifest } = await loadSkill(path.join(root, id), lock);
lock[id] = { version: manifest.version, hash: manifest.hash, scriptsApproved: args.includes('--approve-scripts'), reviewedBy: reviewer, reviewedAt: new Date().toISOString().slice(0, 10) };
const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(path.join(root, LOCKFILE), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Pinned ${id}@${manifest.version} ${manifest.hash.slice(0, 12)}… (scripts: ${manifest.hasScripts ? (lock[id].scriptsApproved ? 'approved' : 'NOT approved') : 'none'})`);
