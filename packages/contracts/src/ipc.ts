import { z } from 'zod';
import type { IpcChannel } from './ipc-channels.ts';
import { CreativeBrief, CreativeState, DiscoveryAnswer, StoryboardScene } from './creative.ts';

export { IPC_CHANNELS, type IpcChannel, type IpcEnvelope } from './ipc-channels.ts';

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
  kind: z.literal('generate'),
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

export const StudioSettings = z.object({
  /** Opt-in: draft storyboards with the user's own Claude Code CLI. */
  claudeStoryboard: z.boolean(),
});
export type StudioSettings = z.infer<typeof StudioSettings>;

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
  'providers.probe': { request: z.void(), response: z.array(ProviderStatus) },
  'skills.list': { request: z.void(), response: z.array(SkillManifest) },
  'settings.get': { request: z.void(), response: StudioSettings },
  'settings.set': { request: StudioSettings.strict(), response: StudioSettings },
  'creative.get': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.answer': { request: z.strictObject({ projectId: ProjectId, questionId: z.string().max(64), answer: DiscoveryAnswer.nullable() }), response: CreativeState },
  'creative.saveBrief': { request: z.strictObject({ projectId: ProjectId, brief: BriefInput }), response: CreativeState },
  'creative.approveBrief': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'creative.draftStoryboard': { request: z.strictObject({ projectId: ProjectId, planner: z.enum(['local-planner', 'claude-code']) }), response: CreativeState },
  'creative.saveStoryboard': { request: z.strictObject({ projectId: ProjectId, scenes: z.array(StoryboardScene).min(1).max(8) }), response: CreativeState },
  'creative.approveStoryboard': { request: z.strictObject({ projectId: ProjectId }), response: CreativeState },
  'references.analyze': { request: z.strictObject({ projectId: ProjectId, url: z.string().max(2048), inspiration: z.string().trim().max(300) }), response: CreativeState },
  'references.remove': { request: z.strictObject({ projectId: ProjectId, referenceId: z.string().uuid() }), response: CreativeState },
} as const satisfies Record<IpcChannel, { request: z.ZodType; response: z.ZodType }>;

// Compile-time guard: the contract and the channel allowlist list exactly the same channels.
const _exhaustive: Record<IpcChannel, unknown> = ipcContract;
void _exhaustive;

export type IpcRequest<C extends IpcChannel> = z.input<(typeof ipcContract)[C]['request']>;
export type IpcResponse<C extends IpcChannel> = z.output<(typeof ipcContract)[C]['response']>;

/** Shape of `window.studio` exposed by the preload script. */
export interface StudioApi {
  invoke<C extends IpcChannel>(channel: C, ...args: IpcRequest<C> extends void ? [] : [IpcRequest<C>]): Promise<IpcResponse<C>>;
  platform: string;
}
