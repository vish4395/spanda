// Dependency-free channel allowlist (imported by the sandboxed preload, which must stay tiny).
export const IPC_CHANNELS = [
  'projects.list',
  'story.validate',
  'generation.start',
  'generation.get',
  'generation.cancel',
  'preview.start',
  'providers.probe',
] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

/** IPC responses carry errors as data so the renderer can show them honestly. */
export type IpcEnvelope<T> = { ok: true; value: T } | { ok: false; error: string };
