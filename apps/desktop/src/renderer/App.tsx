import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JobSnapshot, OutputTarget, ProjectSummary, ProviderStatus } from '@studio/contracts/ipc';
import { call } from './api';
import {
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  FolderIcon,
  LogoMark,
  MonitorIcon,
  PhoneIcon,
  PlayIcon,
  ShieldIcon,
  SpinnerIcon,
  StopIcon,
  TabletIcon,
  TerminalIcon,
  XIcon,
} from './components/Icons';

const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900, Icon: MonitorIcon },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024, Icon: TabletIcon },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844, Icon: PhoneIcon },
] as const;
type DeviceId = (typeof DEVICES)[number]['id'];

const TARGETS: { id: OutputTarget; label: string; stack: string }[] = [
  { id: 'html', label: 'HTML', stack: 'html-three' },
  { id: 'react', label: 'React', stack: 'react-r3f' },
];

type Validation = { ok: boolean; issues: { path: string; message: string }[] } | null;

function StatusChip({ tone, children }: { tone: 'ok' | 'warn' | 'error' | 'busy' | 'idle'; children: string }) {
  const icon = { ok: <CheckIcon />, warn: <AlertIcon />, error: <XIcon />, busy: <SpinnerIcon />, idle: null }[tone];
  return (
    <span className={`chip chip--${tone}`}>
      {icon}
      {children}
    </span>
  );
}

