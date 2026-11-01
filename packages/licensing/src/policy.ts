// License policy from docs/07-LICENSING-SECURITY.md. This is an engineering
// gate, not legal advice: `review_required` means a human must decide.

export type LicenseVerdict = 'allowed' | 'review_required' | 'blocked';
export type CommercialStatus = 'passed' | 'review_required' | 'blocked';

const ALLOWED = new Set(['MIT', 'MIT-0', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0', 'Python-2.0', 'CC-BY-4.0', 'Zlib']);
const REVIEW = new Set(['MPL-2.0', 'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later', 'EPL-2.0', 'CC-BY-SA-4.0', 'Artistic-2.0']);
// Everything else — GPL/AGPL/SSPL, non-commercial, custom, missing — is blocked until reviewed.

/** Licenses that carry an attribution obligation we must surface in notices. */
export const ATTRIBUTION_REQUIRED = new Set(['CC-BY-4.0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'MIT', 'ISC']);

function single(id: string): LicenseVerdict {
  if (ALLOWED.has(id)) return 'allowed';
  if (REVIEW.has(id)) return 'review_required';
  return 'blocked';
}

const rank: Record<LicenseVerdict, number> = { allowed: 0, review_required: 1, blocked: 2 };

/** Evaluate a simple SPDX expression (`A OR B`, `A AND B`, parentheses not nested). */
export function evaluateLicense(expression: string | undefined | null): LicenseVerdict {
  if (!expression || !expression.trim()) return 'blocked';
  const expr = expression.trim().replace(/^\((.*)\)$/, '$1');
  if (/\bOR\b/.test(expr)) {
    return expr
      .split(/\s+OR\s+/)
      .map((part) => evaluateLicense(part))
      .reduce((best, v) => (rank[v] < rank[best] ? v : best), 'blocked' as LicenseVerdict);
  }
  if (/\bAND\b/.test(expr)) {
    return expr
      .split(/\s+AND\s+/)
      .map((part) => evaluateLicense(part))
      .reduce((worst, v) => (rank[v] > rank[worst] ? v : worst), 'allowed' as LicenseVerdict);
  }
  return single(expr.replace(/\+$/, ''));
}

export interface PackageLicense {
  name: string;
  version: string;
  license: string | null;
  scope: 'runtime' | 'build';
}

export interface LicenseFinding extends PackageLicense {
  verdict: LicenseVerdict;
}

export interface LicenseReport {
  status: CommercialStatus;
  findings: LicenseFinding[];
  counts: Record<LicenseVerdict, number>;
}

export function evaluatePackages(packages: PackageLicense[]): LicenseReport {
  const findings = packages.map((p) => ({ ...p, verdict: evaluateLicense(p.license) }));
  const counts = { allowed: 0, review_required: 0, blocked: 0 };
  for (const f of findings) counts[f.verdict] += 1;
  const status: CommercialStatus = counts.blocked ? 'blocked' : counts.review_required ? 'review_required' : 'passed';
  return { status, findings, counts };
}
