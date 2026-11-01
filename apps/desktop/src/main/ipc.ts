import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, ipcContract, type IpcChannel, type IpcEnvelope } from '@studio/contracts';
import { isTrustedSender } from './sender.ts';
import type { StudioMenus } from './menu.ts';
import type { StudioServices } from './services.ts';

export { APP_ORIGIN } from './sender.ts';

function describe(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Never leak absolute host paths to the renderer.
  return message.replace(/(?:[A-Za-z]:\\|\/)(?:[^\s'"]+[\\/])+/g, '…/');
}

export function registerIpc(services: StudioServices, menus: StudioMenus): void {
  const handlers: { [C in IpcChannel]: (req: unknown, event: IpcMainInvokeEvent) => unknown } = {
    'ui.menuState': (req) => {
      menus.update(req as Parameters<StudioMenus['update']>[0]);
      return true;
    },
    'ui.contextMenu': (req, event) => {
      menus.popup(req as Parameters<StudioMenus['popup']>[0], event.sender);
      return true;
    },
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
    'settings.get': () => services.settings().settings(),
    'settings.set': (req) => services.settings().saveSettings(req as { claudeStoryboard: boolean }),
    'creative.get': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).state(projectId);
    },
    'creative.answer': (req) => {
      const { projectId, questionId, answer } = req as { projectId: string; questionId: string; answer: string | null };
      return services.creative(projectId).answer(projectId, questionId, answer);
    },
    'creative.saveBrief': (req) => {
      const { projectId, brief } = req as { projectId: string; brief: Parameters<ReturnType<typeof services.creative>['saveBrief']>[1] };
      return services.creative(projectId).saveBrief(projectId, brief);
    },
    'creative.approveBrief': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).approveBrief(projectId);
    },
    'creative.draftStoryboard': (req) => {
      const { projectId, planner } = req as { projectId: string; planner: 'local-planner' | 'claude-code' };
      return services.creative(projectId).draftStoryboard(projectId, planner);
    },
    'creative.saveStoryboard': (req) => {
      const { projectId, scenes } = req as { projectId: string; scenes: Parameters<ReturnType<typeof services.creative>['saveStoryboard']>[1] };
      return services.creative(projectId).saveStoryboard(projectId, scenes);
    },
    'creative.approveStoryboard': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).approveStoryboard(projectId);
    },
    'references.analyze': (req) => {
      const { projectId, url, inspiration } = req as { projectId: string; url: string; inspiration: string };
      return services.creative(projectId).analyzeReference(projectId, url, inspiration);
    },
    'references.remove': (req) => {
      const { projectId, referenceId } = req as { projectId: string; referenceId: string };
      return services.creative(projectId).removeReference(projectId, referenceId);
    },
  };

  for (const channel of IPC_CHANNELS) {
    ipcMain.handle(channel, async (event, payload: unknown): Promise<IpcEnvelope<unknown>> => {
      if (!isTrustedSender(event.senderFrame)) return { ok: false, error: 'Untrusted sender' };
      const contract = ipcContract[channel];
      const request = contract.request.safeParse(payload);
      if (!request.success) return { ok: false, error: `Invalid request for ${channel}` };
      try {
        const value = await handlers[channel](request.data, event);
        // Validate outgoing data too, so contract drift fails loudly in development.
        return { ok: true, value: contract.response.parse(value) };
      } catch (err) {
        return { ok: false, error: describe(err) };
      }
    });
  }
}
