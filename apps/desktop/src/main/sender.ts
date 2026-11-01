export const APP_ORIGIN = 'app://studio';

/**
 * Only the studio's own top-level document may call privileged APIs.
 * Note: Node's URL reports origin "null" for non-special schemes such as
 * `app:`, so we compare protocol and host explicitly.
 */
export function isTrustedSender(frame: { url: string; parent: unknown } | null | undefined): boolean {
  if (!frame || frame.parent) return false;
  try {
    const url = new URL(frame.url);
    return url.protocol === 'app:' && url.host === 'studio' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}
