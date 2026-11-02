import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, protocol, session, shell, type WebContents } from 'electron';
import type { StorySpec } from '@studio/contracts';
import { APP_ORIGIN, registerIpc } from './ipc.ts';
import { captureReference } from './capture.ts';
import { StudioMenus } from './menu.ts';
import { PREVIEW_ORIGIN, PreviewInspector } from './preview-inspector.ts';
import { StudioServices } from './services.ts';

// Layout produced by scripts/build.ts:
//   dist/main.mjs, dist/preload.cjs, dist/renderer/**, dist/resources/**
const distDir = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.join(distDir, 'renderer');
const resourcesDir = path.join(distDir, 'resources');

const RENDERER_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  // Previews are served by the studio's loopback server and framed in a sandboxed iframe.
  'frame-src http://127.0.0.1:*',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: false } }]);
app.enableSandbox();

// One studio per workspace: the lock guards the default workspace, while an explicit
// development workspace (STUDIO_WORKSPACE, unpackaged only) runs alongside it.
const workspaceOverride = process.env.STUDIO_WORKSPACE && !app.isPackaged ? path.resolve(process.env.STUDIO_WORKSPACE) : null;
if (!workspaceOverride && !app.requestSingleInstanceLock()) {
  app.quit();
}

/** Serve the bundled renderer from app://studio/ with path containment and a strict CSP. */
function registerAppProtocol(rendererRoot: string): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'studio') return new Response('Not found', { status: 404 });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(rendererRoot, relative);
    try {
      const real = await realpath(file);
      if (!real.startsWith(rendererRoot + path.sep)) return new Response('Not found', { status: 404 });
      const body = await readFile(real);
      return new Response(body, {
        headers: {
          'Content-Type': MIME[path.extname(real)] ?? 'application/octet-stream',
          'Content-Security-Policy': RENDERER_CSP,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/** Navigation, window and permission lockdown for every web contents we create. */
function hardenContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    // External links open in the user's browser, only for https.
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0E0E11',
    title: 'Spanda Studio',
    icon: path.join(resourcesDir, 'icons', 'icon.png'), // Windows/Linux; macOS takes the Dock icon below
    webPreferences: {
      preload: path.join(distDir, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  void win.loadURL(`${APP_ORIGIN}/index.html`);
  return win;
}

let services: StudioServices | undefined;
const inspectors = new WeakMap<WebContents, PreviewInspector>();

/** Watch a studio window's preview frame (reduced-motion emulation, runtime errors). */
function inspect(contents: WebContents): void {
  const inspector = new PreviewInspector(contents.debugger, (url) => PREVIEW_ORIGIN.test(url));
  inspectors.set(contents, inspector);
  void inspector.start();
}

app.on('web-contents-created', (_event, contents) => hardenContents(contents));

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  // Unpackaged runs would show Electron's icon; a packaged app gets icon.icns from its bundle instead.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(path.join(resourcesDir, 'icons', 'macos-dock.png'));
  // Deny every permission request (camera, mic, geolocation, notifications…).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  // Compare against the canonical path: drive-letter case (Windows) and symlinks (/private on macOS) differ otherwise.
  registerAppProtocol(await realpath(rendererDir));

  const workspaceRoot = workspaceOverride ?? path.join(app.getPath('userData'), 'workspace');
  services = new StudioServices(workspaceRoot, {
    htmlRuntimeDir: path.join(resourcesDir, 'html-runtime'),
    threeDir: path.join(resourcesDir, 'three'),
    reactTemplateDir: path.join(resourcesDir, 'react-template'),
    skillsDir: path.join(resourcesDir, 'skills'),
  }, { capture: captureReference });
  const sample = JSON.parse(await readFile(path.join(resourcesDir, 'story-spec.example.json'), 'utf8')) as StorySpec;
  await services.init(sample);
  app.setAboutPanelOptions({
    applicationName: 'Spanda Studio',
    applicationVersion: app.getVersion(),
    copyright: 'Stillness, set in motion. Designed and built in India.',
    credits: 'Built with Electron, React, three.js and React Three Fiber. See bundled license notices.',
  });
  const menus = new StudioMenus(services, !app.isPackaged);
  menus.install();
  registerIpc(services, menus, (contents) => inspectors.get(contents));
  const open = () => {
    const win = createWindow();
    menus.attach(win.webContents);
    inspect(win.webContents);
  };
  open();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open();
  });
}).catch((err: unknown) => {
  console.error('Failed to start Spanda Studio', err);
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void services?.dispose();
});

