import { useEffect, useState } from 'react';
import type { CreativeState, StoryboardScene } from '@studio/contracts';
import { call } from '../../api';
import { StatusChip } from '../../components/Common';
import { SpinnerIcon } from '../../components/Icons';

interface Props {
  projectId: string;
  state: CreativeState;
  onState: (s: CreativeState) => void;
  onError: (message: string) => void;
  onApproved: () => void;
}

/** Renumber chapter IDs after reordering so IDs stay stable by position (hero-01, chapter-02…). */
function renumber(scenes: StoryboardScene[]): StoryboardScene[] {
  return scenes.map((s, i) => ({ ...s, id: i === 0 ? 'hero-01' : `chapter-${String(i + 1).padStart(2, '0')}`, type: i === 0 ? 'hero' : 'chapter' }));
}

export function StoryboardTab({ projectId, state, onState, onError, onApproved }: Props) {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [planner, setPlanner] = useState<'local-planner' | 'claude-code'>('local-planner');
  const [busy, setBusy] = useState<'draft' | 'save' | 'approve' | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => setScenes(state.storyboard?.scenes ?? []), [state.storyboard]);

  if (!state.brief?.approved) {
    return (
      <div className="tab-body">
        <div className="empty">
          <p className="empty__title">Approve the brief first</p>
          <p className="empty__body">The storyboard is drafted from the approved creative brief.</p>
        </div>
      </div>
    );
  }

  const dirty = JSON.stringify(scenes) !== JSON.stringify(state.storyboard?.scenes ?? []);
  const update = (index: number, patch: Partial<StoryboardScene>) => setScenes((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const move = (index: number, delta: number) =>
    setScenes((list) => {
      const target = index + delta;
      if (target < 1 || target >= list.length || index < 1) return list; // hero stays first
      const next = [...list];
      [next[index], next[target]] = [next[target]!, next[index]!];
      setAnnouncement(`Moved “${list[index]!.heading}” to position ${target + 1}.`);
      return renumber(next);
    });
  const remove = (index: number) => setScenes((list) => renumber(list.filter((_, i) => i !== index)));
  const add = () =>
    setScenes((list) => renumber([...list, { id: 'chapter-99', type: 'chapter', eyebrow: `Chapter ${list.length}`, heading: 'New chapter', body: 'Starter text — replace with this chapter’s story.', layout: 'split', visualNote: '' }]));

  const run = async (kind: 'draft' | 'save' | 'approve') => {
    setBusy(kind);
    try {
      if (kind === 'draft') {
        onState(await call('creative.draftStoryboard', { projectId, planner }));
      } else {
        let next = state;
        if (dirty) next = await call('creative.saveStoryboard', { projectId, scenes });
        if (kind === 'approve') {
          next = await call('creative.approveStoryboard', { projectId });
          onApproved();
        }
        onState(next);
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const selectedPlanner = state.planners.find((p) => p.id === planner);

  return (
    <div className="tab-body">
      <div className="tab-head">
        <h2>Storyboard</h2>
        {state.storyboard && (state.storyboard.approved && !dirty ? <StatusChip tone="ok">Approved</StatusChip> : <StatusChip tone="warn">Needs approval</StatusChip>)}
      </div>

      <div className="planner">
        <fieldset className="fieldset fieldset--inline">
          <legend>Draft with</legend>
          {state.planners.map((p) => (
            <label key={p.id} className={`radio ${p.available ? '' : 'radio--disabled'}`}>
              <input type="radio" name="planner" value={p.id} checked={planner === p.id} disabled={!p.available} onChange={() => setPlanner(p.id)} />
              {p.label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn btn--secondary" onClick={() => void run('draft')} disabled={busy !== null || !selectedPlanner?.available} aria-busy={busy === 'draft'}>
          {busy === 'draft' && <SpinnerIcon />}
          {state.storyboard ? 'Redraft storyboard' : 'Draft storyboard'}
        </button>
      </div>
      {state.planners.filter((p) => !p.available && p.reason).map((p) => (
        <p key={p.id} className="muted small">
          {p.label}: {p.reason}
        </p>
      ))}
      {state.storyboard && <p className="muted small">Source: {state.storyboard.source.detail}</p>}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <ol className="scene-list" aria-label="Storyboard scenes">
        {scenes.map((scene, index) => (
          <li key={`${scene.id}-${index}`} className="card scene-card">
            <div className="card__head">
              <span className="scene-card__index">{index + 1}</span>
              <h3>{scene.type === 'hero' ? 'Hero' : 'Chapter'}</h3>
              <span className="mono small muted">{scene.id}</span>
              {scene.type === 'chapter' && (
                <span className="scene-card__actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => move(index, -1)} disabled={index <= 1} aria-label={`Move scene ${index + 1} up`}>
                    ↑
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => move(index, 1)} disabled={index >= scenes.length - 1} aria-label={`Move scene ${index + 1} down`}>
                    ↓
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => remove(index)} disabled={scenes.length <= 2} aria-label={`Remove scene ${index + 1}`}>
                    Remove
                  </button>
                </span>
              )}
            </div>
            {scene.type === 'chapter' && (
              <div className="field">
                <label htmlFor={`eyebrow-${index}`}>Eyebrow</label>
                <input id={`eyebrow-${index}`} value={scene.eyebrow ?? ''} maxLength={120} onChange={(e) => update(index, { eyebrow: e.target.value })} />
              </div>
            )}
            <div className="field">
              <label htmlFor={`heading-${index}`}>Heading</label>
              <input id={`heading-${index}`} value={scene.heading} maxLength={200} onChange={(e) => update(index, { heading: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`body-${index}`}>Body</label>
              <textarea id={`body-${index}`} rows={2} value={scene.body} maxLength={1200} onChange={(e) => update(index, { body: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`visual-${index}`}>Visual note (also the text alternative for decorative art)</label>
              <input id={`visual-${index}`} value={scene.visualNote} maxLength={300} onChange={(e) => update(index, { visualNote: e.target.value })} />
            </div>
          </li>
        ))}
      </ol>

      {state.storyboard && (
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={() => void run('approve')} disabled={busy !== null || scenes.some((s) => !s.heading.trim()) || (state.storyboard.approved && !dirty)} aria-busy={busy === 'approve'}>
            {busy === 'approve' && <SpinnerIcon />}
            Approve storyboard
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => void run('save')} disabled={busy !== null || !dirty}>
            Save draft
          </button>
          <button type="button" className="btn btn--ghost" onClick={add} disabled={scenes.length >= 7}>
            Add chapter
          </button>
        </div>
      )}
    </div>
  );
}
