import { randomUUID } from 'node:crypto';
import type { JobSnapshot, OutputTarget } from '@studio/contracts';

export interface JobContext {
  signal: AbortSignal;
  log: (line: string) => void;
}

interface JobRecord {
  snapshot: JobSnapshot;
  controller: AbortController;
  done: Promise<void>;
}

const MAX_LOG_LINES = 2000;

/** Optional persistence hooks (the desktop app writes these to SQLite). */
export interface JobListener {
  started(job: JobSnapshot): void;
  logged(jobId: string, line: string): void;
  finished(job: JobSnapshot): void;
}

/** Job registry with cancellation; a listener can persist lifecycle events. */
export class JobManager {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly listener: JobListener | undefined;

  constructor(listener?: JobListener) {
    this.listener = listener;
  }

  private notify(fn: (l: JobListener) => void): void {
    if (!this.listener) return;
    try {
      fn(this.listener);
    } catch (err) {
      // Persistence problems must not break the job itself.
      console.error('Job listener failed', err);
    }
  }

  start(projectId: string, targets: OutputTarget[], work: (ctx: JobContext) => Promise<void>): JobSnapshot {
    const controller = new AbortController();
    const snapshot: JobSnapshot = {
      id: randomUUID(),
      kind: 'generate',
      projectId,
      targets,
      status: 'running',
      log: [],
      error: null,
    };
    const log = (line: string) => {
      this.notify((l) => l.logged(snapshot.id, line));
      snapshot.log.push(line);
      if (snapshot.log.length > MAX_LOG_LINES) snapshot.log.splice(0, snapshot.log.length - MAX_LOG_LINES);
    };
    // Announce before any work runs so persisted log lines always follow the job row.
    this.notify((l) => l.started(structuredClone(snapshot)));
    const done = (async () => {
      try {
        await work({ signal: controller.signal, log });
        snapshot.status = controller.signal.aborted ? 'cancelled' : 'succeeded';
      } catch (err) {
        snapshot.status = controller.signal.aborted ? 'cancelled' : 'failed';
        snapshot.error = controller.signal.aborted ? null : (err as Error).message;
      }
      this.notify((l) => l.finished(structuredClone(snapshot)));
    })();
    this.jobs.set(snapshot.id, { snapshot, controller, done });
    return this.get(snapshot.id);
  }

  get(id: string): JobSnapshot {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown job ${id}`);
    return structuredClone(job.snapshot);
  }

  cancel(id: string): JobSnapshot {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown job ${id}`);
    if (job.snapshot.status === 'running') job.controller.abort();
    return this.get(id);
  }

  async wait(id: string): Promise<JobSnapshot> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown job ${id}`);
    await job.done;
    return this.get(id);
  }

  cancelAll(): void {
    for (const job of this.jobs.values()) if (job.snapshot.status === 'running') job.controller.abort();
  }
}

/** Throw if the job was cancelled; call between pipeline steps. */
export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('Cancelled');
}
