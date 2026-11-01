import { BrowserWindow, session } from 'electron';
import { fetchVetted, vetUrl } from '@studio/reference-analyzer';

// Reference screenshots render untrusted pages. Defence in depth:
// - The capture session never opens its own connections: every http/https
//   request (page and subresources) is served by a session-scoped protocol
//   handler that fetches through the SSRF-vetted, IP-pinned fetcher, so DNS
//   rebinding between "check" and "connect" is impossible.
// - JavaScript is disabled (a static screenshot is enough), which also rules
//   out WebRTC, workers and script-driven requests; WebRTC IP handling is
//   restricted as well.
// - In-memory session, no preload, sandboxed renderer, all permissions denied,
//   downloads cancelled, popups and navigations blocked, request count capped.

const PARTITION = 'reference-capture'; // no "persist:" prefix → in-memory
const MAX_REQUESTS = 80;
const MAX_RESOURCE_BYTES = 3_000_000;
let configured = false;
let budget = MAX_REQUESTS;

function captureSession() {
  const ses = session.fromPartition(PARTITION);
  if (configured) return ses;
  configured = true;
  ses.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.on('will-download', (event) => event.preventDefault());
  // Anything that is not http(s)/data (ws:, file:, custom schemes…) is cancelled outright.
  ses.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !/^(https?:|data:)/.test(details.url) });
  });
  const proxy = async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' || budget <= 0) return new Response(null, { status: 403 });
    budget -= 1;
    try {
      const res = await fetchVetted(request.url, { limits: { maxBytes: MAX_RESOURCE_BYTES, timeoutMs: 10_000, maxRedirects: 4 } });
      return new Response(new Uint8Array(res.body), {
        status: res.status,
        headers: { 'Content-Type': res.contentType || 'application/octet-stream', 'Content-Security-Policy': "script-src 'none'; connect-src 'none'; worker-src 'none'; object-src 'none'" },
      });
    } catch {
      return new Response(null, { status: 403 });
    }
  };
  ses.protocol.handle('https', proxy);
  ses.protocol.handle('http', proxy);
  return ses;
}

/** Capture a 1280×800 view of a vetted public page as a small JPEG data URL (best effort). */
export async function captureReference(url: string): Promise<string | null> {
  await vetUrl(url);
  budget = MAX_REQUESTS;
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { session: captureSession(), sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webSecurity: true, images: true, offscreen: true, webgl: false, plugins: false },
  });
  win.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setAudioMuted(true);
  try {
    await Promise.race([win.loadURL(url), new Promise((_, reject) => setTimeout(() => reject(new Error('capture timeout')), 15_000))]);
    await new Promise((r) => setTimeout(r, 800)); // let images and fonts paint
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 800 });
    if (image.isEmpty()) return null;
    return `data:image/jpeg;base64,${image.resize({ width: 640 }).toJPEG(70).toString('base64')}`;
  } catch {
    return null;
  } finally {
    win.destroy();
  }
}
