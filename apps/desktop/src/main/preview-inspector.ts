import type { PreviewDiagnostics, PreviewIssue, PreviewMotion } from '@studio/contracts';

/** The subset of Electron's `webContents.debugger` the inspector needs (faked in unit tests). */
export interface DebuggerLike {
  attach(protocolVersion?: string): void;
  isAttached(): boolean;
  sendCommand(method: string, params?: object, sessionId?: string): Promise<unknown>;
  on(event: 'message', listener: (event: unknown, method: string, params: any, sessionId: string) => void): unknown;
  on(event: 'detach', listener: (event: unknown, reason: string) => void): unknown;
}

/** URLs served by the studio's loopback preview server (`startStaticServer`: 127.0.0.1 + 32-hex session token). */
export const PREVIEW_ORIGIN = /^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}\//;

const MAX_ISSUES = 50;
const MAX_MESSAGE = 2000;
const MAX_SOURCE = 500;
const MAX_TRACKED_REQUESTS = 500;

interface PreviewTarget {
  targetId: string;
  url: string;
  issues: PreviewIssue[];
  dropped: number;
  /** In-flight request URLs, so a failure (which carries only the request id) can name its resource. */
  requests: Map<string, string>;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Drop the session token and query from a preview URL so issue sources stay short and shareable. */
function shortSource(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== '127.0.0.1') return clip(url, MAX_SOURCE);
    return clip(parsed.pathname.split('/').slice(2).join('/') || 'index.html', MAX_SOURCE);
  } catch {
    return clip(url, MAX_SOURCE);
  }
}

function withoutHash(url: string): string {
  const i = url.indexOf('#');
  return i === -1 ? url : url.slice(0, i);
}

/**
 * Watches the sandboxed preview iframe through the Chrome DevTools Protocol, from the
 * main process. The generated site is never modified: reduced motion is real media
 * emulation (CSS `@media` and `matchMedia` both see it) and errors are read from the
 * frame's own target, so what the preview shows is what the export does.
 */
export class PreviewInspector {
  private readonly targets = new Map<string, PreviewTarget>();
  private motion: PreviewMotion = 'full';
  private available = false;
  private readonly dbg: DebuggerLike;
  /** Only frames served by the studio's loopback preview server are inspected. */
  private readonly isPreviewUrl: (url: string) => boolean;

  constructor(dbg: DebuggerLike, isPreviewUrl: (url: string) => boolean) {
    this.dbg = dbg;
    this.isPreviewUrl = isPreviewUrl;
  }

