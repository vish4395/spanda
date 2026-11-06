import { useState } from 'react';
import type { AiChoice, Experience, ProviderStatus } from '@studio/contracts';
import type { JobSnapshot, StudioSettings } from '@studio/contracts/ipc';
import { call } from '../api';
import { AiActivity } from '../components/AiActivity';
import { StatusChip } from '../components/Common';
import { ShieldIcon, SpinnerIcon } from '../components/Icons';

interface Props {
  providers: ProviderStatus[] | null;
  checking: boolean;
  onRecheck: () => void;
  onDone: (settings: StudioSettings) => void;
}

const NAMES: Record<Exclude<AiChoice, 'none'>, { title: string; detail: string }> = {
  'claude-code': { title: 'Claude Code CLI', detail: 'Anthropic’s official CLI, signed in with your own Claude account.' },
  codex: { title: 'Codex CLI', detail: 'OpenAI’s official CLI, signed in with your own ChatGPT or OpenAI account.' },
};

/** The installed provider to preselect: the only one, Claude when both are present, otherwise none. */
export function suggestedChoice(providers: ProviderStatus[] | null): AiChoice {
  const installed = (providers ?? []).filter((p) => p.state === 'available').map((p) => p.id);
  if (installed.includes('claude-code')) return 'claude-code';
  return installed[0] ?? 'none';
}

/** First run (UX S01): choose the AI provider the studio uses, test it, and read how data is handled. */
export function WelcomeView({ providers, checking, onRecheck, onDone }: Props) {
  const [picked, setPicked] = useState<AiChoice | null>(null);
  const choice = picked ?? suggestedChoice(providers);
  const [test, setTest] = useState<{ jobId: string; title: string } | null>(null);
  const [result, setResult] = useState<JobSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [experience, setExperience] = useState<Experience>('guided');
  const [error, setError] = useState<string | null>(null);
  const status = (id: Exclude<AiChoice, 'none'>) => providers?.find((p) => p.id === id);

  const finish = async (provider: AiChoice) => {
    setSaving(true);
    setError(null);
    try {
      onDone(await call('settings.set', { onboarded: true, experience, provider, steps: {}, deepResearch: false }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (choice === 'none') return;
    setResult(null);
    try {
      const job = await call('ai.test', { provider: choice });
      setTest({ jobId: job.id, title: job.title ?? 'Testing connection' });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="page welcome">
      <div className="page__header">
        <h1>Welcome to Spanda Studio</h1>
      </div>
      <h2 className="section-title">How do you like to work?</h2>
      <div className="direction-grid" role="radiogroup" aria-label="How you work">
        <button type="button" role="radio" aria-checked={experience === 'guided'} className="provider-choice" onClick={() => setExperience('guided')}>
          <span className="provider-choice__title">Guide me</span>
          <span className="choice__text">I have an idea but I’m new to building websites. Show me one clear next step at a time, in plain language, and let AI handle the defaults.</span>
        </button>
        <button type="button" role="radio" aria-checked={experience === 'pro'} className="provider-choice" onClick={() => setExperience('pro')}>
          <span className="provider-choice__title">I’m a designer or developer</span>
          <span className="choice__text">Show every control: design tokens, scene IDs, version history, logs, AI and skills per step, and the generated code.</span>
        </button>
      </div>
      <p className="muted small">You can switch any time with Guided / Pro in the top bar.</p>

      <h2 className="section-title">Which AI should help?</h2>
      <p className="muted page__intro">Choose the AI that helps at every step: project plan and questions, art directions, brief, storyboard, scene edits and chat. You review and approve everything it suggests. Without AI, every step still works with the studio’s local planner.</p>

      <div className="direction-grid" role="radiogroup" aria-label="AI provider">
        {(['claude-code', 'codex'] as const).map((id) => {
          const s = status(id);
          const installed = s?.state === 'available';
          return (
            <button key={id} type="button" role="radio" aria-checked={choice === id} className="provider-choice" disabled={!installed} onClick={() => setPicked(id)}>
              <span className="provider-choice__head">
                <span className="provider-choice__title">{NAMES[id].title}</span>
                {providers === null ? <StatusChip tone="busy">Checking</StatusChip> : installed ? <StatusChip tone="ok">Installed</StatusChip> : <StatusChip tone="idle">Not installed</StatusChip>}
              </span>
              <span className="choice__text">{NAMES[id].detail}</span>
              {s?.version && <span className="small mono muted">{s.version}</span>}
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={choice === 'none'} className="provider-choice" onClick={() => setPicked('none')}>
          <span className="provider-choice__head">
            <span className="provider-choice__title">No AI for now</span>
          </span>
          <span className="choice__text">Use the local planner. You can turn AI on later in AI providers.</span>
        </button>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onRecheck} disabled={checking} aria-busy={checking}>
          {checking && <SpinnerIcon />}
          Check again
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => void runTest()} disabled={choice === 'none' || test !== null}>
          Test connection
        </button>
      </div>
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

      <div className="notice">
        <ShieldIcon />
        <p>
          Your sign-in stays with the CLI you installed; the studio never reads, copies or shares credentials. AI runs on this computer with its tools limited to the task: no shell, no file edits, and web access only in deep research after you allow it. Usage counts against your own plan and follows that provider’s terms.
        </p>
      </div>
      {error && (
        <p className="small card__reason" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={() => void finish(choice)} disabled={saving}>
          {saving && <SpinnerIcon />}
          {choice === 'none' ? 'Continue without AI' : `Use ${NAMES[choice].title}`}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void finish('none')} disabled={saving}>
          Set up later
        </button>
      </div>
    </div>
  );
}
