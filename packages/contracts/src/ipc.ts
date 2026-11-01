import { z } from 'zod';
import type { IpcChannel } from './ipc-channels.ts';

export { IPC_CHANNELS, type IpcChannel, type IpcEnvelope } from './ipc-channels.ts';

// Typed IPC allowlist shared by Electron main, preload and renderer.
// The renderer never sends file paths or commands — only opaque IDs and enums.

export const OutputTarget = z.enum(['html', 'react']);
export type OutputTarget = z.infer<typeof OutputTarget>;

const ProjectId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const JobId = z.string().uuid();

export const ProjectSummary = z.object({
  id: ProjectId,
  name: z.string(),
  goal: z.string(),
  updatedAt: z.string(),
});
export type ProjectSummary = z.infer<typeof ProjectSummary>;

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

export const ipcContract = {
  'projects.list': { request: z.void(), response: z.array(ProjectSummary) },
  'story.validate': { request: z.strictObject({ projectId: ProjectId }), response: ValidationReport },
  'generation.start': {
    request: z.strictObject({ projectId: ProjectId, targets: z.array(OutputTarget).min(1).max(2) }),
    response: JobSnapshot,
  },
  'generation.get': { request: z.strictObject({ jobId: JobId }), response: JobSnapshot },
  'generation.cancel': { request: z.strictObject({ jobId: JobId }), response: JobSnapshot },
  'preview.start': { request: z.strictObject({ projectId: ProjectId, target: OutputTarget }), response: PreviewSession },
  'providers.probe': { request: z.void(), response: z.array(ProviderStatus) },
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
