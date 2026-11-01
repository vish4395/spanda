// `pnpm licenses:check` — license gate for the studio workspace and export templates.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePackages, packagesFromLockfile, packagesFromPnpmStore, type LicenseReport } from './index.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));

// Reviewed exceptions: package@version -> reason. Each needs evidence and an owner.
const REVIEWED: Record<string, string> = {};

function summarize(label: string, report: LicenseReport): boolean {
  const pending = report.findings.filter((f) => f.verdict !== 'allowed' && !REVIEWED[`${f.name}@${f.version}`]);
  const status = pending.some((f) => f.verdict === 'blocked') ? 'blocked' : pending.length ? 'review_required' : 'passed';
  console.log(`\n${label}: ${report.findings.length} packages — ${status.toUpperCase()}`);
  console.log(`  allowed ${report.counts.allowed}, review_required ${report.counts.review_required}, blocked ${report.counts.blocked}`);
  for (const f of pending) console.log(`  [${f.verdict}] ${f.name}@${f.version} (${f.license ?? 'no license field'}) scope=${f.scope}`);
  return status !== 'blocked';
}

const studio = evaluatePackages(await packagesFromPnpmStore(root));
const reactLock = JSON.parse(await readFile(path.join(root, 'packages/generator-react/template/package-lock.json'), 'utf8'));
const reactExport = evaluatePackages(packagesFromLockfile(reactLock));
const threePkg = JSON.parse(await readFile(path.join(root, 'packages/generator-html/node_modules/three/package.json'), 'utf8'));
const htmlExport = evaluatePackages([{ name: 'three', version: threePkg.version, license: threePkg.license, scope: 'runtime' }]);

const ok = [
  summarize('Studio workspace (dev + desktop runtime)', studio),
  summarize('React export template (package-lock.json)', reactExport),
  summarize('HTML export vendored code', htmlExport),
].every(Boolean);

await mkdir(path.join(root, 'licenses'), { recursive: true });
const inventory = {
  policy: 'docs/07-LICENSING-SECURITY.md',
  note: 'Engineering license gate, not legal advice. review_required items need a recorded human decision.',
  studio: studio.findings,
  reactExport: reactExport.findings,
  htmlExport: htmlExport.findings,
  reviewedExceptions: REVIEWED,
};
await writeFile(path.join(root, 'licenses/inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
console.log('\nWrote licenses/inventory.json');
if (!ok) {
  console.error('License gate FAILED: blocked licenses present.');
  process.exit(1);
}
