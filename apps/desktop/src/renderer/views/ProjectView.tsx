import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreativeState } from '@studio/contracts';
import type { JobSnapshot, MenuCommandMessage, MenuState, OutputTarget, PreviewDiagnostics, ProjectDetail, ProjectVersion } from '@studio/contracts/ipc';
import { call } from '../api';
import { ErrorBanner, Segmented, StatusChip, isContextMenuKey, timeAgo } from '../components/Common';
import { ChevronIcon, MotionIcon, PlayIcon, ShieldIcon, SpinnerIcon, StopIcon, TerminalIcon } from '../components/Icons';
import { DEVICES, PreviewStage, type DeviceId } from '../components/PreviewStage';
import { SceneEditor } from './SceneEditor';
import type { StorySpec } from '@studio/contracts';
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

export type ProjectMenuState = Omit<MenuState, 'view' | 'projectId'>;

interface Props {
  projectId: string;
  onJobChange: (job: JobSnapshot | null) => void;
  onProjectsChanged: () => void;
  onMenuState: (state: ProjectMenuState) => void;
  command: MenuCommandMessage | null;
  onCommandHandled: () => void;
}

export function ProjectView({ projectId, onJobChange, onProjectsChanged, onMenuState, command, onCommandHandled }: Props) {
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
  const [reloadKey, setReloadKey] = useState(0);
  const [spec, setSpec] = useState<StorySpec | null>(null);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  // The last build stays visible after edits, clearly marked until the next successful generation.
  const [stale, setStale] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [exportTargets, setExportTargets] = useState<'both' | OutputTarget>('both');
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostics | null>(null);
  // Issues already seen when the user dismissed the panel; new ones bring it back.
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

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
    const [opened, validated, creativeState, currentSpec] = await Promise.all([call('projects.open', { projectId }), call('story.validate', { projectId }), call('creative.get', { projectId }), call('story.get', { projectId })]);
    setDetail(opened);
    setValidation(validated);
    setCreative(creativeState);
    setSpec(currentSpec);
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
          if (snapshot.status === 'succeeded') {
            setStale(false);
            void loadPreviews();
          }
          if (snapshot.status === 'failed') setError(snapshot.error ?? 'Generation failed');
        })
        .catch((err: Error) => setError(err.message));
    }, 400);
    return () => window.clearInterval(timer);
  }, [job, loadPreviews]);

  // Real media emulation of the preview frame, applied by the main process (the export is untouched).
  useEffect(() => {
    call('preview.setMotion', { motion: reducedMotion ? 'reduce' : 'full' }).catch((err: Error) => setError(err.message));
  }, [reducedMotion]);

  // Errors the running preview reports (uncaught exceptions, console errors, failed loads).
  const watchedUrl = tab === 'build' ? (previews[target] ?? null) : null;
  useEffect(() => {
    setDiagnostics(null);
    setDismissedAt(null);
    if (!watchedUrl) return;
    let alive = true;
    const poll = () =>
      call('preview.issues', { url: watchedUrl })
        .then((next) => alive && setDiagnostics(next))
        .catch(() => undefined);
    void poll();
    const timer = window.setInterval(poll, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [watchedUrl, reloadKey]);

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

  const generated = Boolean(previews.html || previews.react);
  const canExport = generated && !stale && !running && !exporting;
  const exportSite = async () => {
    setError(null);
    setExportNote(null);
    setExporting(true);
    try {
      const targets: OutputTarget[] = exportTargets === 'both' ? ['html', 'react'] : [exportTargets];
      const result = await call('export.create', { projectId, targets });
      if (result.status === 'saved') {
        const review = [result.licenses !== 'passed' && 'dependency licenses', result.rights !== 'passed' && 'asset rights'].filter(Boolean);
        const note = `Exported ${result.fileName} · ${result.files} files · ${(result.bytes / 1024 / 1024).toFixed(1)} MB · ${review.length ? `Needs review: ${review.join(' and ')}` : 'License check passed'}`;
        setExportNote(note); // shown in a role="status" line, which also announces it
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
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
      setStale(true);
      void loadPreviews();
      setAnnouncement(`Restored ${version.label}. Generate again to update the preview.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyVersion(null);
    }
  };

  // Report state to the native menu (enabled/checked items).
  const previewForMenu = previews[target] ?? null;
  useEffect(() => {
    onMenuState({ canGenerate: Boolean(validation?.ok), canSnapshot: Boolean(validation?.ok), canExport, running, tab, target, device, reducedMotion, hasPreview: tab === 'build' && previewForMenu !== null });
  }, [validation?.ok, canExport, running, tab, target, device, reducedMotion, previewForMenu, onMenuState]);

  // Menu bar / context-menu commands, run with the same handlers as the on-screen controls.
  useEffect(() => {
    if (!command || !detail || validation === null) return;
    onCommandHandled();
    const c = command.command;
    if (c.startsWith('tab.')) setTab(c.slice(4) as TabId);
    else if (c === 'target.html' || c === 'target.react') {
      setTab('build');
      setTarget(c.slice(7) as OutputTarget);
    } else if (c.startsWith('device.')) {
      setTab('build');
      setDevice(c.slice(7) as DeviceId);
    } else if (c === 'preview.reload') setReloadKey((k) => k + 1);
    else if (c === 'preview.reducedMotion') {
      setTab('build');
      setReducedMotion((v) => !v);
    }
    else if (c === 'project.generate' && validation.ok && !running) {
      setTab('build');
      void generate();
    } else if (c === 'project.cancel' && running) void cancel();
    else if (c === 'project.snapshot' && validation.ok) void saveSnapshot();
    else if (c === 'project.export' && canExport) {
      setTab('build');
      void exportSite();
    }
    else if (c === 'version.restore' && command.versionId) {
      const version = detail.versions.find((v) => v.id === command.versionId);
      if (version) void restore(version);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per command
  }, [command, detail, validation]);

  if (!detail) {
    return (
      <div className="workspace__body">
        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : <p className="muted">Opening project…</p>}
      </div>
    );
  }

  const previewUrl = previews[target] ?? null;
  const allIssues = diagnostics?.issues ?? [];
  const visibleIssues = dismissedAt && allIssues.every((issue) => issue.at <= dismissedAt) ? [] : allIssues;
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
          <div className="add-scene">
            {validation === null ? (
              <StatusChip tone="busy">Validating…</StatusChip>
            ) : validation.ok ? (
              <StatusChip tone="ok">StorySpec valid</StatusChip>
            ) : (
              <StatusChip tone="error">{`${validation.issues.length} StorySpec issue${validation.issues.length === 1 ? '' : 's'}`}</StatusChip>
            )}
            <select aria-label="Targets to export" value={exportTargets} onChange={(e) => setExportTargets(e.target.value as 'both' | OutputTarget)} disabled={exporting}>
              <option value="both">HTML + React</option>
              <option value="html">HTML only</option>
              <option value="react">React only</option>
            </select>
            <button type="button" className="btn btn--secondary" onClick={() => void exportSite()} disabled={!canExport} aria-busy={exporting} title={stale ? 'Generate again to export the latest edits' : !generated ? 'Generate the project first' : undefined}>
              {exporting && <SpinnerIcon />}
              Export…
            </button>
          </div>
        </div>
        {exportNote && (
          <p className="muted small" role="status">
            {exportNote}
          </p>
        )}

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
                  setStale(true);
                  void loadPreviews();
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
          <button type="button" className="btn btn--secondary toggle" aria-pressed={reducedMotion} onClick={() => setReducedMotion((v) => !v)} disabled={diagnostics?.available === false} title={diagnostics?.available === false ? 'Reduced-motion preview is unavailable in this window' : undefined}>
            <MotionIcon />
            Reduced motion
          </button>
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
            {reducedMotion && previewUrl && <StatusChip tone="idle">Reduced motion</StatusChip>}
            {stale && previewUrl && <StatusChip tone="warn">Out of date — generate to apply edits</StatusChip>}
          </div>
          <PreviewStage
            key={`${previewUrl ?? 'none'}-${reloadKey}`}
            url={previewUrl}
            device={device}
            anchor={selectedScene}
            error={job?.status === 'failed' ? job.error : null}
            onRetry={() => void generate()}
            issues={visibleIssues}
            issuesDropped={visibleIssues.length ? (diagnostics?.dropped ?? 0) : 0}
            onDismissIssues={() => setDismissedAt(diagnostics?.issues.at(-1)?.at ?? null)}
            title={`${detail.project.name} — ${targetInfo.label} preview`}
          />
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

      <aside className="inspector" aria-label="Scenes and versions">
        {tab === 'build' && spec && (
          <section className="inspector__section" aria-labelledby="scenes-title">
            <h2 id="scenes-title">Scenes</h2>
            <p className="muted small">Select a scene to jump the preview to it and edit just that scene.</p>
            <ol className="scene-picker">
              {spec.pages[0]!.scenes.map((scene, i) => (
                <li key={scene.id}>
                  <button type="button" className="scene-picker__item" aria-expanded={selectedScene === scene.id} aria-controls={`scene-editor-${scene.id}`} onClick={() => setSelectedScene((cur) => (cur === scene.id ? null : scene.id))}>
                    <span className="scene-card__index">{i + 1}</span>
                    <span className="scene-picker__text">
                      <span>{scene.content.heading}</span>
                      <span className="muted small mono">
                        {scene.type} · {scene.id}
                      </span>
                    </span>
                  </button>
                  {selectedScene === scene.id && (
                    <div id={`scene-editor-${scene.id}`}>
                      <SceneEditor
                        projectId={projectId}
                        scene={scene}
                        disabled={running}
                        onError={setError}
                        onSaved={(label) => {
                          void refresh();
                          setStale(true);
                          void loadPreviews();
                          setAnnouncement(`${label}. Generate again to update the preview.`);
                        }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
        <div className="inspector__head" id="versions-title">
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
            <li
              key={version.id}
              className="version"
              tabIndex={0}
              aria-haspopup="menu"
              onContextMenu={(event) => {
                event.preventDefault();
                void call('ui.contextMenu', { kind: 'version', projectId, versionId: version.id, label: version.label, hash: version.storySpecHash, current: version.id === latestId });
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || !isContextMenuKey(event)) return;
                event.preventDefault();
                void call('ui.contextMenu', { kind: 'version', projectId, versionId: version.id, label: version.label, hash: version.storySpecHash, current: version.id === latestId });
              }}
            >
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