  /** Attach to the studio window. Failure is reported through `available`, never thrown. */
  async start(): Promise<boolean> {
    try {
      if (!this.dbg.isAttached()) this.dbg.attach('1.3');
      this.dbg.on('message', (_event, method, params, sessionId) => this.onMessage(method, params, sessionId));
      this.dbg.on('detach', () => {
        this.available = false;
        this.targets.clear();
      });
      // Pause every new out-of-process frame until emulation is applied, so no script sees the wrong media.
      await this.dbg.sendCommand('Target.setDiscoverTargets', { discover: true });
      await this.dbg.sendCommand('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
      this.available = true;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  async setMotion(motion: PreviewMotion): Promise<PreviewMotion> {
    this.motion = motion;
    await Promise.all([...this.targets.keys()].map((sessionId) => this.applyMotion(sessionId).catch(() => undefined)));
    return this.motion;
  }

  diagnostics(previewUrl: string): PreviewDiagnostics {
    const base = withoutHash(previewUrl);
    const issues: PreviewIssue[] = [];
    let dropped = 0;
    for (const target of this.targets.values()) {
      if (!this.isPreviewUrl(target.url) || !withoutHash(target.url).startsWith(base)) continue;
      issues.push(...target.issues);
      dropped += target.dropped;
    }
    return { available: this.available, motion: this.motion, issues: issues.slice(-MAX_ISSUES), dropped: dropped + Math.max(0, issues.length - MAX_ISSUES) };
  }

  private applyMotion(sessionId: string): Promise<unknown> {
    return this.dbg.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: this.motion === 'reduce' ? 'reduce' : '' }] }, sessionId);
  }

  private onMessage(method: string, params: any, sessionId: string | undefined): void {
    if (method === 'Target.attachedToTarget') {
      void this.onAttached(params);
      return;
    }
    if (method === 'Target.targetInfoChanged') {
      // Out-of-process frames attach before their navigation commits (empty URL); learn it here.
      for (const target of this.targets.values()) if (target.targetId === params?.targetInfo?.targetId) target.url = String(params.targetInfo.url ?? '');
      return;
    }
    if (method === 'Target.detachedFromTarget') {
      this.targets.delete(params?.sessionId);
      return;
    }
    const target = sessionId ? this.targets.get(sessionId) : undefined;
    if (!target) return;
    switch (method) {
      case 'Runtime.executionContextsCleared':
        // Reload or navigation: earlier errors belong to the previous document.
        target.issues = [];
        target.dropped = 0;
        target.requests.clear();
        break;
      case 'Runtime.exceptionThrown': {
        const details = params?.exceptionDetails ?? {};
        const message = String(details.exception?.description ?? details.text ?? 'Uncaught error');
        this.record(target, { kind: 'exception', message, source: details.url, line: typeof details.lineNumber === 'number' ? details.lineNumber + 1 : null });
        break;
      }
      case 'Runtime.consoleAPICalled': {
        if (params?.type !== 'error' && params?.type !== 'assert') break;
        const message = (params.args ?? []).map((arg: any) => String(arg?.value ?? arg?.description ?? '')).join(' ').trim() || 'console.error';
        const frame = params.stackTrace?.callFrames?.[0];
        this.record(target, { kind: 'console', message, source: frame?.url, line: typeof frame?.lineNumber === 'number' ? frame.lineNumber + 1 : null });
        break;
      }
      case 'Log.entryAdded': {
        // The export's own CSP blocking something is a real defect in the site.
        const entry = params?.entry;
        if (entry?.level !== 'error' || entry.source !== 'security') break;
        this.record(target, { kind: 'security', message: String(entry.text ?? 'Blocked'), source: entry.url, line: typeof entry.lineNumber === 'number' ? entry.lineNumber + 1 : null });
        break;
      }
      // Chromium reports failed loads through the Network domain (DevTools builds its console line from these).
      case 'Network.requestWillBeSent':
        if (target.requests.size >= MAX_TRACKED_REQUESTS) target.requests.delete(target.requests.keys().next().value!);
        target.requests.set(String(params?.requestId), String(params?.request?.url ?? ''));
        break;
      case 'Network.responseReceived': {
        const status = Number(params?.response?.status);
        if (status >= 400) this.record(target, { kind: 'network', message: `HTTP ${status}${params.response.statusText ? ` ${params.response.statusText}` : ''}`, source: params.response.url, line: null });
        break;
      }
      case 'Network.loadingFinished':
        target.requests.delete(String(params?.requestId));
        break;
      case 'Network.loadingFailed': {
        const url = target.requests.get(String(params?.requestId));
        target.requests.delete(String(params?.requestId));
        // Cancellations (navigation, aborted fetches) are not defects; CSP blocks arrive through Log.
        if (params?.canceled || params?.blockedReason) break;
        const error = String(params?.errorText ?? 'Request failed');
        // The preview frame has an opaque origin, so a missing file (a text/plain 404) surfaces as an ORB block.
        const message = error === 'net::ERR_BLOCKED_BY_ORB' ? `File missing or not the expected type (${error})` : error;
        this.record(target, { kind: 'network', message, source: url, line: null });
        break;
      }
    }
  }

  private async onAttached(params: any): Promise<void> {
    const sessionId: string | undefined = params?.sessionId;
    const info = params?.targetInfo;
    if (!sessionId) return;
    // Out-of-process frames attach before their navigation commits, so the URL is usually still
    // empty: every frame is prepared, and issues are filtered by preview URL when read. (The studio
    // CSP only allows loopback frames, so in practice every frame here is a preview.)
    const frame = info?.type === 'iframe';
    if (frame) this.targets.set(sessionId, { targetId: String(info.targetId), url: String(info.url ?? ''), issues: [], dropped: 0, requests: new Map() });
    try {
      // Runtime.enable must precede the resume: Chromium leaves a frame paused when it is only resumed.
      await Promise.all([this.dbg.sendCommand('Runtime.enable', {}, sessionId), ...(frame ? [this.applyMotion(sessionId), this.dbg.sendCommand('Log.enable', {}, sessionId), this.dbg.sendCommand('Network.enable', {}, sessionId)] : [])]);
    } catch {
      // The target may have gone away already; it must still be released below.
    } finally {
      // Always resume: a paused frame would leave the preview blank.
      await this.dbg.sendCommand('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => undefined);
    }
  }

  private record(target: PreviewTarget, issue: { kind: PreviewIssue['kind']; message: string; source: string | undefined; line: number | null }): void {
    target.issues.push({ kind: issue.kind, message: clip(issue.message, MAX_MESSAGE), source: shortSource(issue.source), line: issue.line, at: new Date().toISOString() });
    if (target.issues.length > MAX_ISSUES) {
      target.issues.shift();
      target.dropped += 1;
    }
  }
}
