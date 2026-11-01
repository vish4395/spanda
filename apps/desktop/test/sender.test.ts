import { describe, expect, it } from 'vitest';
import { isTrustedSender } from '../src/main/sender.ts';

describe('isTrustedSender', () => {
  it('accepts only the top-level studio document', () => {
    expect(isTrustedSender({ url: 'app://studio/index.html', parent: null })).toBe(true);
  });
  it.each([
    ['preview iframe', { url: 'http://127.0.0.1:5000/token/', parent: null }],
    ['subframe of studio', { url: 'app://studio/index.html', parent: {} }],
    ['other app host', { url: 'app://evil/index.html', parent: null }],
    ['credentials trick', { url: 'app://studio@evil/index.html', parent: null }],
    ['file url', { url: 'file:///etc/passwd', parent: null }],
    ['garbage', { url: 'not a url', parent: null }],
  ])('rejects %s', (_label, frame) => {
    expect(isTrustedSender(frame)).toBe(false);
  });
  it('rejects missing frames', () => {
    expect(isTrustedSender(null)).toBe(false);
  });
});
