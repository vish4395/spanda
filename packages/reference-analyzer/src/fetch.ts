import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { BlockedUrlError, systemResolver, vetUrl, type Resolver } from './net-policy.ts';

export interface FetchLimits {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
}

export const DEFAULT_LIMITS: FetchLimits = { maxBytes: 2_000_000, timeoutMs: 15_000, maxRedirects: 4 };

export interface FetchedPage {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

interface FetchOptions {
  resolve?: Resolver;
  limits?: Partial<FetchLimits>;
  /** Test hook: allow loopback servers. Never set in the app. */
  allowLoopbackForTests?: boolean;
}

function once(url: URL, address: string, limits: FetchLimits, signal: AbortSignal, accept: string): Promise<{ res: IncomingMessage; body: Buffer; truncated: boolean }> {
  const requester = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = requester(
      url,
      {
        method: 'GET',
        signal,
        // Pin the connection to the vetted address so DNS cannot change between check and connect.
        lookup: (_host, _opts, cb) => cb(null, [{ address, family: isIP(address) }] as never),
        headers: {
          'User-Agent': 'AI-Cinematic-Studio-ReferenceAnalyzer/0.1 (+local desktop app)',
          Accept: accept,
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on('data', (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > limits.maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, chunk.length - (size - limits.maxBytes)));
            res.destroy();
            resolve({ res, body: Buffer.concat(chunks), truncated });
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ res, body: Buffer.concat(chunks), truncated }));
        res.on('error', (err) => (truncated ? undefined : reject(err)));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

export interface VettedResponse {
  finalUrl: string;
  status: number;
  contentType: string;
  body: Buffer;
  truncated: boolean;
}

/**
 * Fetch any public resource with SSRF checks on every redirect hop and the
 * socket pinned to the vetted address. Used for pages and, by the screenshot
 * session, for every subresource — Chromium never connects on its own.
 */
export async function fetchVetted(rawUrl: string, options: FetchOptions & { accept?: string } = {}): Promise<VettedResponse> {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const resolve = options.resolve ?? systemResolver;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  try {
    let current = rawUrl;
    for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
      const vetted = options.allowLoopbackForTests ? { url: new URL(current), address: '127.0.0.1' } : await vetUrl(current, resolve);
      const { res, body, truncated } = await once(vetted.url, vetted.address, limits, controller.signal, options.accept ?? '*/*');
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        current = new URL(res.headers.location, vetted.url).toString();
        continue;
      }
      return { finalUrl: vetted.url.toString(), status, contentType: String(res.headers['content-type'] ?? ''), body, truncated };
    }
    throw new BlockedUrlError(`Too many redirects (more than ${limits.maxRedirects}).`);
  } catch (err) {
    if (controller.signal.aborted) throw new BlockedUrlError(`Timed out after ${limits.timeoutMs / 1000}s.`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a public HTML page (no cookies, size/time/redirect caps). */
export async function safeFetch(rawUrl: string, options: FetchOptions = {}): Promise<FetchedPage> {
  const res = await fetchVetted(rawUrl, { ...options, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' });
  if (res.status >= 400) throw new BlockedUrlError(`The page returned HTTP ${res.status}.`);
  if (!/text\/html|application\/xhtml\+xml/i.test(res.contentType)) throw new BlockedUrlError(`Expected an HTML page but got "${res.contentType || 'unknown'}".`);
  return { requestedUrl: rawUrl, finalUrl: res.finalUrl, status: res.status, contentType: res.contentType, body: res.body.toString('utf8'), truncated: res.truncated };
}
