import { useCallback, useEffect, useRef, useState } from 'react';
import type { JobSnapshot, MenuCommandMessage, MenuState, ProjectSummary, ProviderStatus } from '@studio/contracts/ipc';
import { call } from './api';
import { ErrorBanner, StatusChip, isContextMenuKey, timeAgo } from './components/Common';
import { FolderIcon, LogoMark, PlusIcon, PuzzleIcon, ServerIcon } from './components/Icons';
import { NewProjectView } from './views/NewProjectView';
import { ProjectView, type ProjectMenuState } from './views/ProjectView';
import { ProvidersView } from './views/ProvidersView';
import { SkillsView } from './views/SkillsView';
import { WelcomeView } from './views/WelcomeView';

type View = { kind: 'project'; projectId: string } | { kind: 'new' } | { kind: 'skills' } | { kind: 'providers' } | { kind: 'welcome' } | { kind: 'empty' };

const PROJECT_DEFAULTS: ProjectMenuState = { canGenerate: false, canSnapshot: false, canExport: false, running: false, tab: null, target: 'html', device: 'desktop', reducedMotion: false, hasPreview: false };
/** Commands handled by the open project view (forwarded, or queued until that project opens). */
const PROJECT_COMMANDS = new Set<MenuCommandMessage['command']>(['project.generate', 'project.cancel', 'project.snapshot', 'project.export', 'version.restore', 'tab.discover', 'tab.brief', 'tab.storyboard', 'tab.build', 'target.html', 'target.react', 'device.desktop', 'device.tablet', 'device.mobile', 'preview.reload', 'preview.reducedMotion']);

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [view, setView] = useState<View>({ kind: 'empty' });
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [checkingProviders, setCheckingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectMenu, setProjectMenu] = useState<ProjectMenuState>(PROJECT_DEFAULTS);
  const [command, setCommand] = useState<MenuCommandMessage | null>(null);
  const viewRef = useRef<View>(view);
  viewRef.current = view;

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

  const openFirst = useCallback((list: ProjectSummary[]) => setView(list[0] ? { kind: 'project', projectId: list[0].id } : { kind: 'empty' }), []);

  useEffect(() => {
    // First run: choose an AI provider before anything else.
    Promise.all([reloadProjects(), call('settings.get')])
      .then(([list, settings]) => (settings.onboarded ? openFirst(list) : setView({ kind: 'welcome' })))
      .catch((err: Error) => setError(err.message));
    void probe();
  }, [reloadProjects, probe, openFirst]);

  const onProjectsChanged = useCallback(() => {
    void reloadProjects();
  }, [reloadProjects]);

  // Menu bar and context-menu commands from the main process.
  useEffect(
    () =>
      window.studio.onCommand((message) => {
        const current = viewRef.current;
        switch (message.command) {
          case 'project.new':
            setView({ kind: 'new' });
            return;
          case 'project.open':
            if (message.projectId) setView({ kind: 'project', projectId: message.projectId });
            return;
          case 'view.providers':
            setView({ kind: 'providers' });
            return;
          case 'view.skills':
            setView({ kind: 'skills' });
            return;
          default:
            if (!PROJECT_COMMANDS.has(message.command)) return;
            // A command for another project opens it first; the project view runs it once loaded.
            if (message.projectId && (current.kind !== 'project' || current.projectId !== message.projectId)) setView({ kind: 'project', projectId: message.projectId });
            else if (current.kind !== 'project') return;
            setCommand({ ...message });
        }
      }),
    [],
  );

  // Keep the native menu's enabled/checked states in sync with what is on screen.
  useEffect(() => {
    const state: MenuState = {
      view: view.kind,
      projectId: view.kind === 'project' ? view.projectId : null,
      ...(view.kind === 'project' ? projectMenu : PROJECT_DEFAULTS),
    };
    void call('ui.menuState', state).catch(() => undefined);
  }, [view, projectMenu]);

  const selectedId = view.kind === 'project' ? view.projectId : null;
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const crumb = view.kind === 'project' ? selected?.name : view.kind === 'new' ? 'New project' : view.kind === 'skills' ? 'Skills' : view.kind === 'providers' ? 'AI providers' : view.kind === 'welcome' ? 'Welcome' : null;

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
          <span>Spanda Studio</span>
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
                <button
                  type="button"
                  className="project-item"
                  aria-current={project.id === selectedId ? 'true' : undefined}
                  aria-haspopup="menu"
                  onClick={() => setView({ kind: 'project', projectId: project.id })}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    void call('ui.contextMenu', { kind: 'project', projectId: project.id });
                  }}
                  onKeyDown={(event) => {
                    if (!isContextMenuKey(event)) return;
                    event.preventDefault();
                    void call('ui.contextMenu', { kind: 'project', projectId: project.id });
                  }}
                >
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
        {view.kind === 'project' && (
          <ProjectView
            key={view.projectId}
            projectId={view.projectId}
            onJobChange={setJob}
            onProjectsChanged={onProjectsChanged}
            onMenuState={setProjectMenu}
            command={command && (!command.projectId || command.projectId === view.projectId) ? command : null}
            onCommandHandled={() => setCommand(null)}
          />
        )}
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
        {view.kind === 'welcome' && <WelcomeView providers={providers} checking={checkingProviders} onRecheck={() => void probe()} onDone={() => openFirst(projects)} />}
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
