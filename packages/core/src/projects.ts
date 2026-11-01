import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { InvalidSpecError, validateStorySpec, type ProjectSummary, type StorySpec, type ValidationResult, type OutputTarget } from '@studio/contracts';
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
    return validateStorySpec(json);
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
    await writeFileInside(dir, 'story-spec.json', `${JSON.stringify(result.spec, null, 2)}\n`);
    return { id, name: result.spec.project.name, goal: result.spec.project.goal, updatedAt: now };
  }

  /** Seed the workspace with the sample project on first run. */
  async ensureSample(spec: StorySpec): Promise<void> {
    const existing = await this.list();
    if (existing.some((p) => p.id === spec.project.id)) return;
    await this.create(spec);
  }
}
