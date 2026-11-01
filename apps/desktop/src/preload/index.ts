// Sandboxed preload: the only bridge between the unprivileged renderer and main.
// Exposes `invoke` (typed channel allowlist) and `onCommand` (menu command allowlist).
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS, MENU_COMMANDS, MENU_COMMAND_CHANNEL, type IpcEnvelope, type MenuCommandMessage } from '@studio/contracts/ipc-channels';
import type { StudioApi } from '@studio/contracts/ipc';

const allowed = new Set<string>(IPC_CHANNELS);
const commands = new Set<string>(MENU_COMMANDS);
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Validate main → renderer messages too; only known commands with well-formed IDs pass. */
function sanitize(raw: unknown): MenuCommandMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { command, projectId, versionId } = raw as Record<string, unknown>;
  if (typeof command !== 'string' || !commands.has(command)) return null;
  if (projectId !== undefined && (typeof projectId !== 'string' || !ID.test(projectId))) return null;
  if (versionId !== undefined && (typeof versionId !== 'string' || !UUID.test(versionId))) return null;
  return { command: command as MenuCommandMessage['command'], ...(projectId ? { projectId } : {}), ...(versionId ? { versionId } : {}) };
}

const api: StudioApi = {
  async invoke(channel: string, ...args: unknown[]) {
    if (!allowed.has(channel)) throw new Error(`Unknown channel: ${channel}`);
    const envelope = (await ipcRenderer.invoke(channel, args[0])) as IpcEnvelope<unknown>;
    if (!envelope.ok) throw new Error(envelope.error);
    return envelope.value;
  },
  onCommand(handler) {
    const listener = (_event: IpcRendererEvent, raw: unknown) => {
      const message = sanitize(raw);
      if (message) handler(message);
    };
    ipcRenderer.on(MENU_COMMAND_CHANNEL, listener);
    return () => ipcRenderer.removeListener(MENU_COMMAND_CHANNEL, listener);
  },
  platform: process.platform,
} as StudioApi;

contextBridge.exposeInMainWorld('studio', Object.freeze(api));
