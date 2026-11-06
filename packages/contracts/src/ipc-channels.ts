// Dependency-free channel allowlist (imported by the sandboxed preload, which must stay tiny).
export const IPC_CHANNELS = [
  'projects.list',
  'projects.create',
  'projects.open',
  'versions.snapshot',
  'versions.restore',
  'story.validate',
  'generation.start',
  'generation.get',
  'generation.cancel',
  'preview.start',
  'preview.setMotion',
  'preview.issues',
  'export.create',
  'providers.probe',
  'skills.list',
  'settings.get',
  'settings.set',
  'ai.test',
  'ai.job',
  'ai.cancel',
  'creative.get',
  'creative.answer',
  'creative.saveBrief',
  'creative.approveBrief',
  'creative.moreDirections',
  'creative.kickoff',
  'creative.planForMe',
  'creative.aiDirections',
  'creative.aiBrief',
  'creative.draftStoryboard',
  'creative.saveStoryboard',
  'creative.approveStoryboard',
  'references.analyze',
  'references.remove',
  'story.get',
  'story.updateScene',
  'ui.menuState',
  'ui.contextMenu',
] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

/** IPC responses carry errors as data so the renderer can show them honestly. */
export type IpcEnvelope<T> = { ok: true; value: T } | { ok: false; error: string };

/** Commands the main process may send to the renderer (menu bar, context menus). */
export const MENU_COMMANDS = [
  'project.new',
  'project.open',
  'project.snapshot',
  'project.generate',
  'project.cancel',
  'project.export',
  'version.restore',
  'tab.discover',
  'tab.brief',
  'tab.storyboard',
  'tab.build',
  'target.html',
  'target.react',
  'device.desktop',
  'device.tablet',
  'device.mobile',
  'preview.reload',
  'preview.reducedMotion',
  'view.providers',
  'view.skills',
] as const;

export type MenuCommand = (typeof MENU_COMMANDS)[number];

export interface MenuCommandMessage {
  command: MenuCommand;
  projectId?: string;
  versionId?: string;
}

export const MENU_COMMAND_CHANNEL = 'menu:command';
