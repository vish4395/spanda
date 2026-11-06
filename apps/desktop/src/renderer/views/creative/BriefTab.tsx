import { useEffect, useState } from 'react';
import type { CreativeBrief, CreativeState } from '@studio/contracts';
import { call } from '../../api';
import { Segmented, StatusChip } from '../../components/Common';
import { SpinnerIcon } from '../../components/Icons';

interface Props {
  projectId: string;
  state: CreativeState;
  onState: (s: CreativeState) => void;
  onError: (message: string) => void;
}

/** The editable fields; the direction snapshot is the main process's to set. */
type Draft = Pick<CreativeBrief, 'audience' | 'tone' | 'directionId' | 'motion' | 'chapters' | 'notes'>;

const toDraft = ({ audience, tone, directionId, motion, chapters, notes }: CreativeBrief): Draft => ({ audience, tone, directionId, motion, chapters, notes });

export function BriefTab({ projectId, state, onState, onError }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'save' | 'approve' | 'more' | null>(null);

  useEffect(() => {
    if (state.brief) setDraft(toDraft(state.brief));
  }, [state.brief]);

  if (!state.brief || !draft) {
    return (
      <div className="tab-body">
        <div className="empty">
          <p className="empty__title">No brief yet</p>
          <p className="empty__body">Answer the discovery questions (or skip them) and the studio drafts an editable brief.</p>
        </div>
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(state.brief));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const run = async (kind: 'save' | 'approve') => {
    setBusy(kind);
    try {
      let next = state;
      if (dirty || kind === 'save') next = await call('creative.saveBrief', { projectId, brief: draft });
      if (kind === 'approve') next = await call('creative.approveBrief', { projectId });
      onState(next);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const moreDirections = async () => {
    setBusy('more');
    try {
      onState(await call('creative.moreDirections', { projectId }));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="tab-body">
      <div className="tab-head">
        <h2>Creative brief</h2>
        {state.brief.approved && !dirty ? <StatusChip tone="ok">Approved</StatusChip> : <StatusChip tone="warn">Needs approval</StatusChip>}
      </div>

      <fieldset className="fieldset">
        <legend>Art direction</legend>
        <div className="direction-grid" role="radiogroup" aria-label="Art direction">
          {state.directions.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={draft.directionId === d.id} className="direction" onClick={() => set('directionId', d.id)}>
              <span className="direction__preview" style={{ background: d.colors.background, color: d.colors.foreground }}>
                <span className="direction__title" style={{ fontFamily: d.typography.heading }}>
                  {d.name}
                </span>
                <span className="direction__accent" style={{ background: d.colors.accent }} />
              </span>
              <span className="choice__text">{d.description}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => void moreDirections()} disabled={busy !== null} aria-busy={busy === 'more'}>
          {busy === 'more' && <SpinnerIcon />}
          Show other directions
        </button>
      </fieldset>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="brief-audience">Audience</label>
          <input id="brief-audience" value={draft.audience} maxLength={200} placeholder="Who is this story for?" onChange={(e) => set('audience', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="brief-tone">Tone</label>
          <input id="brief-tone" value={draft.tone} maxLength={120} onChange={(e) => set('tone', e.target.value)} />
        </div>
        <div className="field">
          <span className="field__label" id="brief-motion-label">
            Motion
          </span>
          <Segmented label="Motion" value={draft.motion} onChange={(v) => set('motion', v)} options={[{ id: 'calm', label: 'Calm' }, { id: 'balanced', label: 'Balanced' }, { id: 'bold', label: 'Bold' }]} />
        </div>
        <div className="field">
          <label htmlFor="brief-chapters">Chapters</label>
          <select id="brief-chapters" value={draft.chapters} onChange={(e) => set('chapters', Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="brief-notes">Notes for the storyboard</label>
        <textarea id="brief-notes" rows={3} value={draft.notes} maxLength={1000} placeholder="Anything that must (or must not) appear." onChange={(e) => set('notes', e.target.value)} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={() => void run('approve')} disabled={busy !== null || (state.brief.approved && !dirty)} aria-busy={busy === 'approve'}>
          {busy === 'approve' && <SpinnerIcon />}
          Approve brief
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => void run('save')} disabled={busy !== null || !dirty} aria-busy={busy === 'save'}>
          {busy === 'save' && <SpinnerIcon />}
          Save draft
        </button>
      </div>
    </div>
  );
}
