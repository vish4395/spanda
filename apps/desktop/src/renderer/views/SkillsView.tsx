import { useEffect, useState } from 'react';
import type { SkillManifest } from '@studio/contracts/ipc';
import { call } from '../api';
import { ErrorBanner, StatusChip } from '../components/Common';

export function SkillsView() {
  const [skills, setSkills] = useState<SkillManifest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call('skills.list')
      .then(setSkills)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <h1>Skills</h1>
      <p className="muted page__intro">
        Skills are versioned guidance for the studio’s AI roles. They are read as data, never executed. A skill is enabled only when its content matches the reviewed hash in
        <code> skills.lock.json</code>; skills with scripts stay disabled until scripts are approved.
      </p>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {skills === null && !error && <p className="muted">Loading skills…</p>}
      <ul className="card-list" aria-label="Installed skills">
        {skills?.map((skill) => (
          <li key={skill.id} className="card">
            <div className="card__head">
              <h2>{skill.name}</h2>
              <span className="muted small mono">v{skill.version}</span>
              <span className="card__chips">
                {skill.pin === 'pinned' ? <StatusChip tone="ok">Pinned</StatusChip> : skill.pin === 'modified' ? <StatusChip tone="error">Modified</StatusChip> : <StatusChip tone="warn">Not reviewed</StatusChip>}
                {skill.enabled ? <StatusChip tone="ok">Enabled</StatusChip> : <StatusChip tone="idle">Disabled</StatusChip>}
              </span>
            </div>
            {skill.description && <p>{skill.description}</p>}
            <dl className="meta">
              <div>
                <dt>Targets</dt>
                <dd>{skill.supportedTargets.join(', ') || 'any'}</dd>
              </div>
              <div>
                <dt>Triggers</dt>
                <dd>{skill.triggers.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>{skill.license}</dd>
              </div>
              <div>
                <dt>Scripts</dt>
                <dd>{skill.hasScripts ? (skill.scriptsApproved ? 'Approved' : 'Present — not approved') : 'None'}</dd>
              </div>
              <div>
                <dt>Content hash</dt>
                <dd className="mono">{skill.hash ? `${skill.hash.slice(0, 12)}…` : '—'}</dd>
              </div>
            </dl>
            {skill.reason && <p className="card__reason">{skill.reason}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
