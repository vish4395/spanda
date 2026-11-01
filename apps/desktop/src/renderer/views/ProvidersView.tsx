import { useEffect, useState } from 'react';
import type { ProviderStatus, StudioSettings } from '@studio/contracts/ipc';
import { call } from '../api';
import { StatusChip } from '../components/Common';
import { ShieldIcon, SpinnerIcon } from '../components/Icons';

interface Props {
  providers: ProviderStatus[] | null;
  checking: boolean;
  onRecheck: () => void;
}

export function ProvidersView({ providers, checking, onRecheck }: Props) {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    call('settings.get').then(setSettings).catch(() => setSettings(null));
  }, []);
  const claude = providers?.find((p) => p.id === 'claude-code');
  const toggle = async (value: boolean) => {
    setSaving(true);
    try {
      setSettings(await call('settings.set', { claudeStoryboard: value }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="page">
      <div className="page__header">
        <h1>AI providers</h1>
        <button type="button" className="btn btn--secondary" onClick={onRecheck} disabled={checking} aria-busy={checking}>
          {checking && <SpinnerIcon />}
          Check again
        </button>
      </div>
      <p className="muted page__intro">The studio uses the official CLIs you install and sign in to yourself. It only checks whether each CLI is present and which version it is.</p>
      <div className="notice">
        <ShieldIcon />
        <p>
          Your sign-in stays with each CLI. The studio never reads, copies or shares credentials or subscription sessions. AI features are opt-in, run only on this computer through the CLI you installed, and every result is validated and reviewed by you.
        </p>
      </div>
      <table className="table">
        <caption className="visually-hidden">Provider status</caption>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Status</th>
            <th scope="col">Version</th>
            <th scope="col">AI generation</th>
            <th scope="col">Details</th>
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
            providers.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.displayName}</th>
                <td>{p.state === 'available' ? <StatusChip tone="ok">Installed</StatusChip> : p.state === 'not-found' ? <StatusChip tone="idle">Not installed</StatusChip> : <StatusChip tone="warn">Error</StatusChip>}</td>
                <td className="mono">{p.version ?? '—'}</td>
                <td>
                  {p.id === 'claude-code' && settings?.claudeStoryboard ? <StatusChip tone="ok">Storyboard drafting on</StatusChip> : <StatusChip tone="idle">Off</StatusChip>}
                </td>
                <td className="muted">{p.detail ?? ''}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <section className="card setting" aria-labelledby="claude-setting-title">
        <h2 id="claude-setting-title">Draft storyboards with Claude Code</h2>
        <p className="muted">
          When on, the Storyboard step can ask your locally installed, signed-in Claude Code CLI to draft scene copy. It runs in its documented non-interactive mode with every tool disabled, in an empty folder, and the prompt contains only this project’s name, idea, brief and reference observations. The result is validated and you review it before anything is approved. Usage counts against your own Claude plan and is subject to Anthropic’s terms.
        </p>
        <label className="toggle">
          <input type="checkbox" checked={settings?.claudeStoryboard ?? false} disabled={settings === null || saving || claude?.state !== 'available'} onChange={(e) => void toggle(e.target.checked)} />
          <span>Use Claude Code CLI for storyboard drafts</span>
        </label>
        {claude && claude.state !== 'available' && <p className="small card__reason">Install and sign in to the official Claude Code CLI to enable this.</p>}
      </section>
    </div>
  );
}