/** Accessible single-choice group rendered as a segmented control (arrow keys move selection). */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; icon?: React.ReactNode }[]; onChange: (v: T) => void }) {
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = options[(index + delta + options.length) % options.length]!;
    onChange(next.id);
    (event.currentTarget.parentElement?.children[(index + delta + options.length) % options.length] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          tabIndex={value === option.id ? 0 : -1}
          className="segmented__option"
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function PreviewStage({ url, device, title }: { url: string | null; device: DeviceId; title: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const spec = DEVICES.find((d) => d.id === device)!;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const padding = 48;
      setScale(Math.min(1, (stage.clientWidth - padding) / spec.width, (stage.clientHeight - padding) / spec.height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [spec.width, spec.height]);

  return (
    <div className="stage" ref={stageRef}>
      {url ? (
        <div className="device" style={{ width: spec.width * scale, height: spec.height * scale }}>
          <iframe
            key={url}
            title={title}
            src={url}
            // Opaque origin, no same-origin access to the studio, no popups/forms/top navigation.
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            style={{ width: spec.width, height: spec.height, transform: `scale(${scale})` }}
          />
        </div>
      ) : (
        <div className="empty">
          <MonitorIcon />
          <p className="empty__title">No preview yet</p>
          <p className="empty__body">Generate the project to build native HTML and React sites from its StorySpec.</p>
        </div>
      )}
    </div>
  );
}

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation>(null);
  const [target, setTarget] = useState<OutputTarget>('html');
  const [device, setDevice] = useState<DeviceId>('desktop');
  const [previews, setPreviews] = useState<Partial<Record<OutputTarget, string>>>({});
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const logRef = useRef<HTMLOListElement>(null);

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const running = job?.status === 'running';

  const loadPreviews = useCallback(async (projectId: string) => {
    const next: Partial<Record<OutputTarget, string>> = {};
    for (const t of TARGETS) {
      try {
        next[t.id] = (await call('preview.start', { projectId, target: t.id })).url;
      } catch {
        // Not generated yet — the stage shows an empty state.
      }
    }
    setPreviews(next);
  }, []);

  useEffect(() => {
    call('projects.list')
      .then((list) => {
        setProjects(list);
        if (list[0]) setSelectedId(list[0].id);
      })
      .catch((err: Error) => setError(err.message));
    call('providers.probe')
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setValidation(null);
    setPreviews({});
    call('story.validate', { projectId: selectedId })
      .then(setValidation)
      .catch((err: Error) => setError(err.message));
    void loadPreviews(selectedId);
  }, [selectedId, loadPreviews]);

  // Poll the running job; stop when it settles.
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const timer = window.setInterval(() => {
      call('generation.get', { jobId: job.id })
        .then((snapshot) => {
          setJob(snapshot);
          if (snapshot.status === 'succeeded') void loadPreviews(snapshot.projectId);
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
    if (!selectedId) return;
    setError(null);
    try {
      setJob(await call('generation.start', { projectId: selectedId, targets: ['html', 'react'] }));
      setLogOpen(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancel = async () => {
    if (job) setJob(await call('generation.cancel', { jobId: job.id }));
  };

  const jobChip = !job ? (
    <StatusChip tone="idle">Idle</StatusChip>
  ) : job.status === 'running' ? (
    <StatusChip tone="busy">Generating…</StatusChip>
  ) : job.status === 'succeeded' ? (
    <StatusChip tone="ok">Ready</StatusChip>
  ) : job.status === 'cancelled' ? (
    <StatusChip tone="warn">Cancelled</StatusChip>
  ) : (
    <StatusChip tone="error">Failed</StatusChip>
  );

  const previewUrl = previews[target] ?? null;
  const targetInfo = TARGETS.find((t) => t.id === target)!;

  return (
    <div className="shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <header className="topbar">
        <div className="topbar__brand">
          <LogoMark />
          <span>AI Cinematic Studio</span>
        </div>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li>Projects</li>
            {selected && <li aria-current="page">{selected.name}</li>}
          </ol>
        </nav>
        <div className="topbar__status" role="status" aria-live="polite">
          {jobChip}
        </div>
      </header>

      <aside className="sidebar" aria-label="Projects and providers">
        <section>
          <h2 className="sidebar__heading">Projects</h2>
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button type="button" className="project-item" aria-current={project.id === selectedId ? 'true' : undefined} onClick={() => setSelectedId(project.id)}>
                  <FolderIcon />
                  <span className="project-item__text">
                    <span className="project-item__name">{project.name}</span>
                    <span className="project-item__meta">{project.id}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {projects.length === 0 && <p className="muted small">No projects in this workspace yet.</p>}
        </section>

        <section className="sidebar__providers">
          <h2 className="sidebar__heading">AI providers</h2>
          {providers === null ? (
            <p className="muted small">Checking installed CLIs…</p>
          ) : (
            <ul className="provider-list">
              {providers.map((provider) => (
                <li key={provider.id} className="provider">
                  <span className="provider__name">{provider.displayName}</span>
                  {provider.state === 'available' ? (
                    <StatusChip tone="ok">Installed</StatusChip>
                  ) : provider.state === 'not-found' ? (
                    <StatusChip tone="idle">Not installed</StatusChip>
                  ) : (
                    <StatusChip tone="warn">Error</StatusChip>
                  )}
                  {provider.version && <span className="provider__detail">{provider.version}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="sidebar__note">
            <ShieldIcon />
            <span>Sign-in stays with each official CLI. The studio never reads or shares your credentials. Generation with AI arrives in a later milestone.</span>
          </p>
        </section>
      </aside>

      <main id="workspace" className="workspace" tabIndex={-1}>
        {selected ? (
          <>
            <div className="project-header">
              <div>
                <h1>{selected.name}</h1>
                <p className="muted">{selected.goal}</p>
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

            {error && (
              <div className="alert" role="alert">
                <AlertIcon />
                <div className="alert__body">
                  <p className="alert__title">Something went wrong</p>
                  <pre className="alert__detail">{error}</pre>
                </div>
                <button type="button" className="btn btn--secondary" onClick={() => void generate()} disabled={running || !validation?.ok}>
                  Retry
                </button>
                <button type="button" className="btn btn--ghost" aria-label="Dismiss error" onClick={() => setError(null)}>
                  <XIcon />
                </button>
              </div>
            )}

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
              <PreviewStage url={previewUrl} device={device} title={`${selected.name} — ${targetInfo.label} preview`} />
            </section>
          </>
        ) : (
          <div className="empty">
            <p className="empty__title">No project selected</p>
          </div>
        )}
      </main>

      <section className={`activity ${logOpen ? 'activity--open' : ''}`} aria-label="Activity log">
        <button type="button" className="activity__toggle" aria-expanded={logOpen} aria-controls="activity-log" onClick={() => setLogOpen((v) => !v)}>
          <TerminalIcon />
          <span>Activity</span>
          {job && <span className="muted small">{job.log.length} lines</span>}
          <ChevronIcon open={logOpen} />
        </button>
        <ol id="activity-log" className="activity__log" ref={logRef} role="log" aria-live="polite" hidden={!logOpen}>
          {(job?.log ?? []).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          {!job && <li className="muted">Generation output appears here.</li>}
        </ol>
      </section>
    </div>
  );
}
