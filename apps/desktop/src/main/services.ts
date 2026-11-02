import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  validateStorySpec,
  type IpcResponse,
  type OutputTarget,
  type PreviewSession,
  type ProjectVersion,
  type SkillManifest,
  type StorySpec,
} from '@studio/contracts';
import { JobManager, ProjectWorkspace, throwIfCancelled } from '@studio/core';
import { generateHtmlSite } from '@studio/generator-html';
import { generateReactProject } from '@studio/generator-react';
import { buildReactExport, startStaticServer, type StaticServer } from '@studio/preview';
import { probeAll } from '@studio/providers';
import { loadRegistry } from '@studio/skills';
import { StudioStore } from '@studio/storage';
import { createStarterSpec } from '@studio/story-engine';
import { CreativeService, defaultCreativeDeps, type CreativeDeps } from './creative.ts';

export interface ResourcePaths {
  htmlRuntimeDir: string;
  threeDir: string;
  reactTemplateDir: string;
  skillsDir: string;
}

/**
 * Trusted studio services behind the IPC boundary. Every method takes
 * already-validated, opaque inputs (project IDs, target enums) — never paths.
 */
export class StudioServices {
  readonly workspace: ProjectWorkspace;
  readonly store: StudioStore;
  private readonly jobs: JobManager;
  private readonly previews = new Map<string, StaticServer>();
  private readonly resources: ResourcePaths;
  private readonly creativeService: CreativeService;

  constructor(workspaceRoot: string, resources: ResourcePaths, creativeDeps: Partial<CreativeDeps> = {}) {
    this.workspace = new ProjectWorkspace(workspaceRoot);
    this.store = StudioStore.open(path.join(workspaceRoot, 'studio.db'));
    this.resources = resources;
    this.creativeService = new CreativeService(this.workspace, this.store, { ...defaultCreativeDeps, ...creativeDeps }, async (projectId, label) => {
      await this.snapshot(projectId, label);
      for (const t of ['html', 'react'] as const) await this.closePreview(projectId, t);
    });
    this.jobs = new JobManager({
      started: (job) => this.store.recordJobStart(job),
      logged: (jobId, line) => this.store.appendJobLog(jobId, line),
      finished: (job) => this.store.recordJobEnd(job.id, job.status, job.error),
    });
  }

  /** First-run seeding, crash recovery and import of project folders that have no metadata yet. */
  async init(sample: StorySpec): Promise<void> {
    this.store.markInterruptedJobs();
    await this.workspace.ensureSample(sample);
    for (const project of await this.workspace.list()) {
      if (this.store.hasProject(project.id)) continue;
      this.store.upsertProject(project);
      const spec = await this.workspace.readSpec(project.id);
      if (spec.ok) await this.recordVersion(project.id, spec.spec, 'Imported', null);
    }
  }

  private async recordVersion(projectId: string, spec: StorySpec, label: string, parentId: string | null): Promise<ProjectVersion> {
    const id = randomUUID();
    const snapshot = await this.workspace.writeSnapshot(projectId, id, spec);
    return this.store.addVersion({ id, projectId, parentId, label, hash: snapshot.hash, snapshotPath: snapshot.path });
  }

  private async closePreview(projectId: string, target: OutputTarget): Promise<void> {
    const key = `${projectId}:${target}`;
    const existing = this.previews.get(key);
    if (existing) {
      this.previews.delete(key);
      await existing.close();
    }
  }

  private requireProject(projectId: string): void {
    if (!this.store.hasProject(projectId)) throw new Error(`Project "${projectId}" was not found`);
  }

  // Projects -----------------------------------------------------------------

  listProjects(): IpcResponse<'projects.list'> {
    return this.store.listProjects();
  }

  async createProject(input: { name: string; goal: string }): Promise<IpcResponse<'projects.create'>> {
    const spec = createStarterSpec(input);
    const summary = await this.workspace.create(spec);
    this.store.upsertProject(summary);
    await this.recordVersion(summary.id, spec, 'Created', null);
    this.store.touchProject(summary.id);
    return this.store.listProjects().find((p) => p.id === summary.id)!;
  }

