import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

// SSRF policy (docs/07): only http/https to public addresses. Every hostname is
// resolved and *all* returned addresses must be public; this is re-checked on
// every redirect hop. Credentials in URLs and non-default ports are refused.

const blockedV4 = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
] as const) blockedV4.addSubnet(net, prefix, 'ipv4');

/** Expand an IPv6 address to eight 16-bit groups (handles `::` and a trailing dotted IPv4). */
export function expandIPv6(address: string): number[] | null {
  let addr = address.toLowerCase().split('%')[0]!;
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(addr);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return null;
    addr = `${addr.slice(0, v4.index)}${((parts[0]! << 8) | parts[1]!).toString(16)}:${((parts[2]! << 8) | parts[3]!).toString(16)}`;
  }
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail].map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return groups.length === 8 && groups.every((g) => !Number.isNaN(g)) ? groups : null;
}

const v4From = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

/**
 * IPv4: public unless in a private/reserved range.
 * IPv6: allowlist of global unicast (2000::/3) minus Teredo (2001::/32), documentation
 * (2001:db8::/32) and 6to4 (2002::/16, judged by its embedded IPv4). IPv4-mapped and
 * IPv4-compatible forms (dotted or hex) are judged as IPv4. NAT64, ULA, link-local,
 * site-local, multicast and loopback all fall outside the allowlist.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  if (family !== 6) return false;
  const g = expandIPv6(address);
  if (!g) return false;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(5) && (g[5] === 0xffff || g[5] === 0)) {
    if (g[5] === 0 && g[6] === 0) return false; // :: and ::1 and ::/96 low addresses
    return isPublicAddress(v4From(g[6]!, g[7]!));
  }
  if (g[0]! < 0x2000 || g[0]! > 0x3fff) return false;
  if (g[0] === 0x2001 && (g[1] === 0x0000 || g[1] === 0x0db8)) return false;
  if (g[0] === 0x2002) return isPublicAddress(v4From(g[1]!, g[2]!));
  return true;
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
