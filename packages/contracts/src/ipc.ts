import { z } from 'zod';
import type { IpcChannel } from './ipc-channels.ts';
import { StorySpecSchema } from './story-spec.ts';
import { CreativeBrief, CreativeState, StoryboardPlanner, DiscoveryAnswer, StoryboardScene } from './creative.ts';
import { AiProviderId, StudioSettings } from './ai.ts';

export { IPC_CHANNELS, MENU_COMMANDS, MENU_COMMAND_CHANNEL, type IpcChannel, type IpcEnvelope, type MenuCommand, type MenuCommandMessage } from './ipc-channels.ts';

// Typed IPC allowlist shared by Electron main, preload and renderer.
// The renderer never sends file paths or commands — only opaque IDs and enums.

export const OutputTarget = z.enum(['html', 'react']);
export type OutputTarget = z.infer<typeof OutputTarget>;

const ProjectId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const JobId = z.string().uuid();

const VersionId = z.string().uuid();

export const ProjectSummary = z.object({
  id: ProjectId,
  name: z.string(),
  goal: z.string(),
  updatedAt: z.string(),
  lastOpenedAt: z.string().nullable().optional(),
});
export type ProjectSummary = z.infer<typeof ProjectSummary>;

export const ProjectVersion = z.object({
  id: VersionId,
  projectId: ProjectId,
  parentId: VersionId.nullable(),
  label: z.string(),
  storySpecHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string(),
  approved: z.boolean(),
});
export type ProjectVersion = z.infer<typeof ProjectVersion>;

/** New-project form: plain text only; the studio derives the ID and starter StorySpec. */
export const CreateProjectRequest = z.strictObject({
  name: z.string().trim().min(1, 'Give the project a name').max(80, 'Keep the name under 80 characters'),
  goal: z.string().trim().min(1, 'Describe the idea in one line').max(300, 'Keep the idea under 300 characters'),
});

export const ValidationIssueSchema = z.object({ path: z.string(), message: z.string() });

export const ValidationReport = z.object({
  ok: z.boolean(),
  issues: z.array(ValidationIssueSchema),
});

export const JobStatus = z.enum(['running', 'succeeded', 'failed', 'cancelled']);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobSnapshot = z.object({
  id: JobId,
  /** `generate` builds outputs; `ai` runs one provider task (its targets are empty). */
  kind: z.enum(['generate', 'ai']),
  /** Short description shown in activity lists. */
  title: z.string().max(120).optional(),
  projectId: ProjectId,
  targets: z.array(OutputTarget),
  status: JobStatus,
  log: z.array(z.string()),
  error: z.string().nullable(),
});
export type JobSnapshot = z.infer<typeof JobSnapshot>;

export const PreviewSession = z.object({
  target: OutputTarget,
  url: z.string().url(),
});
export type PreviewSession = z.infer<typeof PreviewSession>;

/** Result of an export (T024). Paths stay in the main process; only the file name is reported. */
export const ExportResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('canceled') }),
  z.object({
    status: z.literal('saved'),
    fileName: z.string().max(260),
    files: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
    licenses: z.enum(['passed', 'review_required']),
    rights: z.enum(['passed', 'review_required']),
  }),
]);
export type ExportResult = z.infer<typeof ExportResult>;

export const PreviewMotion = z.enum(['full', 'reduce']);
export type PreviewMotion = z.infer<typeof PreviewMotion>;

/** Something the running preview reported (data from the generated site — always shown as text). */
export const PreviewIssue = z.object({
  kind: z.enum(['exception', 'console', 'network', 'security']),
  message: z.string().max(2000),
  source: z.string().max(500).nullable(),
  line: z.number().int().nonnegative().nullable(),
  at: z.string(),
});
export type PreviewIssue = z.infer<typeof PreviewIssue>;

export const PreviewDiagnostics = z.object({
  /** False when the studio could not attach its inspector (e.g. another debugger holds the window). */
  available: z.boolean(),
  motion: PreviewMotion,
  issues: z.array(PreviewIssue).max(50),
  /** Issues dropped after the cap, so the UI can say so instead of hiding them silently. */
  dropped: z.number().int().nonnegative(),
});
export type PreviewDiagnostics = z.infer<typeof PreviewDiagnostics>;

export const ProviderStatus = z.object({
  id: z.enum(['claude-code', 'codex']),
  displayName: z.string(),
  state: z.enum(['available', 'not-found', 'error']),
  version: z.string().nullable(),
  // We only detect the official CLI binary. Authentication is managed by the
  // provider's own tooling and is never inspected or proxied by the studio.
  authentication: z.literal('managed-by-provider-cli'),
  detail: z.string().nullable(),
});
export type ProviderStatus = z.infer<typeof ProviderStatus>;

export const SkillManifest = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  source: z.string(),
  license: z.string(),
  supportedTargets: z.array(z.string()),
  triggers: z.array(z.string()),
  permissions: z.array(z.string()),
  hash: z.string(),
  files: z.number().int(),
  // pinned: hash matches skills.lock.json · modified: content changed since pinning · unpinned: never reviewed
  pin: z.enum(['pinned', 'modified', 'unpinned']),
  hasScripts: z.boolean(),
  scriptsApproved: z.boolean(),
  enabled: z.boolean(),
  reason: z.string().nullable(),
});
export type SkillManifest = z.infer<typeof SkillManifest>;

export const ProjectDetail = z.object({
  project: ProjectSummary,
  versions: z.array(ProjectVersion),
  jobs: z.array(JobSnapshot),
});
export type ProjectDetail = z.infer<typeof ProjectDetail>;

export { StudioSettings };

