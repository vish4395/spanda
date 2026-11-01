import type { ProviderStatus } from '@studio/contracts/ipc';
import { StatusChip } from '../components/Common';
import { ShieldIcon, SpinnerIcon } from '../components/Icons';

interface Props {
  providers: ProviderStatus[] | null;
  checking: boolean;
  onRecheck: () => void;
}

export function ProvidersView({ providers, checking, onRecheck }: Props) {
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
          Your sign-in stays with each CLI. The studio never reads, copies or shares credentials or subscription sessions. AI generation through providers stays off until each CLI’s supported automation modes and terms have been reviewed (docs/07).
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
                  <StatusChip tone="idle">Off — pending terms review</StatusChip>
                </td>
                <td className="muted">{p.detail ?? ''}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
