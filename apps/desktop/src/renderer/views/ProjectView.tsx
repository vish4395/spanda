import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreativeState } from '@studio/contracts';
import type { JobSnapshot, OutputTarget, ProjectDetail, ProjectVersion } from '@studio/contracts/ipc';
import { call } from '../api';
import { ErrorBanner, Segmented, StatusChip, timeAgo } from '../components/Common';
import { ChevronIcon, PlayIcon, ShieldIcon, SpinnerIcon, StopIcon, TerminalIcon } from '../components/Icons';
import { DEVICES, PreviewStage, type DeviceId } from '../components/PreviewStage';
import { BriefTab } from './creative/BriefTab';
import { DiscoverTab } from './creative/DiscoverTab';
import { StoryboardTab } from './creative/StoryboardTab';

const TABS = [
  { id: 'discover', label: 'Discover' },
  { id: 'brief', label: 'Brief' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'build', label: 'Build & preview' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const TAB_FOR_STAGE: Record<CreativeState['stage'], TabId> = { draft: 'discover', discovery: 'discover', brief_ready: 'brief', storyboard_ready: 'storyboard', approved: 'build' };

const TARGETS: { id: OutputTarget; label: string; stack: string }[] = [
  { id: 'html', label: 'HTML', stack: 'html-three' },
  { id: 'react', label: 'React', stack: 'react-r3f' },
];

type Validation = { ok: boolean; issues: { path: string; message: string }[] } | null;

interface Props {
  projectId: string;
  onJobChange: (job: JobSnapshot | null) => void;
  onProjectsChanged: () => void;
}

export function ProjectView({ projectId, onJobChange, onProjectsChanged }: Props) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [validation, setValidation] = useState<Validation>(null);
  const [target, setTarget] = useState<OutputTarget>('html');
  const [device, setDevice] = useState<DeviceId>('desktop');
  const [previews, setPreviews] = useState<Partial<Record<OutputTarget, string>>>({});
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const [busyVersion, setBusyVersion] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [creative, setCreative] = useState<CreativeState | null>(null);
  const [tab, setTab] = useState<TabId>('discover');
  const logRef = useRef<HTMLOListElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const running = job?.status === 'running';

  const loadPreviews = useCallback(async () => {
    const next: Partial<Record<OutputTarget, string>> = {};
    for (const t of TARGETS) {
      try {
        next[t.id] = (await call('preview.start', { projectId, target: t.id })).url;
      } catch {
        // Not generated yet — the stage shows an empty state.
      }
    }
    setPreviews(next);
  }, [projectId]);

  const refresh = useCallback(async () => {
    const [opened, validated, creativeState] = await Promise.all([call('projects.open', { projectId }), call('story.validate', { projectId }), call('creative.get', { projectId })]);
    setDetail(opened);
    setValidation(validated);
    setCreative(creativeState);
    return { opened, creativeState };
  }, [projectId]);

  useEffect(() => {
    setDetail(null);
    setValidation(null);
    setPreviews({});
    setError(null);
    refresh()
      .then(({ opened, creativeState }) => {
        // Show the most recent persisted run (survives app restarts).
        setJob(opened.jobs[0] ?? null);
        // Imported projects (like the bundled sample) already have a full StorySpec: open on Build.
        const imported = opened.versions.at(-1)?.label === 'Imported';
        setTab(creativeState.stage === 'draft' && imported ? 'build' : TAB_FOR_STAGE[creativeState.stage]);
        onProjectsChanged();
      })
      .catch((err: Error) => setError(err.message));
    void loadPreviews();
  }, [projectId, refresh, loadPreviews, onProjectsChanged]);

  useEffect(() => onJobChange(job), [job, onJobChange]);

  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const timer = window.setInterval(() => {
      call('generation.get', { jobId: job.id })
        .then((snapshot) => {
          setJob(snapshot);
          if (snapshot.status === 'succeeded') void loadPreviews();
          if (snapshot.status === 'failed') setError(snapshot.error ?? 'Generation failed');
        })
        .catch((err: Error) => setError(err.message));
    }, 400);
    return () => window.clearInterval(timer);
  }, [job, loadPreviews]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [job?.log.length]);

  const generate = async () => {
    setError(null);
    try {
      setJob(await call('generation.start', { projectId, targets: ['html', 'react'] }));
      setLogOpen(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancel = async () => {
    if (job) setJob(await call('generation.cancel', { jobId: job.id }));
  };

  const saveSnapshot = async () => {
    setBusyVersion('snapshot');
    try {
      const version = await call('versions.snapshot', { projectId });
      await refresh();
      setAnnouncement(`Snapshot saved: ${version.label}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyVersion(null);
    }
  };

  const restore = async (version: ProjectVersion) => {
    setBusyVersion(version.id);
    try {
      await call('versions.restore', { projectId, versionId: version.id });
      await refresh();
      setPreviews({});
      setAnnouncement(`Restored ${version.label}. Generate again to update the preview.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyVersion(null);
    }
  };

  if (!detail) {
    return (
      <div className="workspace__body">
        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : <p className="muted">Opening project…</p>}
      </div>
    );
  }

  const previewUrl = previews[target] ?? null;
  const targetInfo = TARGETS.find((t) => t.id === target)!;
  const latestId = detail.versions[0]?.id;

  return (
    <div className="project">
      <div className="project__main">
        <div className="project-header">
          <div>
            <h1>{detail.project.name}</h1>
            <p className="muted">{detail.project.goal}</p>
          </div>
          {validation === null ? (
            <StatusChip tone="busy">Validating…</StatusChip>
          ) : validation.ok ? (
            <StatusChip tone="ok">StorySpec valid</StatusChip>
          ) : (
            <StatusChip tone="error">{`${validation.issues.length} StorySpec issue${validation.issues.length === 1 ? '' : 's'}`}</StatusChip>
          )}
        </div>

        {validation && !validation.ok && (
          <ul className="issues" aria-label="StorySpec issues">
            {validation.issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>
                <code>{issue.path}</code> {issue.message}
              </li>
            ))}
          </ul>
        )}

        {error && <ErrorBanner message={error} onRetry={tab === 'build' ? () => void generate() : undefined} retryDisabled={running || !validation?.ok} onDismiss={() => setError(null)} />}

        <div className="tabs" role="tablist" aria-label="Project workflow">
          {TABS.map((t, index) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="tab"
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                const next = TABS[(index + delta + TABS.length) % TABS.length]!.id;
                setTab(next);
                tabRefs.current[next]?.focus();
              }}
            >
              {t.label}
            </button>
          ))}
          {creative && <span className="tabs__stage muted small">Stage: {creative.stage.replace('_', ' ')}</span>}
        </div>

        {creative && tab !== 'build' && (
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
            {tab === 'discover' && <DiscoverTab projectId={projectId} state={creative} onState={setCreative} onError={setError} />}
            {tab === 'brief' && <BriefTab projectId={projectId} state={creative} onState={(st) => { setCreative(st); if (st.brief?.approved) setTab('storyboard'); }} onError={setError} />}
            {tab === 'storyboard' && (
              <StoryboardTab
                projectId={projectId}
                state={creative}
                onState={setCreative}
                onError={setError}
                onApproved={() => {
                  void refresh();
                  setPreviews({});
                  setAnnouncement('Storyboard approved and saved as the StorySpec. Generate to preview it.');
                  setTab('build');
                }}
              />
            )}
          </div>
        )}

        {tab === 'build' && (
          <div role="tabpanel" id="panel-build" aria-labelledby="tab-build" className="tabpanel tabpanel--build">

        <div className="toolbar">
          <Segmented label="Output target" value={target} onChange={setTarget} options={TARGETS.map((t) => ({ id: t.id, label: t.label }))} />
          <Segmented label="Device size" value={device} onChange={setDevice} options={DEVICES.map((d) => ({ id: d.id, label: d.label, icon: <d.Icon /> }))} />
          <div className="toolbar__spacer" />
          {running ? (
            <button type="button" className="btn btn--secondary" onClick={() => void cancel()}>
              <StopIcon />
              Cancel
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => void generate()} disabled={!validation?.ok} aria-describedby="generate-hint">
              <PlayIcon />
              Generate HTML + React
            </button>
          )}
        </div>
        <p id="generate-hint" className="visually-hidden">
          Builds both native exports from the StorySpec and refreshes the preview.
        </p>

        <section className="preview" aria-label="Preview">
          <div className="preview__bar">
            <span className="preview__label">
              <ShieldIcon />
              {previewUrl ? `Isolated preview · ${new URL(previewUrl).host} · ${targetInfo.stack}` : `Preview · ${targetInfo.stack}`}
            </span>
          </div>
          <PreviewStage url={previewUrl} device={device} title={`${detail.project.name} — ${targetInfo.label} preview`} />
        </section>

        <section className={`activity ${logOpen ? 'activity--open' : ''}`} aria-label="Activity log">
          <button type="button" className="activity__toggle" aria-expanded={logOpen} aria-controls="activity-log" onClick={() => setLogOpen((v) => !v)}>
            <TerminalIcon />
            <span>Activity</span>
            {job && <span className="muted small">{job.status === 'running' ? 'running' : `last run ${job.status}`} · {job.log.length} lines</span>}
            <ChevronIcon open={logOpen} />
          </button>
          <ol id="activity-log" className="activity__log" ref={logRef} role="log" aria-live="polite" hidden={!logOpen}>
            {(job?.log ?? []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
            {job?.error && job.status !== 'running' && <li className="log-error">{job.error}</li>}
            {!job && <li className="muted">Generation output appears here.</li>}
          </ol>
        </section>
          </div>
        )}
      </div>

      <aside className="inspector" aria-labelledby="versions-title">
        <div className="inspector__head">
          <h2 id="versions-title">Versions</h2>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => void saveSnapshot()} disabled={busyVersion !== null || !validation?.ok} aria-busy={busyVersion === 'snapshot'}>
            {busyVersion === 'snapshot' && <SpinnerIcon />}
            Save snapshot
          </button>
        </div>
        <p className="muted small">Restoring saves your current StorySpec first, so nothing is lost.</p>
        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>
        <ol className="versions" aria-label="Version history, newest first">
          {detail.versions.map((version) => (
            <li key={version.id} className="version">
              <div className="version__text">
                <span className="version__label">{version.label}</span>
                <span className="muted small">
                  <time dateTime={version.createdAt}>{timeAgo(version.createdAt)}</time> · <span className="mono">{version.storySpecHash.slice(0, 8)}</span>
                </span>
              </div>
              {version.id === latestId ? (
                <span className="chip chip--idle">Current</span>
              ) : (
                <button type="button" className="btn btn--ghost btn--small" onClick={() => void restore(version)} disabled={busyVersion !== null || running} aria-label={`Restore ${version.label}`}>
                  {busyVersion === version.id ? <SpinnerIcon /> : 'Restore'}
                </button>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
