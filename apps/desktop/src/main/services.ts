import path from 'node:path';
import {
  type IpcResponse,
  type OutputTarget,
  type PreviewSession,
  type StorySpec,
} from '@studio/contracts';
import { JobManager, ProjectWorkspace, throwIfCancelled } from '@studio/core';
import { generateHtmlSite } from '@studio/generator-html';
import { generateReactProject } from '@studio/generator-react';
import { buildReactExport, startStaticServer, type StaticServer } from '@studio/preview';
import { probeAll } from '@studio/providers';

export interface ResourcePaths {
  htmlRuntimeDir: string;
  threeDir: string;
  reactTemplateDir: string;
}

/**
 * Trusted studio services behind the IPC boundary. Every method takes
 * already-validated, opaque inputs (project IDs, target enums) — never paths.
 */
export class StudioServices {
  readonly workspace: ProjectWorkspace;
  private readonly jobs = new JobManager();
  private readonly previews = new Map<string, StaticServer>();
  private readonly resources: ResourcePaths;

  constructor(workspaceRoot: string, resources: ResourcePaths) {
    this.workspace = new ProjectWorkspace(workspaceRoot);
    this.resources = resources;
  }

  async seed(sample: StorySpec): Promise<void> {
    await this.workspace.ensureSample(sample);
  }

  private async closePreview(projectId: string, target: OutputTarget): Promise<void> {
    const key = `${projectId}:${target}`;
    const existing = this.previews.get(key);
    if (existing) {
      this.previews.delete(key);
      await existing.close();
    }
  }

  async listProjects(): Promise<IpcResponse<'projects.list'>> {
    return this.workspace.list();
  }

  async validate(projectId: string): Promise<IpcResponse<'story.validate'>> {
    const result = await this.workspace.readSpec(projectId);
    return { ok: result.ok, issues: result.issues };
  }

  startGeneration(projectId: string, targets: OutputTarget[]): IpcResponse<'generation.start'> {
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

  probeProviders(): Promise<IpcResponse<'providers.probe'>> {
    return probeAll();
  }

  async dispose(): Promise<void> {
    this.jobs.cancelAll();
    await Promise.all([...this.previews.values()].map((s) => s.close()));
    this.previews.clear();
  }
}
