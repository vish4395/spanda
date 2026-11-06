import { useState } from 'react';
import type { AiChoice, AiProviderId, AiStep, Experience } from '@studio/contracts';
import type { JobSnapshot, ProviderStatus, StudioSettings } from '@studio/contracts/ipc';
import { call } from '../api';
import { AiActivity } from '../components/AiActivity';
import { Segmented, StatusChip } from '../components/Common';
import { ShieldIcon, SpinnerIcon } from '../components/Icons';

interface Props {
  providers: ProviderStatus[] | null;
  checking: boolean;
  onRecheck: () => void;
  settings: StudioSettings | null;
  onSave: (next: StudioSettings) => Promise<StudioSettings>;
  experience: Experience;
}

const STEPS: { id: AiStep; label: string; detail: string }[] = [
  { id: 'kickoff', label: 'Project plan and questions', detail: 'Reads your name and idea, suggests next steps and asks questions made for this project.' },
  { id: 'direction', label: 'Art directions', detail: 'Proposes palettes, type and style; contrast is always checked.' },
  { id: 'brief', label: 'Creative brief', detail: 'Fills audience, tone and chapters for you to edit.' },
  { id: 'storyboard', label: 'Storyboard', detail: 'Drafts scenes and copy from the approved brief.' },
  { id: 'scene', label: 'Scene edits', detail: 'Rewrites one scene at a time; you accept or reject the change.' },
  { id: 'chat', label: 'Studio chat', detail: 'Builds through conversation; every change is a card you accept.' },
  { id: 'research', label: 'Deep research', detail: 'Searches the web for your topic and cites its sources.' },
];

const LABEL: Record<AiChoice, string> = { 'claude-code': 'Claude Code', codex: 'Codex', none: 'Off' };

export function ProvidersView({ providers, checking, onRecheck, settings, onSave, experience }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<{ jobId: string; title: string } | null>(null);
  const [result, setResult] = useState<JobSnapshot | null>(null);
  const installed = (id: AiProviderId) => providers?.find((p) => p.id === id)?.state === 'available';

  const save = async (next: StudioSettings) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const setStep = (step: AiStep, value: AiChoice | 'default') => {
    if (!settings) return;
    const steps = { ...settings.steps };
    if (value === 'default') delete steps[step];
    else steps[step] = value;
    void save({ ...settings, steps });
  };
  const runTest = async (provider: AiProviderId) => {
    setResult(null);
    try {
      const job = await call('ai.test', { provider });
      setTest({ jobId: job.id, title: job.title ?? 'Testing connection' });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const missing = (choice: AiChoice) => choice !== 'none' && providers !== null && !installed(choice);

  return (
    <div className="page">
      <div className="page__header">
        <h1>AI providers</h1>
        <button type="button" className="btn btn--secondary" onClick={onRecheck} disabled={checking} aria-busy={checking}>
          {checking && <SpinnerIcon />}
          Check again
        </button>
      </div>
      <p className="muted page__intro">The studio uses the official CLIs you install and sign in to yourself. Choose which one helps at each step; you review and approve everything it suggests.</p>
      <div className="notice">
        <ShieldIcon />
        <p>
          Your sign-in stays with each CLI. The studio never reads, copies or shares credentials or subscription sessions. AI runs on this computer with its tools limited to the task (no shell, no file edits), every result is validated, and usage counts against your own plan under that provider’s terms.
        </p>
      </div>
      <table className="table">
        <caption className="visually-hidden">Provider status</caption>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Status</th>
            <th scope="col">Version</th>
            <th scope="col">Used for</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {providers === null ? (
            <tr>
              <td colSpan={5} className="muted">
                Checking installed CLIs…
              </td>
            </tr>
          ) : (
            providers.map((p) => {
              const used = settings ? STEPS.filter((s) => (settings.steps[s.id] ?? settings.provider) === p.id).length : 0;
              return (
                <tr key={p.id}>
                  <th scope="row">{p.displayName}</th>
                  <td>{p.state === 'available' ? <StatusChip tone="ok">Installed</StatusChip> : p.state === 'not-found' ? <StatusChip tone="idle">Not installed</StatusChip> : <StatusChip tone="warn">Error</StatusChip>}</td>
                  <td className="mono">{p.version ?? '—'}</td>
                  <td>{used ? <StatusChip tone="ok">{`${used} of ${STEPS.length} steps`}</StatusChip> : <StatusChip tone="idle">Off</StatusChip>}</td>
                  <td>
                    <button type="button" className="btn btn--secondary btn--small" disabled={p.state !== 'available' || test !== null} onClick={() => void runTest(p.id)}>
                      Test connection
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {test && (
        <AiActivity
          jobId={test.jobId}
          title={test.title}
          onFinished={(job) => {
            setTest(null);
            setResult(job);
          }}
        />
      )}
      {result && (
        <div className={`notice ${result.status === 'succeeded' ? 'notice--ok' : ''}`} role="status">
          <p>{result.status === 'succeeded' ? result.log.at(-1) : result.status === 'cancelled' ? 'Test cancelled.' : `The test failed: ${result.error ?? 'unknown error'}`}</p>
        </div>
      )}

      {settings && (
        <>
          <section className="card setting" aria-labelledby="default-provider-title">
            <h2 id="default-provider-title">Default AI</h2>
            <p className="muted">Used by every step unless you choose otherwise below.</p>
            <Segmented
              label="Default AI"
              value={settings.provider}
              onChange={(provider) => void save({ ...settings, provider })}
              options={(['claude-code', 'codex', 'none'] as const).map((id) => ({ id, label: LABEL[id] }))}
            />
            {missing(settings.provider) && <p className="small card__reason">{LABEL[settings.provider]} is not installed. Steps fall back to the local planner until it is.</p>}
          </section>

          <details className="advanced" open={experience === 'pro'}>
            <summary>Advanced: AI for each step and deep research</summary>
          <section className="card setting" aria-labelledby="steps-title">
            <h2 id="steps-title">AI for each step</h2>
            <ul className="step-providers">
              {STEPS.map((step) => {
                const value = settings.steps[step.id] ?? 'default';
                return (
                  <li key={step.id}>
                    <div>
                      <label className="step-providers__label" htmlFor={`step-${step.id}`}>
                        {step.label}
                      </label>
                      <p className="small muted">{step.detail}</p>
                    </div>
                    <select id={`step-${step.id}`} value={value} disabled={saving} onChange={(e) => setStep(step.id, e.target.value as AiChoice | 'default')}>
                      <option value="default">Default ({LABEL[settings.provider]})</option>
                      <option value="claude-code">Claude Code</option>
                      <option value="codex">Codex</option>
                      <option value="none">Off</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card setting" aria-labelledby="research-title">
            <h2 id="research-title">Deep research</h2>
            <p className="muted">When on, research tasks may search the web and read public pages about your topic. Only search and page reading are allowed; results cite their sources and are treated as untrusted input. Searches can use noticeably more of your plan.</p>
            <label className="toggle">
              <input type="checkbox" checked={settings.deepResearch} disabled={saving} onChange={(e) => void save({ ...settings, deepResearch: e.target.checked })} />
              <span>Allow web research</span>
            </label>
          </section>
          </details>
        </>
      )}
      {error && (
        <p className="small card__reason" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
