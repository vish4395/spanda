// Sandboxed preload: the only bridge between the unprivileged renderer and main.
// Exposes a single `invoke` restricted to the typed channel allowlist.
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type IpcEnvelope } from '@studio/contracts/ipc-channels';
import type { StudioApi } from '@studio/contracts/ipc';

const allowed = new Set<string>(IPC_CHANNELS);

const api: StudioApi = {
  async invoke(channel: string, ...args: unknown[]) {
    if (!allowed.has(channel)) throw new Error(`Unknown channel: ${channel}`);
    const envelope = (await ipcRenderer.invoke(channel, args[0])) as IpcEnvelope<unknown>;
    if (!envelope.ok) throw new Error(envelope.error);
    return envelope.value;
  },
  platform: process.platform,
} as StudioApi;

contextBridge.exposeInMainWorld('studio', Object.freeze(api));
