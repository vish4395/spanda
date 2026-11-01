import { randomUUID } from 'node:crypto';
import type {
  CreativeBrief,
  CreativeFile,
  CreativeState,
  DiscoveryAnswer,
  DraftStoryboardOutput,
  ProjectStage,
  ReferenceReport,
  StoryboardScene,
  StudioSettings,
} from '@studio/contracts';
import type { ProjectWorkspace } from '@studio/core';
import { draftStoryboardWithClaude } from '@studio/providers';
import { extractFacts, safeFetch, type FetchedPage } from '@studio/reference-analyzer';
import type { StudioStore } from '@studio/storage';
import {
  QUESTIONS,
  allDirections,
  directionsFor,
  draftBrief,
  isValidAnswer,
  localStoryboard,
  nextQuestion,
  resolved,
  sanitizeDraft,
  storyboardPrompt,
  storyboardToSpec,
} from '@studio/story-engine';

export interface CreativeDeps {
  fetchPage: (url: string) => Promise<FetchedPage>;
  /** Returns a small JPEG data URL of the page, or null when capture is unavailable. */
  capture: (url: string) => Promise<string | null>;
  draftWithClaude: (prompt: string) => Promise<DraftStoryboardOutput>;
}

export const defaultCreativeDeps: CreativeDeps = {
  fetchPage: (url) => safeFetch(url),
  capture: async () => null,
  draftWithClaude: (prompt) => draftStoryboardWithClaude(prompt),
};

const RIGHTS_NOTICE =
  'Third-party page: use only as inspiration for structure and mood. Its text, images, fonts and code are not licensed for reuse.';

/**
 * Creative workflow (M2): discovery → brief → storyboard → approved StorySpec.
 * The deterministic path works offline; the Claude Code CLI is an opt-in planner.
 */
export class CreativeService {
  private readonly workspace: ProjectWorkspace;
  private readonly store: StudioStore;
  private readonly deps: CreativeDeps;
  private readonly onSpecChanged: (projectId: string, label: string) => Promise<void>;

  constructor(workspace: ProjectWorkspace, store: StudioStore, deps: CreativeDeps, onSpecChanged: (projectId: string, label: string) => Promise<void>) {
    this.workspace = workspace;
    this.store = store;
    this.deps = deps;
    this.onSpecChanged = onSpecChanged;
  }

  settings(): StudioSettings {
    return { claudeStoryboard: this.store.getSetting('claudeStoryboard') === 'true' };
  }

  saveSettings(settings: StudioSettings): StudioSettings {
    this.store.setSetting('claudeStoryboard', String(settings.claudeStoryboard));
    return this.settings();
  }

  private stageOf(file: CreativeFile): ProjectStage {
    if (file.storyboard?.approved && file.brief?.approved) return 'approved';
    if (file.brief?.approved) return 'storyboard_ready';
    if (file.brief || nextQuestion(file.answers) === null) return 'brief_ready';
    return Object.keys(file.answers).length ? 'discovery' : 'draft';
  }

  async state(projectId: string, file?: CreativeFile): Promise<CreativeState> {
    const data = file ?? (await this.workspace.readCreative(projectId));
    const spec = await this.workspace.readSpec(projectId);
    const idea = spec.ok ? spec.spec.project.goal : '';
    const directions = directionsFor(data.answers);
    // Keep a previously chosen direction visible even if answers changed.
    if (data.brief && !directions.some((d) => d.id === data.brief!.directionId)) {
      const chosen = allDirections().find((d) => d.id === data.brief!.directionId);
      if (chosen) directions.push(chosen);
    }
    const claudeEnabled = this.settings().claudeStoryboard;
    return {
      stage: this.stageOf(data),
      idea,
      nextQuestion: nextQuestion(data.answers),
      answered: QUESTIONS.filter((q) => q.id in data.answers).map((q) => ({ question: q, answer: data.answers[q.id]! })),
      directions,
      brief: data.brief,
      storyboard: data.storyboard,
      references: data.references,
      planners: [
        { id: 'local-planner', label: 'Local planner (no AI)', available: true, reason: null },
        {
          id: 'claude-code',
          label: 'Claude Code CLI',
          available: claudeEnabled,
          reason: claudeEnabled ? null : 'Turn on “Draft storyboards with Claude Code” in AI providers settings.',
        },
      ],
    };
  }

  private async save(projectId: string, file: CreativeFile): Promise<CreativeState> {
    await this.workspace.writeCreative(projectId, file);
    this.store.setStage(projectId, this.stageOf(file));
    return this.state(projectId, file);
  }

