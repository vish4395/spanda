import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

// SSRF policy (docs/07): only http/https to public addresses. Every hostname is
// resolved and *all* returned addresses must be public; this is re-checked on
// every redirect hop. Credentials in URLs and non-default ports are refused.

const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001::', 32], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(net, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) is judged by its IPv4 part.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return !blocked.check(mapped[1]!, 'ipv4');
  return !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

export type Resolver = (hostname: string) => Promise<string[]>;

export const systemResolver: Resolver = async (hostname) => (await lookup(hostname, { all: true, verbatim: true })).map((r) => r.address);

/** Parse and vet a URL before any connection is made. Returns the URL and the vetted address. */
export async function vetUrl(raw: string, resolve: Resolver = systemResolver): Promise<{ url: URL; address: string }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BlockedUrlError('That is not a valid URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new BlockedUrlError('Only http:// and https:// links can be analysed.');
  if (url.username || url.password) throw new BlockedUrlError('Links with embedded credentials are not allowed.');
  if (url.port && url.port !== '80' && url.port !== '443') throw new BlockedUrlError('Only standard web ports (80/443) are allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new BlockedUrlError('Local and internal addresses cannot be analysed.');
  }
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => {
    throw new BlockedUrlError(`Could not resolve ${host}.`);
  });
  if (addresses.length === 0) throw new BlockedUrlError(`Could not resolve ${host}.`);
  const bad = addresses.find((a) => !isPublicAddress(a));
  if (bad) throw new BlockedUrlError(`${host} resolves to a private or reserved address (${bad}); it cannot be analysed.`);
  return { url, address: addresses[0]! };
}
