import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { StorySpec } from '@studio/contracts';
import { evaluatePackages, packagesFromLockfile, type CommercialStatus, type LicenseReport, type PackageLicense } from '@studio/licensing';
import { createZip, type ZipEntry } from './zip.ts';

export type ExportTarget = 'html' | 'react';

export interface ExportInput {
  spec: StorySpec;
  /** Generated output directory per selected target (`output/html`, `output/react`). */
  outputs: Partial<Record<ExportTarget, string>>;
  studioVersion: string;
}

export interface ExportResult {
  zip: Buffer;
  files: number;
  bytes: number;
  licenses: CommercialStatus;
  /** Rights status of user assets: unknown rights mean the export is not commercial-ready. */
  rights: 'passed' | 'review_required';
  specHash: string;
}

/** A reason the export was refused; the message is written for the person exporting. */
export class ExportError extends Error {}

const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const LABEL: Record<ExportTarget, string> = { html: 'HTML', react: 'React' };
/** Where each generator records the StorySpec it was built from. */
const SPEC_FILE: Record<ExportTarget, string> = { html: 'story-spec.json', react: 'src/story-spec.json' };

/** Exported website code is MIT-0 (AGENTS.md rule 14): no attribution or other obligation. */
const MIT0 = `MIT No Attribution

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

/** Recursively list regular files, skipping dotfiles, symlinks and the given directory names. */
async function listFiles(root: string, skipDirs: Set<string>, rel = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    const info = await lstat(path.join(root, child));
    if (info.isSymbolicLink()) continue; // never follow links out of the output folder
    if (info.isDirectory()) {
      if (!skipDirs.has(child)) out.push(...(await listFiles(root, skipDirs, child)));
    } else if (info.isFile()) {
      out.push(child);
    }
  }
  return out;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Deterministic RFC 4122-shaped serial number derived from the content hash (reproducible SBOMs). */
function serialFrom(hash: string): string {
  const h = hash.slice(0, 32).split('');
  h[12] = '5';
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `urn:uuid:${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function cycloneDx(spec: StorySpec, specHash: string, packages: (PackageLicense & { target: ExportTarget })[]) {
  const seen = new Set<string>();
  const components = packages
    .filter((p) => {
      const key = `${p.name}@${p.version}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
    .map((p) => ({
      type: 'library',
      'bom-ref': `pkg:npm/${p.name}@${p.version}`,
      name: p.name,
      version: p.version,
      purl: `pkg:npm/${p.name.replace(/^@/, '%40')}@${p.version}`,
      scope: p.scope === 'runtime' ? 'required' : 'excluded',
      ...(p.license ? { licenses: /\s(OR|AND)\s/.test(p.license) ? [{ expression: p.license }] : [{ license: { id: p.license } }] } : {}),
    }));
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: serialFrom(sha256(`${specHash}:${components.map((c) => c['bom-ref']).join(',')}`)),
    version: 1,
    metadata: { component: { type: 'application', 'bom-ref': spec.project.id, name: spec.project.name, version: specHash.slice(0, 12) } },
    components,
  };
}

/**
 * Build a downloadable export (T024) from already generated outputs. Refuses when an
 * output is missing or stale, when any dependency license is blocked, or when an asset's
 * rights are blocked — the export must never be less honest than the studio.
 */
export async function buildExport(input: ExportInput): Promise<ExportResult> {
  const targets = (['html', 'react'] as const).filter((t) => input.outputs[t]);
  if (!targets.length) throw new ExportError('Choose at least one target to export.');
  const specText = `${JSON.stringify(input.spec, null, 2)}\n`;
  const specHash = sha256(specText);
  const entries: ZipEntry[] = [];
  const reports: Partial<Record<ExportTarget, LicenseReport>> = {};
  const packages: (PackageLicense & { target: ExportTarget })[] = [];
  const notices: string[] = [];
  let total = 0;

  for (const target of targets) {
    const dir = input.outputs[target]!;
    const built = await readJson<unknown>(path.join(dir, ...SPEC_FILE[target].split('/')));
    if (built === null) throw new ExportError(`There is no ${LABEL[target]} output yet. Generate the project first.`);
    if (!isDeepStrictEqual(built, JSON.parse(specText))) throw new ExportError(`The ${LABEL[target]} output is out of date with the StorySpec. Generate again before exporting.`);

    let targetPackages: PackageLicense[];
    if (target === 'react') {
      // Source only (the lockfile reproduces node_modules), but the build must have succeeded.
      try {
        await lstat(path.join(dir, 'dist', 'index.html'));
      } catch {
        throw new ExportError('The React project has not been built successfully. Generate again before exporting.');
      }
      const lock = await readJson<{ packages: Record<string, { version?: string; license?: string; dev?: boolean }> }>(path.join(dir, 'package-lock.json'));
      if (!lock) throw new ExportError('The React project has no package-lock.json. Generate again before exporting.');
      targetPackages = packagesFromLockfile(lock);
      const full = await readFile(path.join(dir, 'dist', 'THIRD_PARTY_NOTICES.md'), 'utf8').catch(() => null);
      notices.push(`# React export\n\n${(full ?? (await readFile(path.join(dir, 'THIRD_PARTY_NOTICES.md'), 'utf8'))).replace(/^# .*\n/, '').trim()}`);
    } else {
      const three = await readJson<{ name: string; version: string; license: string }>(path.join(dir, 'vendor', 'three', 'package.json'));
      if (!three) throw new ExportError('The HTML output is missing its vendored three.js manifest. Generate again before exporting.');
      targetPackages = [{ name: three.name, version: three.version, license: three.license, scope: 'runtime' }];
      notices.push(`# HTML export\n\n${(await readFile(path.join(dir, 'THIRD_PARTY_NOTICES.md'), 'utf8')).replace(/^# .*\n/, '').trim()}`);
    }

    const report = evaluatePackages(targetPackages);
    if (report.status === 'blocked') {
      const blocked = report.findings.filter((f) => f.verdict === 'blocked').map((f) => `${f.name}@${f.version} (${f.license ?? 'no license'})`);
      throw new ExportError(`The ${LABEL[target]} export includes dependencies with blocked licenses: ${blocked.join(', ')}.`);
    }
    reports[target] = report;
    packages.push(...targetPackages.map((p) => ({ ...p, target })));

    const skip = target === 'react' ? new Set(['node_modules', 'dist']) : new Set<string>();
    for (const file of await listFiles(dir, skip)) {
      const data = await readFile(path.join(dir, file));
      total += data.length;
      if (total > MAX_TOTAL_BYTES) throw new ExportError('The export is larger than 512 MB.');
      entries.push({ path: `${target}/${file}`, data });
    }
  }

  // Asset rights (docs/07): blocked rights refuse the export; unknown rights are reported, not hidden.
  const blockedAssets = input.spec.assets.filter((a) => a.rightsStatus === 'blocked');
  if (blockedAssets.length) throw new ExportError(`These assets have blocked rights and cannot be exported: ${blockedAssets.map((a) => a.id).join(', ')}.`);
  const unknownAssets = input.spec.assets.filter((a) => a.rightsStatus === 'unknown');
  const rights = unknownAssets.length ? 'review_required' : 'passed';
  const statuses = Object.values(reports).map((r) => r!.status);
  const licenses: CommercialStatus = statuses.includes('review_required') ? 'review_required' : 'passed';

  const name = input.spec.project.name;
  const runHtml = targets.includes('html')
    ? '### HTML (`html/`)\nNo build step. ES modules do not load from `file://`, so serve the folder with any static server:\n\n```sh\ncd html\npython3 -m http.server 8080\n```\n\nUpload the `html/` folder to any static host; all paths are relative.\n'
    : '';
  const runReact = targets.includes('react')
    ? '### React (`react/`)\nNode.js 20.19 or newer (required by Vite 7). Dependencies are pinned in `package-lock.json`.\n\n```sh\ncd react\nnpm ci\nnpm run build    # static site in react/dist\nnpm run dev      # local development server\n```\n\nHost the `react/dist` folder on any static host.\n'
    : '';
  const statusLine = (s: string) => (s === 'passed' ? 'passed' : 'needs review');
  const readme = `# ${name} — website export

${input.spec.project.goal}

Exported by Spanda Studio ${input.studioVersion}. Targets: ${targets.map((t) => LABEL[t]).join(' and ')}.
Each target is a separate, native implementation of the same StorySpec; neither depends on the studio.

## Run and host
${runHtml}${runHtml && runReact ? '\n' : ''}${runReact}
## What is inside
| Path | Contents |
|---|---|
${targets.map((t) => `| \`${t}/\` | ${t === 'html' ? 'Static HTML, CSS and ES modules with vendored three.js' : 'Vite + React + TypeScript + React Three Fiber project source'} |`).join('\n')}
| \`LICENSES.md\` | License of the generated code (MIT-0) and of everything else in this export |
| \`THIRD_PARTY_NOTICES.md\` | Third-party packages and their license texts |
| \`ASSET_CREDITS.md\` | Images, models, fonts and other assets, with their rights status |
| \`sbom.cdx.json\` | Software bill of materials (CycloneDX 1.5) |
| \`metadata/\` | The StorySpec, license report and asset provenance this export was built from |

## License check
- Dependency licenses: **${statusLine(licenses)}** (policy: permissive licenses allowed; copyleft or unknown licenses blocked).
- Asset rights: **${statusLine(rights)}**${unknownAssets.length ? ` — ${unknownAssets.length} asset(s) have unknown rights; confirm or replace them before commercial use` : ''}.

This is an automated engineering check against recorded license metadata, not legal advice.

StorySpec SHA-256: \`${specHash}\`
`;

  const assetCredits = input.spec.assets.length
    ? `# Asset credits\n\n| Asset | Kind | Rights | License | Source |\n|---|---|---|---|---|\n${input.spec.assets.map((a) => `| ${a.id} | ${a.kind} | ${a.rightsStatus} | ${a.license ?? '—'} | ${a.sourceUrl ?? '—'} |`).join('\n')}\n`
    : '# Asset credits\n\nThis export contains no third-party images, models, video, audio or font files. Visuals are procedural and generated in code. Typography uses the font stacks named in the StorySpec; no font files are bundled.\n';

  const licensesMd = `# Licenses

## Generated website code
The HTML, CSS, JavaScript and TypeScript generated for this site, including the studio's templates and runtime helpers,
is provided under MIT No Attribution (MIT-0): use, change and ship it without attribution.

\`\`\`
${MIT0.trim()}
\`\`\`

## Your content
The words, story and design choices in the StorySpec are the project author's own.

## Third-party code
Libraries such as three.js and React keep their own licenses; see \`THIRD_PARTY_NOTICES.md\` and \`sbom.cdx.json\`.
`;

  entries.push(
    { path: 'README.md', data: Buffer.from(readme) },
    { path: 'LICENSES.md', data: Buffer.from(licensesMd) },
    { path: 'THIRD_PARTY_NOTICES.md', data: Buffer.from(`# Third-party notices\n\n${notices.join('\n\n')}\n`) },
    { path: 'ASSET_CREDITS.md', data: Buffer.from(assetCredits) },
    { path: 'sbom.cdx.json', data: Buffer.from(`${JSON.stringify(cycloneDx(input.spec, specHash, packages), null, 2)}\n`) },
    { path: 'metadata/story-spec.json', data: Buffer.from(specText) },
    { path: 'metadata/licenses.json', data: Buffer.from(`${JSON.stringify({ status: licenses, targets: reports }, null, 2)}\n`) },
    { path: 'metadata/asset-provenance.json', data: Buffer.from(`${JSON.stringify({ status: rights, assets: input.spec.assets }, null, 2)}\n`) },
  );

  const zip = createZip(entries);
  return { zip, files: entries.length, bytes: zip.length, licenses, rights, specHash };
}
