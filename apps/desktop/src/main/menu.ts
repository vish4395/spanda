import { app, BrowserWindow, clipboard, Menu, shell, type ContextMenuParams, type MenuItemConstructorOptions, type WebContents } from 'electron';
import { MENU_COMMAND_CHANNEL, type ContextMenuRequest, type MenuCommandMessage, type MenuState } from '@studio/contracts';
import { PREVIEW_ORIGIN } from './preview-inspector.ts';
import type { StudioServices } from './services.ts';

// Native menus (menu bar + context menus). Items either use Electron roles
// (edit, window, zoom…) or send an allowlisted command to the renderer, which
// performs the same action as the on-screen control. Enabled/checked states
// follow the renderer's reported MenuState so items never do nothing.

const isMac = process.platform === 'darwin';
const revealLabel = isMac ? 'Reveal in Finder' : process.platform === 'win32' ? 'Show in Explorer' : 'Open Containing Folder';

const INITIAL_STATE: MenuState = {
  view: 'empty',
  projectId: null,
  canGenerate: false,
  canSnapshot: false,
  canExport: false,
  running: false,
  tab: null,
  target: 'html',
  device: 'desktop',
  reducedMotion: false,
  hasPreview: false,
};

export class StudioMenus {
  private state: MenuState = INITIAL_STATE;
  private readonly services: StudioServices;
  private readonly dev: boolean;

  constructor(services: StudioServices, dev: boolean) {
    this.services = services;
    this.dev = dev;
  }

  private send(message: MenuCommandMessage, target?: WebContents): void {
    const contents = target ?? BrowserWindow.getFocusedWindow()?.webContents ?? BrowserWindow.getAllWindows()[0]?.webContents;
    contents?.send(MENU_COMMAND_CHANNEL, message);
  }

  private command(id: MenuCommandMessage['command'], label: string, extra: Partial<MenuItemConstructorOptions> = {}): MenuItemConstructorOptions {
    return { id, label, click: () => this.send({ command: id, ...(this.state.projectId ? { projectId: this.state.projectId } : {}) }), ...extra };
  }

