import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PackageLicense } from './policy.ts';

interface Manifest {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  licenses?: { type?: string }[];
}

function licenseOf(manifest: Manifest): string | null {
  if (typeof manifest.license === 'string') return manifest.license;
  if (manifest.license && typeof manifest.license === 'object' && manifest.license.type) return manifest.license.type;
  if (Array.isArray(manifest.licenses) && manifest.licenses.length) {
    return manifest.licenses.map((l) => l.type).filter(Boolean).join(' OR ') || null;
  }
  return null;
}

/** Packages recorded in an npm v3 lockfile (exports are installed from these). */
export function packagesFromLockfile(lock: { packages: Record<string, { version?: string; license?: string; dev?: boolean }> }): PackageLicense[] {
  return Object.entries(lock.packages)
    .filter(([key]) => key.startsWith('node_modules/'))
    .map(([key, pkg]) => ({
      name: key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length),
      version: pkg.version ?? 'unknown',
      license: pkg.license ?? null,
      scope: pkg.dev ? ('build' as const) : ('runtime' as const),
    }));
}

/** Every package in a pnpm virtual store (`node_modules/.pnpm`). */
export async function packagesFromPnpmStore(workspaceRoot: string): Promise<PackageLicense[]> {
  const store = path.join(workspaceRoot, 'node_modules', '.pnpm');
  const out = new Map<string, PackageLicense>();
  for (const entry of await readdir(store, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const nm = path.join(store, entry.name, 'node_modules');
    let names: string[];
    try {
      names = await readdir(nm);
    } catch {
      continue;
    }
    for (const name of names) {
      const dirs = name.startsWith('@') ? (await readdir(path.join(nm, name))).map((n) => `${name}/${n}`) : [name];
      for (const pkgName of dirs) {
        try {
          const manifest = JSON.parse(await readFile(path.join(nm, pkgName, 'package.json'), 'utf8')) as Manifest;
          if (manifest.name !== pkgName || !manifest.version) continue;
          // Only count the package this store entry is for, not its symlinked deps.
          const storeKey = entry.name.replace(/\+/g, '/');
          if (!storeKey.startsWith(`${pkgName}@`)) continue;
          out.set(`${pkgName}@${manifest.version}`, { name: pkgName, version: manifest.version, license: licenseOf(manifest), scope: 'build' });
        } catch {
          // not a package directory
        }
      }
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

const LICENSE_FILES = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

/**
 * Full-text notices for runtime packages of an installed export
 * (reads LICENSE/NOTICE files from node_modules after `npm ci`).
 */
export async function collectRuntimeNotices(projectDir: string): Promise<string> {
  const lock = JSON.parse(await readFile(path.join(projectDir, 'package-lock.json'), 'utf8'));
  const runtime = packagesFromLockfile(lock).filter((p) => p.scope === 'runtime');
  const sections: string[] = [];
  for (const pkg of runtime.sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = path.join(projectDir, 'node_modules', ...pkg.name.split('/'));
    let texts: string[] = [];
    try {
      const files = (await readdir(dir)).filter((f) => LICENSE_FILES.test(f)).sort();
      texts = await Promise.all(files.map(async (f) => (await readFile(path.join(dir, f), 'utf8')).trim()));
    } catch {
      // handled below
    }
    sections.push(
      `## ${pkg.name} ${pkg.version} (${pkg.license ?? 'UNKNOWN'})\n\n${texts.length ? texts.map((t) => `\`\`\`\n${t}\n\`\`\``).join('\n\n') : '_License text not found in package — see the package repository._'}`,
    );
  }
  return `# Third-party notices\n\nRuntime packages bundled into this site and their license texts.\n\n${sections.join('\n\n')}\n`;
}