  openProject(projectId: string): IpcResponse<'projects.open'> {
    this.requireProject(projectId);
    this.store.touchProject(projectId);
    const project = this.store.listProjects().find((p) => p.id === projectId)!;
    return { project, versions: this.store.listVersions(projectId), jobs: this.store.listJobs(projectId, 5) };
  }

  async getSpec(projectId: string): Promise<StorySpec | null> {
    this.requireProject(projectId);
    const result = await this.workspace.readSpec(projectId);
    return result.ok ? result.spec : null;
  }

  async validate(projectId: string): Promise<IpcResponse<'story.validate'>> {
    const result = await this.workspace.readSpec(projectId);
    return { ok: result.ok, issues: result.issues };
  }

  // Versions -----------------------------------------------------------------

  /** Snapshot the current spec. A spec identical to the latest snapshot is not duplicated. */
  async snapshot(projectId: string, label = 'Manual snapshot'): Promise<ProjectVersion> {
    this.requireProject(projectId);
    const current = await this.workspace.readSpec(projectId);
    if (!current.ok) throw new Error('Fix the StorySpec issues before saving a snapshot.');
    const latest = this.store.latestVersion(projectId);
    const id = randomUUID();
    const written = await this.workspace.writeSnapshot(projectId, id, current.spec);
    if (latest && latest.storySpecHash === written.hash) return latest;
    return this.store.addVersion({ id, projectId, parentId: latest?.id ?? null, label, hash: written.hash, snapshotPath: written.path });
  }

  /**
   * Restore a snapshot as the current spec. The current spec is snapshotted first,
   * so restoring never loses work. Snapshot hashes are verified before use.
   */
  async restore(projectId: string, versionId: string): Promise<ProjectVersion> {
    this.requireProject(projectId);
    const target = this.store.getVersion(projectId, versionId);
    if (!target) throw new Error('That version no longer exists.');
    const spec = await this.workspace.readSnapshot(projectId, target.snapshotPath, target.storySpecHash);
    const current = await this.workspace.readSpec(projectId);
    if (current.ok) await this.snapshot(projectId, 'Before restore');
    await this.workspace.writeSpec(projectId, spec);
    // Rolling back text must not come back on the next storyboard approval (scene structure is not reshaped).
    await this.creativeService.syncScenes(projectId, spec.pages.flatMap((p) => p.scenes));
    const restored = await this.recordVersion(projectId, spec, `Restored “${target.label}”`, target.id);
    for (const t of ['html', 'react'] as const) await this.closePreview(projectId, t);
    return restored;
  }

  /**
   * Scoped edit (T020): replace one scene's content/visual/accessibility. Every
   * other scene is kept byte-for-byte; the whole spec is re-validated and a
   * version is recorded so the edit can be rolled back.
   */
  async updateScene(projectId: string, sceneId: string, patch: { content: unknown; visual?: unknown; accessibility?: unknown }): Promise<ProjectVersion> {
    this.requireProject(projectId);
    const current = await this.workspace.readSpec(projectId);
    if (!current.ok) throw new Error('Fix the StorySpec issues before editing scenes.');
    const spec = structuredClone(current.spec);
    const page = spec.pages.find((p) => p.scenes.some((s) => s.id === sceneId));
    if (!page) throw new Error(`Scene "${sceneId}" was not found.`);
    const index = page.scenes.findIndex((s) => s.id === sceneId);
    const scene = page.scenes[index]!;
    page.scenes[index] = { ...scene, content: patch.content, visual: patch.visual ?? scene.visual, accessibility: patch.accessibility ?? scene.accessibility } as typeof scene;
    const result = validateStorySpec(spec);
    if (!result.ok) throw new Error(result.issues.map((i) => `${i.path.replace(/^pages\.\d+\.scenes\.\d+\./, '')}: ${i.message}`).join('\n'));
    await this.workspace.writeSpec(projectId, result.spec);
    await this.creativeService.syncScenes(projectId, [result.spec.pages.find((p) => p.id === page.id)!.scenes[index]!]);
    for (const t of ['html', 'react'] as const) await this.closePreview(projectId, t);
    return this.snapshot(projectId, `Edited “${scene.accessibility.label}”`);
  }

