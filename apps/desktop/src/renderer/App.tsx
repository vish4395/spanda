import { useCallback, useEffect, useState } from 'react';
import type { JobSnapshot, ProjectSummary, ProviderStatus } from '@studio/contracts/ipc';
import { call } from './api';
import { ErrorBanner, StatusChip, timeAgo } from './components/Common';
import { FolderIcon, LogoMark, PlusIcon, PuzzleIcon, ServerIcon } from './components/Icons';
import { NewProjectView } from './views/NewProjectView';
import { ProjectView } from './views/ProjectView';
import { ProvidersView } from './views/ProvidersView';
import { SkillsView } from './views/SkillsView';

type View = { kind: 'project'; projectId: string } | { kind: 'new' } | { kind: 'skills' } | { kind: 'providers' } | { kind: 'empty' };

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [view, setView] = useState<View>({ kind: 'empty' });
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [checkingProviders, setCheckingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadProjects = useCallback(async () => {
    const list = await call('projects.list');
    setProjects(list);
    return list;
  }, []);

  const probe = useCallback(async () => {
    setCheckingProviders(true);
    try {
      setProviders(await call('providers.probe'));
    } catch {
      setProviders([]);
    } finally {
      setCheckingProviders(false);
    }
  }, []);

  useEffect(() => {
    reloadProjects()
      .then((list) => {
        if (list[0]) setView({ kind: 'project', projectId: list[0].id });
      })
      .catch((err: Error) => setError(err.message));
    void probe();
  }, [reloadProjects, probe]);

  const onProjectsChanged = useCallback(() => {
    void reloadProjects();
  }, [reloadProjects]);

  const selectedId = view.kind === 'project' ? view.projectId : null;
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const crumb = view.kind === 'project' ? selected?.name : view.kind === 'new' ? 'New project' : view.kind === 'skills' ? 'Skills' : view.kind === 'providers' ? 'AI providers' : null;

  const jobChip =
    view.kind !== 'project' || !job ? (
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
            <li>{view.kind === 'skills' || view.kind === 'providers' ? 'Settings' : 'Projects'}</li>
            {crumb && <li aria-current="page">{crumb}</li>}
          </ol>
        </nav>
        <div className="topbar__status" role="status" aria-live="polite">
          {jobChip}
        </div>
      </header>

      <aside className="sidebar" aria-label="Navigation">
        <section>
          <div className="sidebar__row">
            <h2 className="sidebar__heading">Projects</h2>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setView({ kind: 'new' })} aria-label="New project" aria-pressed={view.kind === 'new'}>
              <PlusIcon />
              New
            </button>
          </div>
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button type="button" className="project-item" aria-current={project.id === selectedId ? 'true' : undefined} onClick={() => setView({ kind: 'project', projectId: project.id })}>
                  <FolderIcon />
                  <span className="project-item__text">
                    <span className="project-item__name">{project.name}</span>
                    <span className="project-item__meta">{project.lastOpenedAt ? `Opened ${timeAgo(project.lastOpenedAt)}` : project.id}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {projects.length === 0 && <p className="muted small sidebar__empty">No projects yet.</p>}
        </section>

        <nav className="sidebar__settings" aria-label="Settings">
          <h2 className="sidebar__heading">Settings</h2>
          <button type="button" className="nav-item" aria-current={view.kind === 'providers' ? 'page' : undefined} onClick={() => setView({ kind: 'providers' })}>
            <ServerIcon />
            <span>AI providers</span>
            <span className="nav-item__meta">{providers ? `${providers.filter((p) => p.state === 'available').length}/${providers.length}` : '…'}</span>
          </button>
          <button type="button" className="nav-item" aria-current={view.kind === 'skills' ? 'page' : undefined} onClick={() => setView({ kind: 'skills' })}>
            <PuzzleIcon />
            <span>Skills</span>
          </button>
        </nav>
      </aside>

      <main id="workspace" className="workspace" tabIndex={-1}>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {view.kind === 'project' && <ProjectView key={view.projectId} projectId={view.projectId} onJobChange={setJob} onProjectsChanged={onProjectsChanged} />}
        {view.kind === 'new' && (
          <NewProjectView
            onCreated={(project) => {
              void reloadProjects();
              setView({ kind: 'project', projectId: project.id });
            }}
            onCancel={() => setView(projects[0] ? { kind: 'project', projectId: projects[0].id } : { kind: 'empty' })}
          />
        )}
        {view.kind === 'skills' && <SkillsView />}
        {view.kind === 'providers' && <ProvidersView providers={providers} checking={checkingProviders} onRecheck={() => void probe()} />}
        {view.kind === 'empty' && (
          <div className="empty">
            <p className="empty__title">No project selected</p>
            <button type="button" className="btn btn--primary" onClick={() => setView({ kind: 'new' })}>
              Create a project
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
