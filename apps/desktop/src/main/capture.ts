import { BrowserWindow, session } from 'electron';
import { vetUrl } from '@studio/reference-analyzer';

// Reference screenshots render untrusted pages, so they run in a dedicated
// in-memory session with no preload, no Node, a sandboxed renderer, every
// permission denied, downloads cancelled, and *every* network request (page,
// subresources, redirects, websockets) re-vetted by the SSRF policy.

const PARTITION = 'reference-capture'; // no "persist:" prefix → in-memory, nothing written to disk
let configured = false;

function captureSession() {
  const ses = session.fromPartition(PARTITION);
  if (configured) return ses;
  configured = true;
  ses.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.on('will-download', (event) => event.preventDefault());
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    if (url.startsWith('data:') || url.startsWith('blob:')) return callback({});
    const http = url.replace(/^ws(s?):/, 'http$1:');
    if (!/^https?:/.test(http)) return callback({ cancel: true });
    vetUrl(http)
      .then(() => callback({}))
      .catch(() => callback({ cancel: true }));
  });
  return ses;
}

/** Capture a 1280×800 view of a vetted public page as a small JPEG data URL (best effort). */
export async function captureReference(url: string): Promise<string | null> {
  await vetUrl(url);
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { session: captureSession(), sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, webSecurity: true, images: true, offscreen: true },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, target) => {
    if (target !== url) event.preventDefault();
  });
  win.webContents.setAudioMuted(true);
  try {
    await Promise.race([win.loadURL(url), new Promise((_, reject) => setTimeout(() => reject(new Error('capture timeout')), 15_000))]);
    await new Promise((r) => setTimeout(r, 1200)); // let above-the-fold content settle
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 800 });
    if (image.isEmpty()) return null;
    return `data:image/jpeg;base64,${image.resize({ width: 640 }).toJPEG(70).toString('base64')}`;
  } catch {
    return null;
  } finally {
    win.destroy();
  }
}