  // Generation ---------------------------------------------------------------

  startGeneration(projectId: string, targets: OutputTarget[]): IpcResponse<'generation.start'> {
    this.requireProject(projectId);
    const unique = [...new Set(targets)];
    return this.jobs.start(projectId, unique, async ({ signal, log }) => {
      const result = await this.workspace.readSpec(projectId);
      if (!result.ok) throw new Error(`StorySpec is invalid: ${result.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
      for (const target of unique) {
        throwIfCancelled(signal);
        await this.closePreview(projectId, target);
        const outDir = this.workspace.outputDir(projectId, target);
        if (target === 'html') {
          log('html-three: generating static HTML/CSS/ES modules + vendored three.js');
          const files = await generateHtmlSite(result.spec, outDir, { runtimeDir: this.resources.htmlRuntimeDir, threeDir: this.resources.threeDir });
          log(`html-three: wrote ${files.length} files`);
        } else {
          log('react-r3f: generating React + Vite + TypeScript + R3F project');
          const files = await generateReactProject(result.spec, outDir, this.resources.reactTemplateDir);
          log(`react-r3f: wrote ${files.length} files; installing pinned dependencies and building`);
          await buildReactExport(outDir, { signal, log });
        }
      }
      log('Done.');
    });
  }

  getJob(jobId: string): IpcResponse<'generation.get'> {
    return this.jobs.get(jobId);
  }

  cancelJob(jobId: string): IpcResponse<'generation.cancel'> {
    return this.jobs.cancel(jobId);
  }

  async startPreview(projectId: string, target: OutputTarget): Promise<PreviewSession> {
    const key = `${projectId}:${target}`;
    const existing = this.previews.get(key);
    if (existing) return { target, url: existing.url };
    const outDir = this.workspace.outputDir(projectId, target);
    const root = target === 'react' ? path.join(outDir, 'dist') : outDir;
    let server: StaticServer;
    try {
      server = await startStaticServer(root);
    } catch {
      throw new Error(`No ${target === 'react' ? 'React build' : 'HTML export'} yet — generate the project first.`);
    }
    this.previews.set(key, server);
    return { target, url: server.url };
  }

  // Creative workflow --------------------------------------------------------

  /** Creative operations for an existing project (unknown IDs never create folders). */
  creative(projectId: string): CreativeService {
    this.requireProject(projectId);
    return this.creativeService;
  }

  settings(): CreativeService {
    return this.creativeService;
  }

  // Providers and skills -----------------------------------------------------

  async probeProviders(): Promise<IpcResponse<'providers.probe'>> {
    const statuses = await probeAll();
    this.store.saveProviderStatuses(statuses);
    return statuses;
  }

  async listSkills(): Promise<SkillManifest[]> {
    const { skills, errors } = await loadRegistry(this.resources.skillsDir);
    // Broken skills are shown as disabled entries, never silently dropped.
    const broken: SkillManifest[] = errors.map((e) => ({
      id: e.id,
      name: e.id,
      description: '',
      version: 'unknown',
      source: 'local',
      license: 'UNKNOWN',
      supportedTargets: [],
      triggers: [],
      permissions: [],
      hash: '',
      files: 0,
      pin: 'unpinned',
      hasScripts: false,
      scriptsApproved: false,
      enabled: false,
      reason: `Could not load: ${e.error}`,
    }));
    return [...skills.map((s) => s.manifest), ...broken];
  }

  async dispose(): Promise<void> {
    this.jobs.cancelAll();
    await Promise.all([...this.previews.values()].map((s) => s.close()));
    this.previews.clear();
    this.store.close();
  }
}
