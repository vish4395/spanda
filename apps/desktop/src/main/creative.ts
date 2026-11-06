import { randomUUID } from 'node:crypto';
import { AI_STEPS, BriefOutput, DEFAULT_SETTINGS, DirectionsOutput, KickoffOutput, StudioSettings as SettingsSchema, providerForStep } from '@studio/contracts';
import type {
  AiProviderId,
  AiStep,
  CreativeBrief,
  CreativeDirection,
  CreativeFile,
  CreativeState,
  DiscoveryAnswer,
  DraftStoryboardOutput,
  ProjectStage,
  ReferenceReport,
  StoryboardPlanner,
  StoryboardScene,
  StorySpec,
  StudioSettings,
  StudioSettingsInput,
} from '@studio/contracts';
import type { JobContext, ProjectWorkspace } from '@studio/core';
import { PROVIDER_LIMITS, codexRefusal, draftStoryboardWithAi, runAiTask, type AiResult, type AiTask } from '@studio/providers';
import { extractFacts, safeFetch, type FetchedPage } from '@studio/reference-analyzer';
import type { StudioStore } from '@studio/storage';
import {
  applyBrief,
  briefPrompt,
  directionsFor,
  directionsPrompt,
  discoveryNotes,
  sanitizeDirections,
  effectiveAnswers,
  kickoffPrompt,
  questionsOf,
  sanitizePlan,
  legacyDirection,
  draftBrief,
  isValidAnswer,
  localStoryboard,
  nextQuestion,
  resolved,
  sanitizeDraft,
  storyboardPrompt,
  storyboardToSpec,
  syncStoryboardScene,
} from '@studio/story-engine';

export interface CreativeDeps {
  fetchPage: (url: string) => Promise<FetchedPage>;
  /** Returns a small JPEG data URL of the page, or null when capture is unavailable. */
  capture: (url: string) => Promise<string | null>;
  draftWithAi: (provider: AiProviderId, prompt: string, ctx: JobContext, skills: string[], untrustedData: boolean) => Promise<AiResult<DraftStoryboardOutput>>;
  /** Any other structured AI task (kickoff, directions, brief, scene edits, chat). */
  runTask: <T>(provider: AiProviderId, task: AiTask<T>, ctx: JobContext) => Promise<AiResult<T>>;
  /** Text of the enabled skills that apply to a phase, for the AI prompt (empty when none). */
  guidance: (phase: 'storyboard' | 'direction' | 'code' | 'qa') => Promise<{ name: string; text: string }[]>;
}

export const defaultCreativeDeps: CreativeDeps = {
  fetchPage: (url) => safeFetch(url),
  capture: async () => null,
  draftWithAi: (provider, prompt, ctx, skills, untrustedData) => draftStoryboardWithAi(provider, prompt, { signal: ctx.signal, onLog: ctx.log, skills, untrustedData }),
  runTask: (provider, task, ctx) => runAiTask(provider, task, { signal: ctx.signal, onLog: ctx.log }),
  guidance: async () => [],
};

/** How the creative service runs AI work: as a cancellable job, plus which CLIs are installed. */
export interface AiHost {
  start(projectId: string, title: string, work: (ctx: JobContext) => Promise<void>): { id: string };
  isRunning(jobId: string): boolean;
  installed(): AiProviderId[];
}

