import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export interface StaticServer {
  /** Base URL including the unguessable session token, ending in `/`. */
  url: string;
  root: string;
  close(): Promise<void>;
}

/**
 * Serve one generated site from 127.0.0.1 only. Files are served from `root`
 * after realpath containment checks; every URL must carry a random per-session
 * token so other local web pages cannot guess the preview origin's paths.
 */
export async function startStaticServer(rootDir: string, options: { port?: number } = {}): Promise<StaticServer> {
  const root = await realpath(rootDir);
  const token = randomBytes(16).toString('hex');
  const prefix = `/${token}/`;

  const send = (res: ServerResponse, status: number, body: string) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(body);
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    const host = req.headers.host ?? '';
    // DNS-rebinding guard: only accept requests addressed to the loopback literal.
    if (!/^127\.0\.0\.1:\d+$/.test(host)) return send(res, 403, 'Forbidden host');
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (!url.pathname.startsWith(prefix)) return send(res, 404, 'Not found');
    let relative: string;
    try {
      relative = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
      return send(res, 400, 'Bad path');
    }
    if (relative.includes('\0') || relative.split(/[\\/]/).some((seg) => seg === '..' || seg.startsWith('.'))) {
      return send(res, 404, 'Not found');
    }
    let file = path.resolve(root, relative || 'index.html');
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        file = path.join(file, 'index.html');
        info = await stat(file);
      }
      const real = await realpath(file);
      if (real !== root && !real.startsWith(root + path.sep)) return send(res, 404, 'Not found');
      if (!info.isFile()) return send(res, 404, 'Not found');
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(real).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': info.size,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        // The studio embeds previews in a sandboxed (opaque-origin) iframe, so
        // module scripts need CORS. Paths are protected by the session token.
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(real).pipe(res);
    } catch {
      send(res, 404, 'Not found');
    }
  };

  const server = createServer((req, res) => {
    handle(req, res).catch(() => send(res, 500, 'Internal error'));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}${prefix}`,
    root,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
