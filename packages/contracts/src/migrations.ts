import { STORY_SPEC_VERSION, validateStorySpec, type ValidationResult } from './story-spec.ts';

// StorySpec migrations (docs/04 "Evolution"): each step upgrades one schemaVersion
// to the next. Steps must preserve scene IDs so approved scenes survive upgrades.

export interface SpecMigration {
  from: string;
  to: string;
  migrate(input: Record<string, unknown>): Record<string, unknown>;
}

/** Registered migrations, oldest first. Empty while 0.1.0 is the only released version. */
export const MIGRATIONS: readonly SpecMigration[] = [];

export type MigrationResult =
  | { ok: true; value: Record<string, unknown>; applied: string[] }
  | { ok: false; error: string; applied: string[] };

export function migrateStorySpec(input: unknown, migrations: readonly SpecMigration[] = MIGRATIONS, target = STORY_SPEC_VERSION): MigrationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'StorySpec must be a JSON object', applied: [] };
  }
  let value = structuredClone(input) as Record<string, unknown>;
  const applied: string[] = [];
  const seen = new Set<string>();
  while (value.schemaVersion !== target) {
    const version = String(value.schemaVersion ?? '(missing)');
    if (seen.has(version)) return { ok: false, error: `Migration cycle at schemaVersion ${version}`, applied };
    seen.add(version);
    const step = migrations.find((m) => m.from === version);
    if (!step) return { ok: false, error: `No migration path from schemaVersion ${version} to ${target}`, applied };
    value = step.migrate(structuredClone(value));
    if (value.schemaVersion !== step.to) {
      return { ok: false, error: `Migration ${step.from}→${step.to} produced schemaVersion ${String(value.schemaVersion)}`, applied };
    }
    applied.push(`${step.from}→${step.to}`);
  }
  return { ok: true, value, applied };
}

/** Migrate (if needed) then validate. Use this for anything read from disk or a provider. */
export function loadStorySpec(input: unknown, migrations?: readonly SpecMigration[]): ValidationResult & { migrated: string[] } {
  const migrated = migrateStorySpec(input, migrations);
  if (!migrated.ok) return { ok: false, issues: [{ path: 'schemaVersion', message: migrated.error }], migrated: migrated.applied };
  return { ...validateStorySpec(migrated.value), migrated: migrated.applied };
}
