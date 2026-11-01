import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { CreativeFile, InvalidSpecError, loadStorySpec, validateStorySpec, type ProjectSummary, type StorySpec, type ValidationResult, type OutputTarget } from '@studio/contracts';
import { resolveInside, writeFileInside } from './safe-paths.ts';

const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project "${id}" was not found`);
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * File-based workspace for M0: `<root>/projects/<id>/{project.json,story-spec.json}`.
 * SQLite metadata arrives in M1 (T006); the on-disk layout stays compatible.
 */
export class ProjectWorkspace {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  projectDir(id: string): string {
    if (!PROJECT_ID.test(id)) throw new ProjectNotFoundError(id);
    return resolveInside(this.root, `projects/${id}`);
  }

  outputDir(id: string, target: OutputTarget): string {
    return resolveInside(this.projectDir(id), `output/${target}`);
  }

  async list(): Promise<ProjectSummary[]> {
    const dir = path.join(this.root, 'projects');
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const projects: ProjectSummary[] = [];
    for (const id of entries.sort()) {
      if (!PROJECT_ID.test(id)) continue;
      try {
        const meta = JSON.parse(await readFile(path.join(dir, id, 'project.json'), 'utf8')) as Partial<ProjectSummary>;
        const info = await stat(path.join(dir, id, 'story-spec.json'));
        projects.push({ id, name: String(meta.name ?? id), goal: String(meta.goal ?? ''), updatedAt: info.mtime.toISOString() });
      } catch {
        // Skip unreadable/partial project folders instead of failing the whole list.
      }
    }
    return projects;
  }

  async readSpec(id: string): Promise<ValidationResult> {
    let raw: string;
    try {
      raw = await readFile(path.join(this.projectDir(id), 'story-spec.json'), 'utf8');
    } catch {
      throw new ProjectNotFoundError(id);
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      return { ok: false, issues: [{ path: '(root)', message: `story-spec.json is not valid JSON: ${(err as Error).message}` }] };
    }
    const { migrated: _migrated, ...result } = loadStorySpec(json);
    return result;
  }

  /** Create a project from a validated spec. Existing projects are never overwritten. */
  async create(spec: StorySpec): Promise<ProjectSummary> {
    const result = validateStorySpec(spec);
    if (!result.ok) throw new InvalidSpecError(result.issues);
    const id = result.spec.project.id;
    const dir = this.projectDir(id);
    await mkdir(path.dirname(dir), { recursive: true });
    await mkdir(dir); // throws EEXIST rather than overwriting
    const now = new Date().toISOString();
    await writeFileInside(dir, 'project.json', `${JSON.stringify({ id, name: result.spec.project.name, goal: result.spec.project.goal, createdAt: now }, null, 2)}\n`);
    await writeFileInside(dir, 'story-spec.json', serializeSpec(result.spec));
    return { id, name: result.spec.project.name, goal: result.spec.project.goal, updatedAt: now };
  }

  /** Replace the current StorySpec (validated) and return its content hash. */
  async writeSpec(id: string, spec: StorySpec): Promise<string> {
    const result = validateStorySpec(spec);
    if (!result.ok) throw new InvalidSpecError(result.issues);
    if (result.spec.project.id !== id) throw new Error('StorySpec project.id does not match the project');
    const text = serializeSpec(result.spec);
    await writeFileInside(this.projectDir(id), 'story-spec.json', text);
    return hashText(text);
  }

  /** Store an immutable snapshot of a spec; returns its project-relative path and hash. */
  async writeSnapshot(id: string, versionId: string, spec: StorySpec): Promise<{ path: string; hash: string }> {
    if (!/^[0-9a-f-]{36}$/.test(versionId)) throw new Error('Invalid version id');
    const text = serializeSpec(spec);
    const rel = `snapshots/${versionId}.json`;
    await writeFileInside(this.projectDir(id), rel, text);
    return { path: rel, hash: hashText(text) };
  }

  /** Read a snapshot back, verifying its hash so tampered files are never restored. */
  async readSnapshot(id: string, snapshotPath: string, expectedHash: string): Promise<StorySpec> {
    const text = await readFile(resolveInside(this.projectDir(id), snapshotPath), 'utf8');
    if (hashText(text) !== expectedHash) throw new Error('Snapshot content does not match its recorded hash');
    const result = loadStorySpec(JSON.parse(text));
    if (!result.ok) throw new InvalidSpecError(result.issues);
    return result.spec;
  }

  /** Creative workflow state (answers, brief, storyboard, references); empty when absent. */
  async readCreative(id: string): Promise<CreativeFile> {
    try {
      const raw = JSON.parse(await readFile(resolveInside(this.projectDir(id), 'creative.json'), 'utf8')) as unknown;
      const parsed = CreativeFile.safeParse(raw);
      if (parsed.success) return parsed.data;
      throw new Error(`creative.json is invalid: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, answers: {}, brief: null, storyboard: null, references: [] };
      throw err;
    }
  }

  async writeCreative(id: string, data: CreativeFile): Promise<void> {
    const parsed = CreativeFile.parse(data);
    await writeFileInside(this.projectDir(id), 'creative.json', `${JSON.stringify(parsed, null, 2)}\n`);
  }

  /** Seed the workspace with the sample project on first run. */
  async ensureSample(spec: StorySpec): Promise<void> {
    const existing = await this.list();
    if (existing.some((p) => p.id === spec.project.id)) return;
    await this.create(spec);
  }
}

export function serializeSpec(spec: StorySpec): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