const PROVIDER_LABEL: Record<AiProviderId, string> = { 'claude-code': 'Claude Code CLI', codex: 'Codex CLI' };

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
  private readonly ai: AiHost;
  /** Running AI job per project, and the last AI failure (cleared by the next run). */
  private readonly aiJobs = new Map<string, { id: string; step: AiStep; title: string }>();
  private readonly aiErrors = new Map<string, string>();

  constructor(workspace: ProjectWorkspace, store: StudioStore, deps: CreativeDeps, onSpecChanged: (projectId: string, label: string) => Promise<void>, ai: AiHost) {
    this.workspace = workspace;
    this.store = store;
    this.deps = deps;
    this.onSpecChanged = onSpecChanged;
    this.ai = ai;
  }

  settings(): StudioSettings {
    const raw = this.store.getSetting('studio');
    if (raw) {
      try {
        const parsed = SettingsSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        // fall through to defaults
      }
    }
    // Earlier versions only had the storyboard opt-in; it becomes the default provider.
    if (this.store.getSetting('claudeStoryboard') === 'true') return { ...DEFAULT_SETTINGS, onboarded: true, provider: 'claude-code' };
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: StudioSettingsInput): StudioSettings {
    this.store.setSetting('studio', JSON.stringify(SettingsSchema.parse(settings)));
    return this.settings();
  }

  /** Why a provider cannot run a step right now, or null when it can. */
  private unavailable(step: AiStep, provider: AiProviderId): string | null {
    if (!this.ai.installed().includes(provider)) return `Install and sign in to the official ${PROVIDER_LABEL[provider]}, then check again in AI providers.`;
    const chosen = providerForStep(this.settings(), step);
    if (chosen === 'none') return 'AI is off for this step. Choose a provider in AI providers.';
    if (chosen !== provider) return `This step uses the ${PROVIDER_LABEL[chosen]}. Change it in AI providers.`;
    return null;
  }

  /** Run AI work for a project as a job; one at a time per project. */
  private runAi(projectId: string, step: AiStep, title: string, work: (ctx: JobContext) => Promise<void>): void {
    const running = this.aiJobs.get(projectId);
    if (running && this.ai.isRunning(running.id)) throw new Error(`“${running.title}” is still running. Wait for it or cancel it first.`);
    this.aiErrors.delete(projectId);
    const job = this.ai.start(projectId, title, async (ctx) => {
      try {
        await work(ctx);
      } catch (err) {
        if (!ctx.signal.aborted) this.aiErrors.set(projectId, (err as Error).message);
        throw err;
      } finally {
        this.aiJobs.delete(projectId);
      }
    });
    this.aiJobs.set(projectId, { id: job.id, step, title });
  }

  private stageOf(file: CreativeFile): ProjectStage {
    if (file.storyboard?.approved && file.brief?.approved) return 'approved';
    if (file.brief?.approved) return 'storyboard_ready';
    if (file.brief || nextQuestion(file.answers, questionsOf(file.plan)) === null) return 'brief_ready';
    return Object.keys(file.answers).length ? 'discovery' : 'draft';
  }

  /** The offered directions: generated per project and seed, plus the chosen one (in place of its family's new offer) if it is no longer offered. */
  private directionsOf(projectId: string, file: CreativeFile): CreativeDirection[] {
    // AI directions come first; studio directions with the same name are left out.
    const ai = file.aiDirections?.directions ?? [];
    const local = directionsFor(effectiveAnswers(file.answers, file.plan), { seed: file.directionSeed ?? 0, salt: projectId });
    const directions = [...ai, ...local.filter((d) => !ai.some((a) => a.name === d.name))];
    const chosen = file.brief ? this.chosenDirection(projectId, file, directions) : null;
    if (chosen && !directions.some((d) => d.id === chosen.id)) return [chosen, ...directions.filter((d) => d.name !== chosen.name)];
    return directions;
  }

  /** The brief's direction: its snapshot, else (older briefs) the offer or 0.1.0 preset with that id. */
  private chosenDirection(projectId: string, file: CreativeFile, offered?: CreativeDirection[]): CreativeDirection | null {
    const brief = file.brief;
    if (!brief) return null;
    if (brief.direction?.id === brief.directionId) return brief.direction;
    const pool = offered ?? directionsFor(effectiveAnswers(file.answers, file.plan), { seed: file.directionSeed ?? 0, salt: projectId });
    return pool.find((d) => d.id === brief.directionId) ?? legacyDirection(brief.directionId);
  }

  private requireDirection(projectId: string, file: CreativeFile): CreativeDirection {
    const direction = this.chosenDirection(projectId, file);
    if (!direction) throw new Error('The brief’s art direction is no longer available. Choose a direction and save the brief again.');
    return direction;
  }

  async state(projectId: string, file?: CreativeFile): Promise<CreativeState> {
    const data = file ?? (await this.workspace.readCreative(projectId));
    const spec = await this.workspace.readSpec(projectId);
    const idea = spec.ok ? spec.spec.project.goal : '';
    const directions = this.directionsOf(projectId, data);
    const questions = questionsOf(data.plan);
    return {
      stage: this.stageOf(data),
      idea,
      nextQuestion: nextQuestion(data.answers, questions),
      questionCount: questions.length,
      plan: data.plan ?? null,
      answered: questions.filter((q) => q.id in data.answers).map((q) => ({ question: q, answer: data.answers[q.id]! })),
      directions,
      brief: data.brief,
      briefSource: data.briefSource ?? null,
      storyboard: data.storyboard,
      references: data.references,
      planners: [
        { id: 'local-planner', label: 'Local planner (no AI)', available: true, reason: null },
        ...(['claude-code', 'codex'] as const).map((id) => {
          const reason = this.unavailable('storyboard', id);
          return { id, label: PROVIDER_LABEL[id], available: reason === null, reason };
        }),
      ],
      aiSteps: Object.fromEntries(
        AI_STEPS.map((step) => {
          const provider = providerForStep(this.settings(), step);
          return [step, { provider, available: provider !== 'none' && this.unavailable(step, provider) === null, reason: provider === 'none' ? 'AI is off for this step. Choose a provider in AI providers.' : this.unavailable(step, provider) }];
        }),
      ) as CreativeState['aiSteps'],
      aiJob: this.aiJobs.get(projectId) ?? null,
      aiError: this.aiErrors.get(projectId) ?? null,
    };
  }

  /** The provider that runs a step, or an error explaining why none can. */
  private providerFor(step: AiStep): AiProviderId {
    const provider = providerForStep(this.settings(), step);
    if (provider === 'none') throw new Error('AI is off for this step. Choose a provider in AI providers.');
    const reason = this.unavailable(step, provider);
    if (reason) throw new Error(reason);
    return provider;
  }

  /**
   * Kickoff: AI plans the project from its name and idea, with next steps and
   * questions made for it. `auto` (right after creating a project) stays silent
   * when AI is off or unavailable.
   */
  async kickoff(projectId: string, options: { auto?: boolean } = {}): Promise<CreativeState> {
    let provider: AiProviderId;
    try {
      provider = this.providerFor('kickoff');
    } catch (err) {
      if (options.auto) return this.state(projectId);
      throw err;
    }
    const spec = await this.workspace.readSpec(projectId);
    if (!spec.ok) throw new Error('Fix the StorySpec issues first.');
    const { name, goal } = spec.spec.project;
    this.runAi(projectId, 'kickoff', `Planning “${name}” with the ${PROVIDER_LABEL[provider]}`, async (ctx) => {
      const guidance = await this.deps.guidance('storyboard');
      const { value, provenance } = await this.deps.runTask(provider, { name: 'kickoff', prompt: kickoffPrompt({ name, idea: goal, guidance }), schema: KickoffOutput, skills: guidance.map((g) => g.name) }, ctx);
      const latest = await this.workspace.readCreative(projectId);
      // Answers to an earlier plan's questions no longer apply; answers to the fixed core questions still do.
      for (const id of Object.keys(latest.answers)) if (id.startsWith('q-')) delete latest.answers[id];
      latest.plan = sanitizePlan(value, provenance);
      await this.save(projectId, latest);
      ctx.log(`Plan saved: ${latest.plan.questions.length} questions, ${latest.plan.nextSteps.length} next steps.`);
    });
    return this.state(projectId);
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
      if (!isValidAnswer(questionId, answer, questionsOf(file.plan))) throw new Error('That answer is not one of the options.');
      file.answers[questionId] = answer;
    }
    if (nextQuestion(file.answers, questionsOf(file.plan)) === null && !file.brief) file.brief = draftBrief(effectiveAnswers(file.answers, file.plan), this.directionsOf(projectId, file));
    return this.save(projectId, file);
  }

  async saveBrief(projectId: string, input: Omit<CreativeBrief, 'approved' | 'approvedAt'>): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    const direction = this.directionsOf(projectId, file).find((d) => d.id === input.directionId);
    if (!direction) throw new Error('Unknown art direction.');
    // Editing an approved brief needs re-approval; the storyboard stays but is no longer approved.
    file.brief = { ...input, direction, approved: false, approvedAt: null };
    // Once the user edits it, the brief is theirs.
    file.briefSource = null;
    if (file.storyboard) file.storyboard = { ...file.storyboard, approved: false, approvedAt: null };
    return this.save(projectId, file);
  }

  private async context(projectId: string, file: CreativeFile, phase: 'direction' | 'storyboard') {
    const spec = await this.workspace.readSpec(projectId);
    if (!spec.ok) throw new Error('Fix the StorySpec issues first.');
    const guidance = await this.deps.guidance(phase);
    return { name: spec.spec.project.name, idea: spec.spec.project.goal, plan: file.plan, discovery: discoveryNotes(file.answers, file.plan), references: file.references, guidance };
  }

  /** AI proposes art directions for this project; they are offered before the studio's own. */
  async aiDirections(projectId: string): Promise<CreativeState> {
    const provider = this.providerFor('direction');
    const file = await this.workspace.readCreative(projectId);
    if (provider === 'codex') {
      const refusal = codexRefusal({ untrustedData: file.references.length > 0 });
      if (refusal) throw new Error(refusal);
    }
    const ctxInput = await this.context(projectId, file, 'direction');
    const core = effectiveAnswers(file.answers, file.plan);
    const motion = resolved(core, 'motion') as CreativeDirection['motion'];
    this.runAi(projectId, 'direction', `Proposing art directions with the ${PROVIDER_LABEL[provider]}`, async (ctx) => {
      const prompt = directionsPrompt({ ...ctxInput, core: { tone: resolved(core, 'tone'), subject: resolved(core, 'subject'), motion } });
      const { value, provenance } = await this.deps.runTask(provider, { name: 'directions', prompt, schema: DirectionsOutput, skills: ctxInput.guidance.map((g) => g.name), untrustedData: file.references.length > 0 }, ctx);
      const latest = await this.workspace.readCreative(projectId);
      const round = (latest.aiDirections?.provenance ? Number(/^ai-(\d+)-/.exec(latest.aiDirections.directions[0]?.id ?? '')?.[1] ?? 0) : 0) + 1;
      const directions = sanitizeDirections(value, provenance, motion, round);
      if (directions.length === 0) throw new Error('None of the proposed directions met the contrast rules. Try again.');
      const dropped = value.directions.length - directions.length;
      latest.aiDirections = { directions, provenance };
      await this.save(projectId, latest);
      ctx.log(`${directions.length} directions added${dropped ? ` (${dropped} dropped: contrast or duplicate name)` : ''}.`);
    });
    return this.state(projectId);
  }

  /** AI fills the brief (audience, tone, motion, chapters, notes); the user edits and approves it. */
  async aiBrief(projectId: string): Promise<CreativeState> {
    const provider = this.providerFor('brief');
    const file = await this.workspace.readCreative(projectId);
    if (provider === 'codex') {
      const refusal = codexRefusal({ untrustedData: file.references.length > 0 });
      if (refusal) throw new Error(refusal);
    }
    const ctxInput = await this.context(projectId, file, 'storyboard');
    this.runAi(projectId, 'brief', `Writing the brief with the ${PROVIDER_LABEL[provider]}`, async (ctx) => {
      const direction = file.brief ? this.chosenDirection(projectId, file) : null;
      const prompt = briefPrompt({ ...ctxInput, direction, current: file.brief });
      const { value, provenance } = await this.deps.runTask(provider, { name: 'brief', prompt, schema: BriefOutput, skills: ctxInput.guidance.map((g) => g.name), untrustedData: file.references.length > 0 }, ctx);
      const latest = await this.workspace.readCreative(projectId);
      const base = latest.brief ?? draftBrief(effectiveAnswers(latest.answers, latest.plan), this.directionsOf(projectId, latest));
      latest.brief = applyBrief(base, value);
      latest.briefSource = { reasons: value.reasons.slice(0, 300), provenance };
      if (latest.storyboard) latest.storyboard = { ...latest.storyboard, approved: false, approvedAt: null };
      await this.save(projectId, latest);
      ctx.log('Brief filled. Review it, then approve.');
    });
    return this.state(projectId);
  }

  /** "Show other directions": a new seed, keeping the chosen direction on offer. */
  async moreDirections(projectId: string): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    file.directionSeed = (file.directionSeed ?? 0) + 1;
    return this.save(projectId, file);
  }

  async approveBrief(projectId: string): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.brief) throw new Error('Answer the discovery questions or write a brief first.');
    file.brief = { ...file.brief, approved: true, approvedAt: new Date().toISOString() };
    return this.save(projectId, file);
  }

  /**
   * The local planner drafts immediately. A provider drafts in a cancellable job;
   * the returned state carries `aiJob`, and the draft is saved when the job ends.
   */
  async draftStoryboard(projectId: string, planner: StoryboardPlanner): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.brief?.approved) throw new Error('Approve the brief before drafting a storyboard.');
    const spec = await this.workspace.readSpec(projectId);
    if (!spec.ok) throw new Error('Fix the StorySpec issues first.');
    const { name, goal } = spec.spec.project;
    const direction = this.requireDirection(projectId, file);
    if (planner === 'local-planner') {
      file.storyboard = localStoryboard({ name, idea: goal, brief: file.brief, subject: resolved(effectiveAnswers(file.answers, file.plan), 'subject'), direction });
      return this.save(projectId, file);
    }
    const reason = this.unavailable('storyboard', planner) ?? (planner === 'codex' ? codexRefusal({ untrustedData: file.references.length > 0 }) : null);
    if (reason) throw new Error(reason);
    const brief = file.brief;
    this.runAi(projectId, 'storyboard', `Drafting the storyboard with the ${PROVIDER_LABEL[planner]}`, async (ctx) => {
      const guidance = await this.deps.guidance('storyboard');
      const prompt = storyboardPrompt({ name, idea: goal, brief, direction, references: file.references, guidance, discovery: discoveryNotes(file.answers, file.plan) });
      const { value, provenance } = await this.deps.draftWithAi(planner, prompt, ctx, guidance.map((g) => g.name), file.references.length > 0);
      // Re-read: the user may have edited other parts of the project while the job ran.
      const latest = await this.workspace.readCreative(projectId);
      const models = provenance.models.length ? ` (${provenance.models.join(', ')})` : '';
      latest.storyboard = sanitizeDraft(value, { kind: planner, detail: `Drafted by your local ${PROVIDER_LABEL[planner]}${models} ${PROVIDER_LIMITS[planner]}. Review before approving.`, createdAt: provenance.createdAt, provenance }, direction);
      await this.save(projectId, latest);
      ctx.log('Storyboard draft saved.');
    });
    return this.state(projectId, file);
  }

  async saveStoryboard(projectId: string, scenes: StoryboardScene[]): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.storyboard) throw new Error('Draft a storyboard first.');
    if (scenes[0]?.type !== 'hero' || scenes.slice(1).some((s) => s.type === 'hero')) throw new Error('The storyboard must start with the hero scene, and only once.');
    const ids = new Set(scenes.map((s) => s.id));
    if (ids.size !== scenes.length) throw new Error('Scene IDs must be unique.');
    file.storyboard = { ...file.storyboard, scenes, approved: false, approvedAt: null };
    return this.save(projectId, file);
  }

  /** Writes the StorySpec from the approved brief + storyboard and records a version. */
  /** Keep storyboard text in step with scenes changed on the StorySpec (scoped edits and restores, T020). */
  async syncScenes(projectId: string, scenes: StorySpec['pages'][number]['scenes']): Promise<void> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.storyboard) return;
    const storyboard = scenes.reduce(syncStoryboardScene, file.storyboard);
    if (storyboard === file.storyboard) return;
    await this.save(projectId, { ...file, storyboard });
  }

  async approveStoryboard(projectId: string): Promise<CreativeState> {
    const file = await this.workspace.readCreative(projectId);
    if (!file.brief?.approved) throw new Error('Approve the brief first.');
    if (!file.storyboard) throw new Error('Draft a storyboard first.');
    const current = await this.workspace.readSpec(projectId);
    if (!current.ok) throw new Error('Fix the StorySpec issues first.');
    const direction = this.requireDirection(projectId, file);
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
