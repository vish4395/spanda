import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, ipcContract, type IpcChannel, type IpcEnvelope } from '@studio/contracts';
import { isTrustedSender } from './sender.ts';
import type { StudioMenus } from './menu.ts';
import type { PreviewInspector } from './preview-inspector.ts';
import type { StudioServices } from './services.ts';

export { APP_ORIGIN } from './sender.ts';

declare const __STUDIO_VERSION__: string;

function describe(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Never leak absolute host paths to the renderer.
  return message.replace(/(?:[A-Za-z]:\\|\/)(?:[^\s'"]+[\\/])+/g, '…/');
}

export function registerIpc(services: StudioServices, menus: StudioMenus, inspectorFor: (contents: IpcMainInvokeEvent['sender']) => PreviewInspector | undefined): void {
  const inspector = (event: IpcMainInvokeEvent) => {
    const found = inspectorFor(event.sender);
    if (!found) throw new Error('Preview inspector is not available for this window');
    return found;
  };
  const handlers: { [C in IpcChannel]: (req: unknown, event: IpcMainInvokeEvent) => unknown } = {
    'story.get': (req) => services.getSpec((req as { projectId: string }).projectId),
    'story.updateScene': (req) => {
      const { projectId, sceneId, content, visual, accessibility } = req as { projectId: string; sceneId: string; content: unknown; visual?: unknown; accessibility?: unknown };
      return services.updateScene(projectId, sceneId, { content, ...(visual !== undefined ? { visual } : {}), ...(accessibility !== undefined ? { accessibility } : {}) });
    },
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
    'export.create': async (req, event) => {
      const { projectId, targets } = req as { projectId: string; targets: ('html' | 'react')[] };
      // Build first so a refusal (stale output, blocked license) is reported before asking where to save.
      const result = await services.buildExport(projectId, targets, __STUDIO_VERSION__);
      const owner = BrowserWindow.fromWebContents(event.sender);
      const options = { title: 'Export website', defaultPath: path.join(app.getPath('downloads'), result.suggestedName), filters: [{ name: 'ZIP archive', extensions: ['zip'] }] };
      const choice = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
      if (choice.canceled || !choice.filePath) return { status: 'canceled' };
      const file = choice.filePath.toLowerCase().endsWith('.zip') ? choice.filePath : `${choice.filePath}.zip`;
      await writeFile(file, result.zip);
      return { status: 'saved', fileName: path.basename(file), files: result.files, bytes: result.bytes, licenses: result.licenses, rights: result.rights };
    },
    'preview.setMotion': (req, event) => inspector(event).setMotion((req as { motion: 'full' | 'reduce' }).motion),
    'preview.issues': (req, event) => inspector(event).diagnostics((req as { url: string }).url),
    'providers.probe': () => services.probeProviders(),
    'skills.list': () => services.listSkills(),
    'settings.get': () => services.settings().settings(),
    'settings.set': (req) => services.settings().saveSettings(req as Parameters<ReturnType<typeof services.settings>['saveSettings']>[0]),
    'ai.test': (req) => services.testProvider((req as { provider: 'claude-code' | 'codex' }).provider),
    'ai.job': (req) => services.getAiJob((req as { jobId: string }).jobId),
    'ai.cancel': (req) => services.cancelAiJob((req as { jobId: string }).jobId),
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
    'creative.moreDirections': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).moreDirections(projectId);
    },
    'creative.aiDirections': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).aiDirections(projectId);
    },
    'creative.aiBrief': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).aiBrief(projectId);
    },
    'creative.kickoff': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).kickoff(projectId);
    },
    'creative.approveBrief': (req) => {
      const { projectId } = req as { projectId: string };
      return services.creative(projectId).approveBrief(projectId);
    },
    'creative.draftStoryboard': (req) => {
      const { projectId, planner } = req as { projectId: string; planner: 'local-planner' | 'claude-code' | 'codex' };
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