  async answer(projectId: string, questionId: string, answer: DiscoveryAnswer | null): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (answer === null) {
      delete file.answers[questionId]; // "Change answer" re-asks this question
    } else {
      if (!isValidAnswer(questionId, answer)) throw new Error('That answer is not one of the options.');
      file.answers[questionId] = answer;
    }
    if (nextQuestion(file.answers) === null && !file.brief) file.brief = draftBrief(file.answers, directionsFor(file.answers));
    return this.save(projectId, file);
  }

  async saveBrief(projectId: string, input: Omit<CreativeBrief, 'approved' | 'approvedAt'>): Promise<CreativeState> {
    if (!allDirections().some((d) => d.id === input.directionId)) throw new Error('Unknown art direction.');
    const file = await this.workspace.readCreative(projectId);
    // Editing an approved brief needs re-approval; the storyboard stays but is no longer approved.
    file.brief = { ...input, approved: false, approvedAt: null };
    if (file.storyboard) file.storyboard = { ...file.storyboard, approved: false, approvedAt: null };
    return this.save(projectId, file);
  }

  async approveBrief(projectId: string): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.brief) throw new Error('Answer the discovery questions or write a brief first.');
    file.brief = { ...file.brief, approved: true, approvedAt: new Date().toISOString() };
    return this.save(projectId, file);
  }

  async draftStoryboard(projectId: string, planner: 'local-planner' | 'claude-code'): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.brief?.approved) throw new Error('Approve the brief before drafting a storyboard.');
    const spec = await this.workspace.readSpec(projectId);
    if (!spec.ok) throw new Error('Fix the StorySpec issues first.');
    const { name, goal } = spec.spec.project;
    if (planner === 'claude-code') {
      if (!this.settings().claudeStoryboard) throw new Error('Claude Code drafting is turned off in AI providers settings.');
      const direction = allDirections().find((d) => d.id === file.brief!.directionId)!;
      const output = await this.deps.draftWithClaude(storyboardPrompt({ name, idea: goal, brief: file.brief, direction, references: file.references }));
      file.storyboard = sanitizeDraft(output, { kind: 'claude-code', detail: 'Drafted by your local Claude Code CLI (tools disabled). Review before approving.', createdAt: new Date().toISOString() });
    } else {
      file.storyboard = localStoryboard({ name, idea: goal, brief: file.brief, subject: resolved(file.answers, 'subject') });
    }
    return this.save(projectId, file);
  }

  async saveStoryboard(projectId: string, scenes: StoryboardScene[]): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.storyboard) throw new Error('Draft a storyboard first.');
    if (scenes[0]?.type !== 'hero' || scenes.slice(1).some((s) => s.type !== 'chapter')) throw new Error('The storyboard must start with one hero followed by chapters.');
    const ids = new Set(scenes.map((s) => s.id));
    if (ids.size !== scenes.length) throw new Error('Scene IDs must be unique.');
    file.storyboard = { ...file.storyboard, scenes, approved: false, approvedAt: null };
    return this.save(projectId, file);
  }

  /** Writes the StorySpec from the approved brief + storyboard and records a version. */
  async approveStoryboard(projectId: string): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.brief?.approved) throw new Error('Approve the brief first.');
    if (!file.storyboard) throw new Error('Draft a storyboard first.');
    const current = await this.workspace.readSpec(projectId);
    if (!current.ok) throw new Error('Fix the StorySpec issues first.');
    const direction = allDirections().find((d) => d.id === file.brief!.directionId)!;
    const spec = storyboardToSpec(current.spec, file.brief, direction, file.storyboard);
    await this.workspace.writeSpec(projectId, spec);
    file.storyboard = { ...file.storyboard, approved: true, approvedAt: new Date().toISOString() };
    const state = await this.save(projectId, file);
    await this.onSpecChanged(projectId, 'Storyboard approved');
    return state;
  }

  async analyzeReference(projectId: string, url: string, inspiration: string): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (file.references.length >= 10) throw new Error('A project can hold up to 10 references. Remove one first.');
    const page = await this.deps.fetchPage(url);
    const facts = extractFacts(page.body);
    let screenshot: string | null = null;
    try {
      screenshot = await this.deps.capture(page.finalUrl);
    } catch {
      screenshot = null; // capture is best-effort; the text report still stands
    }
    const report: ReferenceReport = {
      id: randomUUID(),
      url: page.requestedUrl,
      finalUrl: page.finalUrl,
      fetchedAt: new Date().toISOString(),
      title: facts.title,
      description: facts.description,
      headings: facts.headings,
      colors: facts.colors,
      fonts: facts.fonts,
      observations: facts.observations,
      screenshot,
      truncated: page.truncated,
      inspiration: inspiration.trim(),
      rightsNotice: RIGHTS_NOTICE,
    };
    file.references.push(report);
    return this.save(projectId, file);
  }

  async removeReference(projectId: string, referenceId: string): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    file.references = file.references.filter((r) => r.id !== referenceId);
    return this.save(projectId, file);
  }
}
