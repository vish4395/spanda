import { useState, type FormEvent } from 'react';
import type { CreativeState } from '@studio/contracts';
import { call } from '../../api';
import { StatusChip } from '../../components/Common';
import { SpinnerIcon } from '../../components/Icons';

interface Props {
  projectId: string;
  state: CreativeState;
  onState: (s: CreativeState) => void;
  onError: (message: string) => void;
}

const TOTAL = 4;

export function DiscoverTab({ projectId, state, onState, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [inspiration, setInspiration] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const q = state.nextQuestion;

  const answer = async (questionId: string, value: string | null) => {
    setBusy(true);
    try {
      onState(await call('creative.answer', { projectId, questionId, answer: value }));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const analyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setAnalyzing(true);
    try {
      onState(await call('references.analyze', { projectId, url: url.trim(), inspiration }));
      setUrl('');
      setInspiration('');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const labelFor = (questionId: string, value: string) => {
    if (value === 'skip') return 'Skipped (studio default)';
    if (value === 'ai-decide') return 'Studio decides';
    return state.answered.find((a) => a.question.id === questionId)?.question.options.find((o) => o.id === value)?.label ?? value;
  };

  return (
    <div className="tab-body">
      {q ? (
        <section className="question" aria-labelledby="question-prompt">
          <p className="muted small">
            Question {state.answered.length + 1} of {TOTAL} · {q.reason}
          </p>
          <h2 id="question-prompt">{q.prompt}</h2>
          <div className="choice-grid" role="group" aria-labelledby="question-prompt">
            {q.options.map((option) => (
              <button key={option.id} type="button" className="choice" onClick={() => void answer(q.id, option.id)} disabled={busy}>
                <span className="choice__label">{option.label}</span>
                <span className="choice__text">{option.explanation}</span>
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--secondary" onClick={() => void answer(q.id, 'ai-decide')} disabled={busy}>
              You decide
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => void answer(q.id, 'skip')} disabled={busy}>
              Skip
            </button>
            {busy && <SpinnerIcon />}
          </div>
        </section>
      ) : (
        <div className="notice notice--ok">
          <StatusChip tone="ok">Discovery complete</StatusChip>
          <p>Your answers shaped a draft brief. Review it in the Brief tab.</p>
        </div>
      )}

      {state.answered.length > 0 && (
        <section aria-labelledby="answers-title">
          <h3 id="answers-title" className="section-title">
            Your answers
          </h3>
          <ul className="answers">
            {state.answered.map(({ question, answer: value }) => (
              <li key={question.id}>
                <span className="muted">{question.prompt}</span>
                <strong>{labelFor(question.id, value)}</strong>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => void answer(question.id, null)} disabled={busy} aria-label={`Change answer: ${question.prompt}`}>
                  Change
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="refs-title">
        <h3 id="refs-title" className="section-title">
          Reference links (optional)
        </h3>
        <p className="muted small">Public pages you like. The studio reads them safely (no logins, no private addresses) and records what it observed. References inspire structure and mood only — nothing is copied.</p>
        <form className="ref-form" onSubmit={(e) => void analyze(e)}>
          <div className="field">
            <label htmlFor="ref-url">Page URL</label>
            <input id="ref-url" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ref-why">What inspires you about it?</label>
            <input id="ref-why" value={inspiration} maxLength={300} onChange={(e) => setInspiration(e.target.value)} />
          </div>
          <button type="submit" className="btn btn--secondary" disabled={analyzing || !url.trim()} aria-busy={analyzing}>
            {analyzing && <SpinnerIcon />}
            Analyse
          </button>
        </form>
        <ul className="refs" aria-label="Analysed references">
          {state.references.map((ref) => (
            <li key={ref.id} className="card ref">
              {ref.screenshot && <img src={ref.screenshot} alt={`Screenshot of ${ref.title ?? ref.finalUrl} captured by the studio`} className="ref__shot" />}
              <div className="ref__body">
                <div className="card__head">
                  <h4>{ref.title ?? 'Untitled page'}</h4>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() =>
                      void call('references.remove', { projectId, referenceId: ref.id })
                        .then(onState)
                        .catch((e: Error) => onError(e.message))
                    }
                    aria-label={`Remove reference ${ref.title ?? ref.finalUrl}`}
                  >
                    Remove
                  </button>
                </div>
                <p className="mono small muted">{ref.finalUrl}</p>
                {ref.inspiration && <p className="small">Inspiration: {ref.inspiration}</p>}
                <ul className="observations">
                  {ref.observations.map((o) => (
                    <li key={o.text}>
                      <span className={`confidence confidence--${o.confidence}`}>{o.confidence}</span> {o.text}
                    </li>
                  ))}
                </ul>
                {ref.colors.length > 0 && (
                  <p className="swatches" aria-label={`Colours observed: ${ref.colors.map((c) => c.hex).join(', ')}`}>
                    {ref.colors.slice(0, 6).map((c) => (
                      <span key={c.hex} className="swatch" style={{ background: /^#[0-9a-f]{6}$/.test(c.hex) ? c.hex : 'transparent' }} title={c.hex} />
                    ))}
                  </p>
                )}
                <p className="small card__reason">{ref.rightsNotice}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
