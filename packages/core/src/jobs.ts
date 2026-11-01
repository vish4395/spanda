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

/** In-memory job registry with cancellation (persisted job events come in M1). */
export class JobManager {
  private readonly jobs = new Map<string, JobRecord>();

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
      snapshot.log.push(line);
      if (snapshot.log.length > MAX_LOG_LINES) snapshot.log.splice(0, snapshot.log.length - MAX_LOG_LINES);
    };
    const done = (async () => {
      try {
        await work({ signal: controller.signal, log });
        snapshot.status = controller.signal.aborted ? 'cancelled' : 'succeeded';
      } catch (err) {
        snapshot.status = controller.signal.aborted ? 'cancelled' : 'failed';
        snapshot.error = controller.signal.aborted ? null : (err as Error).message;
      }
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
