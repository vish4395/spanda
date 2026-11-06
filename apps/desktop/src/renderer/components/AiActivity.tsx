import { useEffect, useRef, useState } from 'react';
import type { JobSnapshot } from '@studio/contracts/ipc';
import { call } from '../api';
import { SpinnerIcon } from './Icons';

/** A running AI task: what it is doing, its latest log line, and Cancel. Calls `onFinished` once. */
export function AiActivity({ jobId, title, onFinished }: { jobId: string; title: string; onFinished: (job: JobSnapshot) => void }) {
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const next = await call('ai.job', { jobId });
        if (!alive) return;
        setJob(next);
        setNow(Date.now());
        if (next.status === 'running') timer = setTimeout(() => void tick(), 600);
        else finished.current(next);
      } catch {
        if (alive) timer = setTimeout(() => void tick(), 1500);
      }
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [jobId]);

  const cancel = async () => {
    setCancelling(true);
    try {
      setJob(await call('ai.cancel', { jobId }));
    } finally {
      setCancelling(false);
    }
  };

  const seconds = Math.max(0, Math.round((now - started) / 1000));
  const last = job?.log.at(-1);
  return (
    <section className="ai-activity" aria-label="AI task">
      <SpinnerIcon />
      <div className="ai-activity__body" role="status" aria-live="polite">
        <p className="ai-activity__title">{job?.title ?? title}</p>
        <p className="ai-activity__detail mono">{last ?? 'Starting…'}</p>
      </div>
      <span className="ai-activity__time mono" aria-label={`${seconds} seconds`}>
        {seconds}s
      </span>
      <button type="button" className="btn btn--secondary btn--small" onClick={() => void cancel()} disabled={cancelling || job?.status !== 'running'}>
        Cancel
      </button>
    </section>
  );
}
