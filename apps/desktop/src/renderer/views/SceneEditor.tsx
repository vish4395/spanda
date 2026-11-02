import { useEffect, useState } from 'react';
import type { StorySpec } from '@studio/contracts';
import { call } from '../api';
import { ITEM_LIMITS, ItemsEditor } from '../components/ItemsEditor';
import { SpinnerIcon } from '../components/Icons';

type Scene = StorySpec['pages'][number]['scenes'][number];

interface Props {
  projectId: string;
  scene: Scene;
  disabled: boolean;
  onSaved: (label: string) => void;
  onError: (message: string) => void;
}

/** Scoped edit of one scene (T020); other scenes are never touched. */
export function SceneEditor({ projectId, scene, disabled, onSaved, onError }: Props) {
  const [content, setContent] = useState(scene.content);
  const [object, setObject] = useState(scene.visual.object);
  const [fallbackText, setFallbackText] = useState(scene.accessibility.fallbackText);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(scene.content);
    setObject(scene.visual.object);
    setFallbackText(scene.accessibility.fallbackText);
  }, [scene]);

  const dirty = JSON.stringify(content) !== JSON.stringify(scene.content) || object !== scene.visual.object || fallbackText !== scene.accessibility.fallbackText;
  const id = (name: string) => `scene-${scene.id}-${name}`;
  const set = (patch: Partial<Scene['content']>) => setContent((c) => ({ ...c, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const version = await call('story.updateScene', {
        projectId,
        sceneId: scene.id,
        content,
        ...(scene.type === 'model-showcase' ? { visual: { ...scene.visual, object } } : {}),
        accessibility: { ...scene.accessibility, fallbackText },
      });
      onSaved(version.label);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="scene-editor"
      aria-label={`Edit scene ${scene.accessibility.label}`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {scene.type !== 'hero' && (
        <div className="field">
          <label htmlFor={id('eyebrow')}>Eyebrow</label>
          <input id={id('eyebrow')} value={content.eyebrow ?? ''} maxLength={120} onChange={(e) => set({ eyebrow: e.target.value || undefined })} />
        </div>
      )}
      <div className="field">
        <label htmlFor={id('heading')}>Heading</label>
        <input id={id('heading')} value={content.heading} maxLength={200} onChange={(e) => set({ heading: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={id('body')}>Body</label>
        <textarea id={id('body')} rows={3} value={content.body ?? ''} maxLength={4000} onChange={(e) => set({ body: e.target.value || undefined })} />
      </div>
      {(scene.type === 'gallery' || scene.type === 'scroll-reveal') && (
        <ItemsEditor idPrefix={id('items')} items={content.items ?? []} {...ITEM_LIMITS[scene.type]} onChange={(items) => set({ items })} />
      )}
      {scene.type === 'model-showcase' && (
        <div className="field">
          <label htmlFor={id('object')}>3D object</label>
          <select id={id('object')} value={object ?? 'orb'} onChange={(e) => setObject(e.target.value as 'monolith' | 'vessel' | 'orb')}>
            <option value="orb">Orb</option>
            <option value="vessel">Vessel</option>
            <option value="monolith">Monolith</option>
          </select>
        </div>
      )}
      {(scene.type === 'cta' || content.cta) && (
        <>
          <div className="field">
            <label htmlFor={id('cta-label')}>Button label</label>
            <input id={id('cta-label')} value={content.cta?.label ?? ''} maxLength={80} onChange={(e) => set({ cta: { label: e.target.value, href: content.cta?.href ?? '#hero-01' } })} />
          </div>
          <div className="field">
            <label htmlFor={id('cta-href')}>Link</label>
            <input id={id('cta-href')} value={content.cta?.href ?? ''} maxLength={2048} onChange={(e) => set({ cta: { label: content.cta?.label ?? 'Learn more', href: e.target.value } })} />
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor={id('fallback')}>Text alternative</label>
        <textarea id={id('fallback')} rows={2} value={fallbackText} maxLength={1000} onChange={(e) => setFallbackText(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary btn--small" disabled={!dirty || saving || disabled} aria-busy={saving}>
          {saving && <SpinnerIcon />}
          Apply to this scene
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={!dirty || saving}
          onClick={() => {
            setContent(scene.content);
            setObject(scene.visual.object);
            setFallbackText(scene.accessibility.fallbackText);
          }}
        >
          Discard
        </button>
      </div>
    </form>
  );
}