  /** Menu bar template; rebuilt whenever renderer state changes (cheap, and keeps labels/checks exact). */
  template(): MenuItemConstructorOptions[] {
    const s = this.state;
    const inProject = s.view === 'project' && s.projectId !== null;
    const settings = this.command('view.providers', isMac ? 'Settings…' : 'Settings', { accelerator: 'CmdOrCtrl+,' });
    const tab = (id: 'discover' | 'brief' | 'storyboard' | 'build', label: string, key: string) =>
      this.command(`tab.${id}`, label, { accelerator: `CmdOrCtrl+${key}`, type: 'radio', checked: s.tab === id, enabled: inProject });
    return [
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' },
                { type: 'separator' },
                settings,
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
              ] as MenuItemConstructorOptions[],
            },
          ]
        : []),
      {
        label: '&File',
        submenu: [
          this.command('project.new', 'New Project…', { accelerator: 'CmdOrCtrl+N' }),
          { type: 'separator' },
          this.command('project.snapshot', 'Save Snapshot', { accelerator: 'CmdOrCtrl+S', enabled: inProject && s.canSnapshot }),
          this.command('project.export', 'Export Website…', { accelerator: 'CmdOrCtrl+E', enabled: inProject && s.canExport }),
          {
            id: 'project.reveal',
            label: revealLabel,
            enabled: inProject,
            click: () => s.projectId && this.reveal(s.projectId),
          },
          { type: 'separator' },
          ...(isMac ? [{ role: 'close' } as MenuItemConstructorOptions] : [settings, { type: 'separator' } as MenuItemConstructorOptions, { role: 'quit', label: 'E&xit' } as MenuItemConstructorOptions]),
        ],
      },
      {
        label: '&Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(isMac ? ([{ role: 'pasteAndMatchStyle' }, { role: 'delete' }] as MenuItemConstructorOptions[]) : ([{ role: 'delete' }] as MenuItemConstructorOptions[])),
          { type: 'separator' },
          { role: 'selectAll' },
        ],
      },
      {
        label: '&View',
        submenu: [
          tab('discover', 'Discover', '1'),
          tab('brief', 'Brief', '2'),
          tab('storyboard', 'Storyboard', '3'),
          tab('build', 'Build and Preview', '4'),
          { type: 'separator' },
          {
            label: 'Preview Target',
            enabled: inProject,
            submenu: [
              this.command('target.html', 'HTML', { type: 'radio', checked: s.target === 'html', enabled: inProject }),
              this.command('target.react', 'React', { type: 'radio', checked: s.target === 'react', enabled: inProject }),
            ],
          },
          {
            label: 'Device Size',
            enabled: inProject,
            submenu: [
              this.command('device.desktop', 'Desktop (1440 × 900)', { type: 'radio', checked: s.device === 'desktop', enabled: inProject, accelerator: 'CmdOrCtrl+Alt+1' }),
              this.command('device.tablet', 'Tablet (768 × 1024)', { type: 'radio', checked: s.device === 'tablet', enabled: inProject, accelerator: 'CmdOrCtrl+Alt+2' }),
              this.command('device.mobile', 'Mobile (390 × 844)', { type: 'radio', checked: s.device === 'mobile', enabled: inProject, accelerator: 'CmdOrCtrl+Alt+3' }),
            ],
          },
          this.command('preview.reducedMotion', 'Preview with Reduced Motion', { type: 'checkbox', checked: s.reducedMotion, enabled: inProject }),
          this.command('preview.reload', 'Reload Preview', { accelerator: 'CmdOrCtrl+Shift+R', enabled: inProject && s.hasPreview }),
          { type: 'separator' },
          this.command('view.skills', 'Skills'),
          this.command('view.providers', 'AI Providers'),
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          ...(this.dev ? ([{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[]) : []),
        ],
      },
      {
        label: '&Project',
        submenu: [
          this.command('project.generate', 'Generate HTML + React', { accelerator: 'CmdOrCtrl+Enter', enabled: inProject && s.canGenerate && !s.running }),
          this.command('project.cancel', 'Cancel Generation', { accelerator: 'CmdOrCtrl+.', enabled: inProject && s.running }),
        ],
      },
      { role: 'windowMenu' },
      {
        role: 'help',
        submenu: [
          { label: 'Open Workspace Folder', click: () => void shell.openPath(this.services.workspace.root) },
          this.command('view.providers', 'About AI Providers and Privacy'),
          ...(isMac ? [] : ([{ type: 'separator' }, { label: 'About Spanda Studio', click: () => app.showAboutPanel() }] as MenuItemConstructorOptions[])),
        ],
      },
    ];
  }

  install(): void {
    Menu.setApplicationMenu(Menu.buildFromTemplate(this.template()));
  }

  update(state: MenuState): void {
    this.state = state;
    this.install();
  }

  private reveal(projectId: string): void {
    // Path resolved here from a validated project ID — the renderer never supplies paths.
    if (this.services.store.hasProject(projectId)) shell.showItemInFolder(this.services.workspace.projectDir(projectId));
  }

  /** Context menus requested by the renderer for its own components. */
  popup(request: ContextMenuRequest, sender: WebContents): void {
    const window = BrowserWindow.fromWebContents(sender) ?? undefined;
    let items: MenuItemConstructorOptions[];
    if (request.kind === 'project') {
      if (!this.services.store.hasProject(request.projectId)) return;
      const projectId = request.projectId;
      const isOpen = this.state.projectId === projectId;
      items = [
        { label: 'Open', enabled: !isOpen, click: () => this.send({ command: 'project.open', projectId }, sender) },
        { label: 'Generate HTML + React', enabled: !this.state.running, click: () => this.send({ command: 'project.generate', projectId }, sender) },
        { label: 'Save Snapshot', click: () => this.send({ command: 'project.snapshot', projectId }, sender) },
        { type: 'separator' },
        { label: revealLabel, click: () => this.reveal(projectId) },
        { label: 'Copy Project ID', click: () => clipboard.writeText(projectId) },
      ];
    } else {
      const { projectId, versionId, hash } = request;
      items = [
        { label: request.current ? 'Current version' : 'Restore This Version', enabled: !request.current && !this.state.running, click: () => this.send({ command: 'version.restore', projectId, versionId }, sender) },
        { type: 'separator' },
        { label: 'Copy Content Hash', click: () => clipboard.writeText(hash) },
      ];
    }
    Menu.buildFromTemplate(items).popup(window ? { window } : {});
  }

  /** Default context menus: editable fields, text selections and the preview frame. */
  attach(contents: WebContents): void {
    contents.on('context-menu', (_event, params) => {
      const items = this.contextItems(params, contents);
      const window = BrowserWindow.fromWebContents(contents);
      if (items.length) Menu.buildFromTemplate(items).popup(window ? { window } : {});
    });
  }

  contextItems(params: Pick<ContextMenuParams, 'isEditable' | 'selectionText' | 'editFlags' | 'frameURL' | 'x' | 'y'>, contents: WebContents): MenuItemConstructorOptions[] {
    const items: MenuItemConstructorOptions[] = [];
    const preview = PREVIEW_ORIGIN.exec(params.frameURL ?? '')?.[0];
    if (params.isEditable) {
      const f = params.editFlags;
      items.push(
        { role: 'undo', enabled: f.canUndo },
        { role: 'redo', enabled: f.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: f.canCut },
        { role: 'copy', enabled: f.canCopy },
        { role: 'paste', enabled: f.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: f.canSelectAll },
      );
    } else if (params.selectionText.trim()) {
      items.push({ role: 'copy' });
    }
    if (preview) {
      if (items.length) items.push({ type: 'separator' });
      items.push(
        { label: 'Reload Preview', click: () => this.send({ command: 'preview.reload' }, contents) },
        { label: 'Copy Preview Link', click: () => clipboard.writeText(preview) },
        // Only the loopback preview origin may be opened externally.
        { label: 'Open Preview in Browser', click: () => void shell.openExternal(preview) },
      );
    }
    if (this.dev) {
      if (items.length) items.push({ type: 'separator' });
      items.push({ label: 'Inspect Element', click: () => contents.inspectElement(params.x, params.y) });
    }
    return items;
  }
}
