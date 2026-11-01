import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { JobSnapshot, JobStatus, OutputTarget, ProjectSummary, ProviderStatus, ProjectVersion } from '@studio/contracts';

// Local metadata store (docs/09). Built on Node's bundled SQLite so the same
// code runs on macOS, Windows, Linux and ChromeOS without native modules.
// File contents (specs, snapshots, exports) stay on disk; rows hold metadata.

const SCHEMA: readonly string[] = [
  // v1
  `CREATE TABLE projects (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     goal TEXT NOT NULL,
     output_targets TEXT NOT NULL DEFAULT '["html","react"]',
     status TEXT NOT NULL DEFAULT 'draft',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     last_opened_at TEXT
   );
   CREATE TABLE project_versions (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     parent_id TEXT REFERENCES project_versions(id),
     label TEXT NOT NULL,
     story_spec_hash TEXT NOT NULL,
     snapshot_path TEXT NOT NULL,
     created_at TEXT NOT NULL,
     approved INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX project_versions_by_project ON project_versions(project_id, created_at);
   CREATE TABLE jobs (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     targets TEXT NOT NULL,
     status TEXT NOT NULL,
     started_at TEXT NOT NULL,
     ended_at TEXT,
     error TEXT
   );
   CREATE INDEX jobs_by_project ON jobs(project_id, started_at);
   CREATE TABLE job_events (
     job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     sequence INTEGER NOT NULL,
     event_type TEXT NOT NULL,
     payload TEXT NOT NULL,
     created_at TEXT NOT NULL,
     PRIMARY KEY (job_id, sequence)
   );
   CREATE TABLE providers (
     id TEXT PRIMARY KEY,
     display_name TEXT NOT NULL,
     state TEXT NOT NULL,
     version TEXT,
     detail TEXT,
     last_probe_at TEXT NOT NULL
   );`,
  // v2: user settings (e.g. opt-in AI provider features)
  `CREATE TABLE settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
];

const MAX_EVENTS_PER_JOB = 2000;

const now = () => new Date().toISOString();

interface ProjectRow {
  id: string;
  name: string;
  goal: string;
  updated_at: string;
  last_opened_at: string | null;
}

interface VersionRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  label: string;
  story_spec_hash: string;
  snapshot_path: string;
  created_at: string;
  approved: number;
}

interface JobRow {
  id: string;
  project_id: string;
  targets: string;
  status: JobStatus;
  error: string | null;
}

export class StudioStore {
  private readonly db: DatabaseSync;

  private constructor(db: DatabaseSync) {
    this.db = db;
  }

  /** Open (or create) the database and apply pending schema migrations. */
  static open(file: string): StudioStore {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 2000;');
    const store = new StudioStore(db);
    store.migrate();
    return store;
  }

  get schemaVersion(): number {
    return (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  }

  private migrate(): void {
    const current = this.schemaVersion;
    if (current > SCHEMA.length) throw new Error(`Database schema v${current} is newer than this app (v${SCHEMA.length}). Update the studio.`);
    for (let v = current; v < SCHEMA.length; v += 1) {
      this.transaction(() => {
        this.db.exec(SCHEMA[v]!);
        this.db.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }

  // Projects ---------------------------------------------------------------

  upsertProject(project: { id: string; name: string; goal: string; targets?: OutputTarget[] }): void {
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO projects (id, name, goal, output_targets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, goal = excluded.goal, updated_at = excluded.updated_at`,
      )
      .run(project.id, project.name, project.goal, JSON.stringify(project.targets ?? ['html', 'react']), ts, ts);
  }

  hasProject(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id) !== undefined;
  }

  /** Most recently opened (or updated) first. */
  listProjects(): ProjectSummary[] {
    const rows = this.db
      .prepare('SELECT id, name, goal, updated_at, last_opened_at FROM projects ORDER BY COALESCE(last_opened_at, updated_at) DESC, name ASC')
      .all() as unknown as ProjectRow[];
    return rows.map((r) => ({ id: r.id, name: r.name, goal: r.goal, updatedAt: r.updated_at, lastOpenedAt: r.last_opened_at }));
  }

  touchProject(id: string): void {
    this.db.prepare('UPDATE projects SET last_opened_at = ? WHERE id = ?').run(now(), id);
  }

  setStage(id: string, stage: string): void {
    this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(stage, now(), id);
  }

  // Settings -----------------------------------------------------------------

  getSetting(key: string): string | null {
    return (this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  // Versions / snapshots -----------------------------------------------------

  addVersion(version: { id: string; projectId: string; parentId: string | null; label: string; hash: string; snapshotPath: string; approved?: boolean }): ProjectVersion {
    const createdAt = now();
    this.db
      .prepare('INSERT INTO project_versions (id, project_id, parent_id, label, story_spec_hash, snapshot_path, created_at, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(version.id, version.projectId, version.parentId, version.label, version.hash, version.snapshotPath, createdAt, version.approved ? 1 : 0);
    this.db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(createdAt, version.projectId);
    return this.getVersion(version.projectId, version.id)!;
  }

  getVersion(projectId: string, versionId: string): (ProjectVersion & { snapshotPath: string }) | undefined {
    const row = this.db.prepare('SELECT * FROM project_versions WHERE project_id = ? AND id = ?').get(projectId, versionId) as VersionRow | undefined;
    return row ? { ...toVersion(row), snapshotPath: row.snapshot_path } : undefined;
  }

  /** Newest first. */
  listVersions(projectId: string): ProjectVersion[] {
    const rows = this.db.prepare('SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC, rowid DESC').all(projectId) as unknown as VersionRow[];
    return rows.map(toVersion);
  }

  latestVersion(projectId: string): ProjectVersion | undefined {
    return this.listVersions(projectId)[0];
  }

  // Jobs ---------------------------------------------------------------------

  recordJobStart(job: JobSnapshot): void {
    this.db.prepare('INSERT INTO jobs (id, project_id, kind, targets, status, started_at) VALUES (?, ?, ?, ?, ?, ?)').run(job.id, job.projectId, job.kind, JSON.stringify(job.targets), job.status, now());
  }

  appendJobLog(jobId: string, line: string): void {
    const next = (this.db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM job_events WHERE job_id = ?').get(jobId) as { n: number }).n;
    if (next > MAX_EVENTS_PER_JOB) return;
    this.db.prepare('INSERT INTO job_events (job_id, sequence, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?)').run(jobId, next, 'log', line, now());
  }

  recordJobEnd(jobId: string, status: JobStatus, error: string | null): void {
    this.db.prepare('UPDATE jobs SET status = ?, error = ?, ended_at = ? WHERE id = ?').run(status, error, now(), jobId);
  }

  /** Jobs still marked running belong to a previous app session that ended abruptly. */
  markInterruptedJobs(): number {
    const result = this.db.prepare("UPDATE jobs SET status = 'failed', error = 'Interrupted: the studio closed while this job was running. Retry to continue.', ended_at = ? WHERE status = 'running'").run(now());
    return Number(result.changes);
  }

  listJobs(projectId: string, limit = 10): JobSnapshot[] {
    const rows = this.db.prepare('SELECT id, project_id, targets, status, error FROM jobs WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT ?').all(projectId, limit) as unknown as JobRow[];
    const logStmt = this.db.prepare('SELECT payload FROM job_events WHERE job_id = ? ORDER BY sequence');
    return rows.map((r) => ({
      id: r.id,
      kind: 'generate' as const,
      projectId: r.project_id,
      targets: JSON.parse(r.targets) as OutputTarget[],
      status: r.status,
      error: r.error,
      log: (logStmt.all(r.id) as { payload: string }[]).map((e) => e.payload),
    }));
  }

  // Providers ----------------------------------------------------------------

  saveProviderStatuses(statuses: ProviderStatus[]): void {
    const ts = now();
    const stmt = this.db.prepare(
      `INSERT INTO providers (id, display_name, state, version, detail, last_probe_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, state = excluded.state, version = excluded.version, detail = excluded.detail, last_probe_at = excluded.last_probe_at`,
    );
    this.transaction(() => {
      for (const s of statuses) stmt.run(s.id, s.displayName, s.state, s.version, s.detail, ts);
    });
  }

  lastProbeAt(): string | null {
    return (this.db.prepare('SELECT MAX(last_probe_at) AS t FROM providers').get() as { t: string | null }).t;
  }
}

function toVersion(row: VersionRow): ProjectVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    label: row.label,
    storySpecHash: row.story_spec_hash,
    createdAt: row.created_at,
    approved: row.approved === 1,
  };
}