/** What the renderer is showing, so the native menu can enable/check the right items. */
export const MenuState = z.strictObject({
  view: z.enum(['project', 'new', 'skills', 'providers', 'welcome', 'empty']),
  projectId: ProjectId.nullable(),
  canGenerate: z.boolean(),
  canSnapshot: z.boolean(),
  canExport: z.boolean(),
  running: z.boolean(),
  tab: z.enum(['discover', 'brief', 'storyboard', 'build']).nullable(),
  target: OutputTarget,
  device: z.enum(['desktop', 'tablet', 'mobile']),
  reducedMotion: z.boolean(),
  hasPreview: z.boolean(),
});
export type MenuState = z.infer<typeof MenuState>;

export const ContextMenuRequest = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('project'), projectId: ProjectId }),
  z.strictObject({ kind: z.literal('version'), projectId: ProjectId, versionId: VersionId, label: z.string().max(200), hash: z.string().regex(/^[0-9a-f]{64}$/), current: z.boolean() }),
]);
export type ContextMenuRequest = z.infer<typeof ContextMenuRequest>;

const BriefInput = CreativeBrief.pick({ audience: true, tone: true, directionId: true, motion: true, chapters: true, notes: true }).strict();

export const ipcContract = {
  'projects.list': { request: z.void(), response: z.array(ProjectSummary) },
  'projects.create': { request: CreateProjectRequest, response: ProjectSummary },
  'projects.open': { request: z.strictObject({ projectId: ProjectId }), response: ProjectDetail },
  'versions.snapshot': { request: z.strictObject({ projectId: ProjectId, label: z.string().trim().min(1).max(80).optional() }), response: ProjectVersion },
  'versions.restore': { request: z.strictObject({ projectId: ProjectId, versionId: VersionId }), response: ProjectVersion },
  'story.validate': { request: z.strictObject({ projectId: ProjectId }), response: ValidationReport },
  'generation.start': {
    request: z.strictObject({ projectId: ProjectId, targets: z.array(OutputTarget).min(1).max(2) }),
    response: JobSnapshot,
  },
  'generation.get': { request: z.strictObject({ jobId: JobId }), response: JobSnapshot },
  'generation.cancel': { request: z.strictObject({ jobId: JobId }), response: JobSnapshot },
  'preview.start': { request: z.strictObject({ projectId: ProjectId, target: OutputTarget }), response: PreviewSession },
  'preview.setMotion': { request: z.strictObject({ motion: PreviewMotion }), response: PreviewMotion },
  'export.create': { request: z.strictObject({ projectId: ProjectId, targets: z.array(OutputTarget).min(1).max(2) }), response: ExportResult },
  'preview.issues': { request: z.strictObject({ url: z.string().url().max(2048) }), response: PreviewDiagnostics },
  'providers.probe': { request: z.void(), response: z.array(ProviderStatus) },
  'skills.list': { request: z.void(), response: z.array(SkillManifest) },
  'settings.get': { request: z.void(), response: StudioSettings },
  'settings.set': { request: StudioSettings.strict(), response: StudioSettings },
  'ai.test': { request: z.strictObject({ provider: AiProviderId }), response: JobSnapshot },
  'ai.job': { request: z.strictObject({ jobId: JobId }), response: JobSnapshot },
  'ai.cancel': { request: z.strictObject({ jobId: JobId }), response: JobSnapshot },
  'creative.get': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.answer': { request: z.strictObject({ projectId: ProjectId, questionId: z.string().max(64), answer: DiscoveryAnswer.nullable() }), response: CreativeState },
  'creative.saveBrief': { request: z.strictObject({ projectId: ProjectId, brief: BriefInput }), response: CreativeState },
  'creative.approveBrief': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.moreDirections': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.kickoff': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.planForMe': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.aiDirections': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.aiBrief': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.draftStoryboard': { request: z.strictObject({ projectId: ProjectId, planner: StoryboardPlanner }), response: CreativeState },
  'creative.saveStoryboard': { request: z.strictObject({ projectId: ProjectId, scenes: z.array(StoryboardScene).min(1).max(8) }), response: CreativeState },
  'creative.approveStoryboard': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'references.analyze': { request: z.strictObject({ projectId: ProjectId, url: z.string().max(2048), inspiration: z.string().trim().max(300) }), response: CreativeState },
  'references.remove': { request: z.strictObject({ projectId: ProjectId, referenceId: z.string().uuid() }), response: CreativeState },
  'story.get': { request: z.strictObject({ projectId: ProjectId }), response: StorySpecSchema.nullable() },
  'story.updateScene': {
    request: z.strictObject({ projectId: ProjectId, sceneId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), content: z.unknown(), visual: z.unknown().optional(), accessibility: z.unknown().optional() }),
    response: ProjectVersion,
  },
  'ui.menuState': { request: MenuState, response: z.boolean() },
  'ui.contextMenu': { request: ContextMenuRequest, response: z.boolean() },
} as const satisfies Record<IpcChannel, { request: z.ZodType; response: z.ZodType }>;

// Compile-time guard: the contract and the channel allowlist list exactly the same channels.
const _exhaustive: Record<IpcChannel, unknown> = ipcContract;
void _exhaustive;

export type IpcRequest<C extends IpcChannel> = z.input<(typeof ipcContract)[C]['request']>;
export type IpcResponse<C extends IpcChannel> = z.output<(typeof ipcContract)[C]['response']>;

/** Shape of `window.studio` exposed by the preload script. */
export interface StudioApi {
  invoke<C extends IpcChannel>(channel: C, ...args: IpcRequest<C> extends void ? [] : [IpcRequest<C>]): Promise<IpcResponse<C>>;
  /** Subscribe to menu-bar and context-menu commands; returns an unsubscribe function. */
  onCommand(handler: (message: import('./ipc-channels.ts').MenuCommandMessage) => void): () => void;
  platform: string;
}
