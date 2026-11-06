import { useEffect, useState } from 'react';
import type { CreativeState, StoryboardPlanner, StoryboardScene } from '@studio/contracts';
import { call } from '../../api';
import { StatusChip } from '../../components/Common';
import { ITEM_LIMITS, ItemsEditor } from '../../components/ItemsEditor';
import { SpinnerIcon } from '../../components/Icons';

interface Props {
  projectId: string;
  state: CreativeState;
  onState: (s: CreativeState) => void;
  onError: (message: string) => void;
  onApproved: () => void;
  /** Pro mode shows scene IDs. */
  pro: boolean;
}

type SceneType = StoryboardScene['type'];
const TYPE_LABELS: Record<SceneType, string> = { hero: 'Hero', chapter: 'Chapter', 'scroll-reveal': 'Scroll reveal', 'model-showcase': '3D showcase', gallery: 'Gallery', cta: 'Call to action' };
const ID_PREFIX: Record<SceneType, string> = { hero: 'hero', chapter: 'chapter', 'scroll-reveal': 'reveal', 'model-showcase': 'showcase', gallery: 'gallery', cta: 'cta' };

/** New scenes get a fresh unique ID; existing IDs never change (docs/04: stable scene IDs). */
function uniqueId(type: SceneType, scenes: StoryboardScene[]): string {
  const taken = new Set(scenes.map((s) => s.id));
  for (let n = scenes.length + 1; ; n += 1) {
    const id = `${ID_PREFIX[type]}-${String(n).padStart(2, '0')}`;
    if (!taken.has(id)) return id;
  }
}

function newScene(type: SceneType, id: string): StoryboardScene {
  const base = { id, type, heading: 'New scene', body: '', visualNote: '' };
  if (type === 'scroll-reveal') return { ...base, heading: 'How it unfolds', items: [{ title: 'First', text: 'Starter text.' }, { title: 'Then', text: 'Starter text.' }, { title: 'Finally', text: 'Starter text.' }] };
  if (type === 'gallery') return { ...base, heading: 'Highlights', items: [{ title: 'One', text: 'Starter text.' }, { title: 'Two', text: 'Starter text.' }, { title: 'Three', text: 'Starter text.' }] };
  if (type === 'model-showcase') return { ...base, heading: 'A closer look', body: 'Starter text — describe the object.', object: 'orb' };
  if (type === 'cta') return { ...base, heading: 'Join us', body: 'Starter text — the invitation.', cta: { label: 'Get in touch', href: '#hero-01' } };
  return { ...base, eyebrow: 'Chapter', heading: 'New chapter', body: 'Starter text — replace with this chapter’s story.', layout: 'split' };
}

export function StoryboardTab({ projectId, state, onState, onError, onApproved, pro }: Props) {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  // Preselect the AI chosen for this step when it can run; otherwise the local planner.
  const [picked, setPicked] = useState<StoryboardPlanner | null>(null);
  const planner = picked ?? state.planners.find((p) => p.id !== 'local-planner' && p.available)?.id ?? 'local-planner';
  const [busy, setBusy] = useState<'draft' | 'save' | 'approve' | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [addType, setAddType] = useState<SceneType>('chapter');

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
      return next;
    });
  const remove = (index: number) => setScenes((list) => list.filter((_, i) => i !== index));
  const add = () => setScenes((list) => [...list, newScene(addType, uniqueId(addType, list))]);

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
              <input type="radio" name="planner" value={p.id} checked={planner === p.id} disabled={!p.available} onChange={() => setPicked(p.id)} />
              {p.label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn btn--secondary" onClick={() => void run('draft')} disabled={busy !== null || state.aiJob !== null || !selectedPlanner?.available} aria-busy={busy === 'draft'}>
          {busy === 'draft' && <SpinnerIcon />}
          {state.storyboard ? 'Redraft storyboard' : 'Draft storyboard'}
        </button>
      </div>
      {state.planners.filter((p) => !p.available && p.reason && p.id === picked).map((p) => (
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
              <h3>{TYPE_LABELS[scene.type]}</h3>
              {pro && <span className="mono small muted">{scene.id}</span>}
              {scene.type !== 'hero' && (
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
            {scene.type !== 'hero' && (
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
              <textarea id={`body-${index}`} rows={2} value={scene.body} maxLength={4000} onChange={(e) => update(index, { body: e.target.value })} />
            </div>
            {(scene.type === 'gallery' || scene.type === 'scroll-reveal') && (
              <ItemsEditor idPrefix={`items-${index}`} items={scene.items ?? []} {...ITEM_LIMITS[scene.type]} onChange={(items) => update(index, { items })} />
            )}
            {scene.type === 'model-showcase' && (
              <div className="field">
                <label htmlFor={`object-${index}`}>3D object</label>
                <select id={`object-${index}`} value={scene.object ?? 'orb'} onChange={(e) => update(index, { object: e.target.value as 'monolith' | 'vessel' | 'orb' })}>
                  <option value="orb">Orb</option>
                  <option value="vessel">Vessel</option>
                  <option value="monolith">Monolith</option>
                </select>
              </div>
            )}
            {scene.type === 'cta' && (
              <div className="field-grid">
                <div className="field">
                  <label htmlFor={`cta-label-${index}`}>Button label</label>
                  <input id={`cta-label-${index}`} value={scene.cta?.label ?? ''} maxLength={80} onChange={(e) => update(index, { cta: { label: e.target.value, href: scene.cta?.href ?? '#hero-01' } })} />
                </div>
                <div className="field">
                  <label htmlFor={`cta-href-${index}`}>Link (https://, mailto: or #section)</label>
                  <input id={`cta-href-${index}`} value={scene.cta?.href ?? ''} maxLength={2048} onChange={(e) => update(index, { cta: { label: scene.cta?.label ?? 'Learn more', href: e.target.value } })} />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor={`visual-${index}`}>Visual note (also the text alternative for decorative art)</label>
              <input id={`visual-${index}`} value={scene.visualNote} maxLength={1000} onChange={(e) => update(index, { visualNote: e.target.value })} />
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
          <span className="add-scene">
            <label htmlFor="add-scene-type" className="visually-hidden">
              Scene type to add
            </label>
            <select id="add-scene-type" value={addType} onChange={(e) => setAddType(e.target.value as SceneType)}>
              {(['chapter', 'scroll-reveal', 'model-showcase', 'gallery', 'cta'] as const).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn--ghost" onClick={add} disabled={scenes.length >= 8}>
              Add scene
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
