import { ipcMain } from 'electron';
import { IPC_CHANNELS, ipcContract, type IpcChannel, type IpcEnvelope } from '@studio/contracts';
import { isTrustedSender } from './sender.ts';
import type { StudioServices } from './services.ts';

export { APP_ORIGIN } from './sender.ts';

function describe(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Never leak absolute host paths to the renderer.
  return message.replace(/(?:[A-Za-z]:\\|\/)(?:[^\s'"]+[\\/])+/g, '…/');
}

export function registerIpc(services: StudioServices): void {
  const handlers: { [C in IpcChannel]: (req: unknown) => unknown } = {
    'projects.list': () => services.listProjects(),
    'projects.create': (req) => services.createProject(req as { name: string; goal: string }),
    'projects.open': (req) => services.openProject((req as { projectId: string }).projectId),
    'versions.snapshot': (req) => {
      const { projectId, label } = req as { projectId: string; label?: string };
      return services.snapshot(projectId, label);
    },
    'versions.restore': (req) => {
      const { projectId, versionId } = req as { projectId: string; versionId: string };
      return services.restore(projectId, versionId);
    },
    'story.validate': (req) => services.validate((req as { projectId: string }).projectId),
    'generation.start': (req) => {
      const { projectId, targets } = req as { projectId: string; targets: ('html' | 'react')[] };
      return services.startGeneration(projectId, targets);
    },
    'generation.get': (req) => services.getJob((req as { jobId: string }).jobId),
    'generation.cancel': (req) => services.cancelJob((req as { jobId: string }).jobId),
    'preview.start': (req) => {
      const { projectId, target } = req as { projectId: string; target: 'html' | 'react' };
      return services.startPreview(projectId, target);
    },
    'providers.probe': () => services.probeProviders(),
    'skills.list': () => services.listSkills(),
  };

  for (const channel of IPC_CHANNELS) {
    ipcMain.handle(channel, async (event, payload: unknown): Promise<IpcEnvelope<unknown>> => {
      if (!isTrustedSender(event.senderFrame)) return { ok: false, error: 'Untrusted sender' };
      const contract = ipcContract[channel];
      const request = contract.request.safeParse(payload);
      if (!request.success) return { ok: false, error: `Invalid request for ${channel}` };
      try {
        const value = await handlers[channel](request.data);
        // Validate outgoing data too, so contract drift fails loudly in development.
        return { ok: true, value: contract.response.parse(value) };
      } catch (err) {
        return { ok: false, error: describe(err) };
      }
    });
  }
}
