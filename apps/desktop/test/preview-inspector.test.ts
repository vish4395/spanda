import { describe, expect, it } from 'vitest';
import { PREVIEW_ORIGIN, PreviewInspector, type DebuggerLike } from '../src/main/preview-inspector.ts';

const PREVIEW = 'http://127.0.0.1:5173/0123456789abcdef0123456789abcdef/';

type Listener = (event: unknown, method: string, params: any, sessionId: string) => void;

class FakeDebugger implements DebuggerLike {
  attached = false;
  failAttach = false;
  commands: { method: string; params: any; sessionId: string | undefined }[] = [];
  private listener: Listener | null = null;
  attach(): void {
    if (this.failAttach) throw new Error('Another debugger is already attached');
    this.attached = true;
  }
  isAttached(): boolean {
    return this.attached;
  }
  async sendCommand(method: string, params: object = {}, sessionId?: string): Promise<unknown> {
    this.commands.push({ method, params, sessionId });
    return {};
  }
  on(event: string, listener: (...args: any[]) => void): this {
    if (event === 'message') this.listener = listener as Listener;
    return this;
  }
  emit(method: string, params: any, sessionId = ''): void {
    this.listener?.({}, method, params, sessionId);
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function started(): Promise<{ dbg: FakeDebugger; inspector: PreviewInspector }> {
  const dbg = new FakeDebugger();
  const inspector = new PreviewInspector(dbg, (url) => PREVIEW_ORIGIN.test(url));
  expect(await inspector.start()).toBe(true);
  return { dbg, inspector };
}

function attachFrame(dbg: FakeDebugger, sessionId: string, url = PREVIEW, type = 'iframe'): void {
  dbg.emit('Target.attachedToTarget', { sessionId, targetInfo: { type, url, targetId: `t-${sessionId}` } });
}

describe('PreviewInspector', () => {
  it('auto-attaches with paused start so emulation lands before page scripts', async () => {
    const { dbg } = await started();
    expect(dbg.commands[1]).toMatchObject({ method: 'Target.setAutoAttach', params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true } });
  });

  it('applies the current motion setting to a new preview frame, then resumes it', async () => {
    const { dbg, inspector } = await started();
    await inspector.setMotion('reduce');
    attachFrame(dbg, 's1');
    await settle();
    const forFrame = dbg.commands.filter((c) => c.sessionId === 's1').map((c) => c.method);
    expect(forFrame).toEqual(['Runtime.enable', 'Emulation.setEmulatedMedia', 'Log.enable', 'Network.enable', 'Runtime.runIfWaitingForDebugger']);
    expect(dbg.commands.find((c) => c.method === 'Emulation.setEmulatedMedia')?.params).toEqual({ features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  });

  it('re-applies motion to attached frames when toggled', async () => {
    const { dbg, inspector } = await started();
    attachFrame(dbg, 's1');
    await settle();
    dbg.commands = [];
    expect(await inspector.setMotion('reduce')).toBe('reduce');
    expect(await inspector.setMotion('full')).toBe('full');
    expect(dbg.commands.map((c) => [c.sessionId, c.params.features[0].value])).toEqual([
      ['s1', 'reduce'],
      ['s1', ''],
    ]);
  });

  it('learns the URL of frames that attach before navigating, and ignores non-preview frames', async () => {
    const { dbg, inspector } = await started();
    attachFrame(dbg, 's1', '');
    attachFrame(dbg, 'other', 'https://example.com/');
    await settle();
    dbg.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'early' } }, 's1');
    dbg.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'elsewhere' } }, 'other');
    expect(inspector.diagnostics(PREVIEW).issues).toEqual([]);
    dbg.emit('Target.targetInfoChanged', { targetInfo: { targetId: 't-s1', url: PREVIEW } });
    expect(inspector.diagnostics(PREVIEW).issues.map((i) => i.message)).toEqual(['early']);
  });

  it('prepares then resumes every attached target, frames or not', async () => {
    const { dbg } = await started();
    attachFrame(dbg, 'worker', PREVIEW, 'worker');
    await settle();
    expect(dbg.commands.filter((c) => c.sessionId === 'worker').map((c) => c.method)).toEqual(['Runtime.enable', 'Runtime.runIfWaitingForDebugger']);
  });

  it('still resumes a frame when preparing it fails', async () => {
    const { dbg } = await started();
    dbg.sendCommand = async (method: string, params: object = {}, sessionId?: string) => {
      dbg.commands.push({ method, params, sessionId });
      if (method === 'Runtime.enable') throw new Error('Target closed');
      return {};
    };
    attachFrame(dbg, 's1');
    await settle();
    expect(dbg.commands.at(-1)).toMatchObject({ method: 'Runtime.runIfWaitingForDebugger', sessionId: 's1' });
  });

  it('collects exceptions, console errors and failed loads for the matching preview', async () => {
    const { dbg, inspector } = await started();
    attachFrame(dbg, 's1');
    await settle();
    dbg.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'Uncaught', lineNumber: 41, url: `${PREVIEW}js/main.js`, exception: { description: 'TypeError: boom' } } }, 's1');
    dbg.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ value: 'hello' }] }, 's1');
    dbg.emit('Runtime.consoleAPICalled', { type: 'error', args: [{ value: 'bad' }, { value: 42 }], stackTrace: { callFrames: [{ url: `${PREVIEW}assets/app.js`, lineNumber: 0 }] } }, 's1');
    dbg.emit('Network.requestWillBeSent', { requestId: 'r1', request: { url: `${PREVIEW}missing.png` } }, 's1');
    dbg.emit('Network.responseReceived', { requestId: 'r1', response: { url: `${PREVIEW}missing.png`, status: 404, statusText: 'Not Found' } }, 's1');
    dbg.emit('Network.requestWillBeSent', { requestId: 'r2', request: { url: 'https://cdn.example/font.woff2' } }, 's1');
    dbg.emit('Network.loadingFailed', { requestId: 'r2', errorText: 'net::ERR_NAME_NOT_RESOLVED' }, 's1');
    dbg.emit('Network.requestWillBeSent', { requestId: 'r5', request: { url: `${PREVIEW}gone.png` } }, 's1');
    dbg.emit('Network.loadingFailed', { requestId: 'r5', errorText: 'net::ERR_BLOCKED_BY_ORB' }, 's1');
    dbg.emit('Network.requestWillBeSent', { requestId: 'r3', request: { url: `${PREVIEW}a.js` } }, 's1');
    dbg.emit('Network.loadingFailed', { requestId: 'r3', errorText: 'net::ERR_ABORTED', canceled: true }, 's1');
    dbg.emit('Network.requestWillBeSent', { requestId: 'r4', request: { url: `${PREVIEW}ok.css` } }, 's1');
    dbg.emit('Network.responseReceived', { requestId: 'r4', response: { url: `${PREVIEW}ok.css`, status: 200 } }, 's1');
    dbg.emit('Log.entryAdded', { entry: { level: 'error', source: 'security', text: "Executing inline script violates the following Content Security Policy directive 'script-src 'self''", url: PREVIEW, lineNumber: 9 } }, 's1');
    dbg.emit('Log.entryAdded', { entry: { level: 'warning', source: 'network', text: 'slow' } }, 's1');
    dbg.emit('Log.entryAdded', { entry: { level: 'error', source: 'javascript', text: 'dup of exceptionThrown' } }, 's1');

    const report = inspector.diagnostics(`${PREVIEW}#scene-hero`);
    expect(report).toMatchObject({ available: true, motion: 'full', dropped: 0 });
    expect(report.issues.map(({ at: _at, ...rest }) => rest)).toEqual([
      { kind: 'exception', message: 'TypeError: boom', source: 'js/main.js', line: 42 },
      { kind: 'console', message: 'bad 42', source: 'assets/app.js', line: 1 },
      { kind: 'network', message: 'HTTP 404 Not Found', source: 'missing.png', line: null },
      { kind: 'network', message: 'net::ERR_NAME_NOT_RESOLVED', source: 'https://cdn.example/font.woff2', line: null },
      { kind: 'network', message: 'File missing or not the expected type (net::ERR_BLOCKED_BY_ORB)', source: 'gone.png', line: null },
      { kind: 'security', message: "Executing inline script violates the following Content Security Policy directive 'script-src 'self''", source: 'index.html', line: 10 },
    ]);
    // A different preview (other target or project) sees none of them.
    expect(inspector.diagnostics('http://127.0.0.1:6000/ffffffffffffffffffffffffffffffff/').issues).toEqual([]);
  });

  it('clears issues when the document reloads and forgets detached frames', async () => {
    const { dbg, inspector } = await started();
    attachFrame(dbg, 's1');
    await settle();
    dbg.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'one' } }, 's1');
    dbg.emit('Runtime.executionContextsCleared', {}, 's1');
    expect(inspector.diagnostics(PREVIEW).issues).toEqual([]);
    dbg.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'two' } }, 's1');
    dbg.emit('Target.detachedFromTarget', { sessionId: 's1' });
    expect(inspector.diagnostics(PREVIEW).issues).toEqual([]);
  });

  it('caps stored issues and message length, counting what it drops', async () => {
    const { dbg, inspector } = await started();
    attachFrame(dbg, 's1');
    await settle();
    for (let i = 0; i < 60; i++) dbg.emit('Runtime.exceptionThrown', { exceptionDetails: { text: `e${i}` } }, 's1');
    dbg.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'x'.repeat(5000) } }, 's1');
    const report = inspector.diagnostics(PREVIEW);
    expect(report.issues).toHaveLength(50);
    expect(report.dropped).toBe(11);
    expect(report.issues.at(-1)!.message).toHaveLength(2000);
  });

  it('reports unavailable instead of throwing when another debugger holds the window', async () => {
    const dbg = new FakeDebugger();
    dbg.failAttach = true;
    const inspector = new PreviewInspector(dbg, () => true);
    expect(await inspector.start()).toBe(false);
    expect(inspector.diagnostics(PREVIEW)).toEqual({ available: false, motion: 'full', issues: [], dropped: 0 });
  });

  it('matches only token-bearing loopback preview URLs', () => {
    expect(PREVIEW_ORIGIN.test(PREVIEW)).toBe(true);
    expect(PREVIEW_ORIGIN.test('http://127.0.0.1:5173/')).toBe(false);
    expect(PREVIEW_ORIGIN.test('http://localhost:5173/0123456789abcdef0123456789abcdef/')).toBe(false);
    expect(PREVIEW_ORIGIN.test('https://127.0.0.1.evil.com/0123456789abcdef0123456789abcdef/')).toBe(false);
  });
});
