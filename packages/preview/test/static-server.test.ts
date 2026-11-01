import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startStaticServer, type StaticServer } from '../src/index.ts';

let server: StaticServer;
let secretDir: string;

// Raw HTTP so we can send paths/hosts that fetch() would normalise.
function raw(pathname: string, host?: string): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  const base = new URL(server.url);
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: base.port, path: pathname, headers: { host: host ?? base.host } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-preview-'));
  secretDir = await mkdtemp(path.join(tmpdir(), 'studio-secret-'));
  await writeFile(path.join(secretDir, 'secret.txt'), 'TOP SECRET');
  await writeFile(path.join(root, 'index.html'), '<h1>hi</h1>');
  await mkdir(path.join(root, 'js'));
  await writeFile(path.join(root, 'js/app.js'), 'export {}');
  await writeFile(path.join(root, '.env'), 'KEY=1');
  await symlink(secretDir, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  server = await startStaticServer(root);
});
afterAll(() => server.close());

describe('preview static server', () => {
  it('binds to loopback and serves index with security headers', async () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}\/$/);
    const prefix = new URL(server.url).pathname;
    const res = await raw(prefix);
    expect(res.status).toBe(200);
    expect(res.body).toBe('<h1>hi</h1>');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect((await raw(`${prefix}js/app.js`)).headers['content-type']).toContain('text/javascript');
  });

  it('requires the session token', async () => {
    expect((await raw('/index.html')).status).toBe(404);
    expect((await raw('/0000/index.html')).status).toBe(404);
  });

  it('blocks traversal, encoded traversal, dotfiles and symlink escapes', async () => {
    const prefix = new URL(server.url).pathname;
    for (const p of ['../../etc/passwd', '..%2f..%2fetc%2fpasswd', '%2e%2e/%2e%2e/etc/passwd', '.env', 'escape/secret.txt', '%00']) {
      const res = await raw(`${prefix}${p}`);
      expect(res.status, p).not.toBe(200);
      expect(res.body).not.toContain('TOP SECRET');
    }
  });

  it('rejects DNS-rebinding hosts', async () => {
    const prefix = new URL(server.url).pathname;
    expect((await raw(prefix, 'evil.example:80')).status).toBe(403);
    expect((await raw(prefix, 'localhost:1234')).status).toBe(403);
  });
});
