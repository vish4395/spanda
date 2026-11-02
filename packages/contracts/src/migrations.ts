import { LEGACY_DESIGN_STYLE, STORY_SPEC_VERSION, validateStorySpec, type ValidationResult } from './story-spec.ts';

// StorySpec migrations (docs/04 "Evolution"): each step upgrades one schemaVersion
// to the next. Steps must preserve scene IDs so approved scenes survive upgrades.

export interface SpecMigration {
  from: string;
  to: string;
  migrate(input: Record<string, unknown>): Record<string, unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 0.1.0 → 0.2.0: add the design language with the values that reproduce the 0.1.0 look. */
const addDesignLanguage: SpecMigration = {
  from: '0.1.0',
  to: '0.2.0',
  migrate(input) {
    const design = isRecord(input.design) ? input.design : {};
    const colors = isRecord(design.colors) ? design.colors : {};
    return {
      ...input,
      schemaVersion: '0.2.0',
      design: { ...design, colors: { ...colors, secondary: colors.secondary ?? colors.accent }, style: design.style ?? { ...LEGACY_DESIGN_STYLE } },
    };
  },
};

/** Registered migrations, oldest first. */
export const MIGRATIONS: readonly SpecMigration[] = [addDesignLanguage];

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
