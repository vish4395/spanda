import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ProjectSummary } from '@studio/contracts/ipc';
import { call } from '../api';
import { SpinnerIcon } from '../components/Icons';

interface Props {
  /** AI is set up, so the studio will plan the project right after it is created. */
  aiOn: boolean;
  onCreated: (project: ProjectSummary) => void;
  onCancel: () => void;
}

const LIMITS = { name: 80, goal: 300 };

/** Starting points for people who are not sure how to describe their site. */
const EXAMPLES = [
  { name: 'Riverside Lantern Festival', goal: 'Invite local families to an evening lantern festival by the river.' },
  { name: 'Halden Desk Lamp', goal: 'Launch a desk lamp that follows daylight, for people who work from home.' },
  { name: 'Studio Marrow', goal: 'A portfolio for a set designer who builds walk-through exhibitions.' },
  { name: 'Chai Trail', goal: 'Tell the journey of Assam tea from garden to cup for a small tea brand.' },
];

export function NewProjectView({ aiOn, onCreated, onCancel }: Props) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [touched, setTouched] = useState({ name: false, goal: false });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => nameRef.current?.focus(), []);

  const errors = {
    name: !name.trim() ? 'Give the project a name.' : name.trim().length > LIMITS.name ? `Keep the name under ${LIMITS.name} characters.` : null,
    goal: !goal.trim() ? 'Describe the idea in one line.' : goal.trim().length > LIMITS.goal ? `Keep the idea under ${LIMITS.goal} characters.` : null,
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, goal: true });
    if (errors.name) return nameRef.current?.focus();
    if (errors.goal) return goalRef.current?.focus();
    setSubmitting(true);
    setServerError(null);
    try {
      onCreated(await call('projects.create', { name: name.trim(), goal: goal.trim() }));
    } catch (err) {
      setServerError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form className="form-page" onSubmit={(e) => void submit(e)} noValidate aria-labelledby="new-project-title">
      <h1 id="new-project-title">New project</h1>
      <p className="muted">
        Start with a name and one line about your idea.{' '}
        {aiOn ? 'AI then plans the project, suggests next steps and asks a few questions written for it.' : 'The studio then asks a few quick questions and drafts a starting point you can edit.'} Nothing is final until you approve it.
      </p>

      <div className="examples" role="group" aria-labelledby="examples-title">
        <p id="examples-title" className="small muted">
          Not sure? Start from an example:
        </p>
        <div className="examples__list">
          {EXAMPLES.map((example) => (
            <button
              key={example.name}
              type="button"
              className="example-chip"
              onClick={() => {
                setName(example.name);
                setGoal(example.goal);
                setTouched({ name: false, goal: false });
              }}
            >
              {example.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          ref={nameRef}
          value={name}
          maxLength={LIMITS.name + 20}
          autoComplete="off"
          aria-invalid={touched.name && Boolean(errors.name)}
          aria-describedby="project-name-error"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
        <p id="project-name-error" className="field__error" aria-live="polite">
          {touched.name ? errors.name : ''}
        </p>
      </div>

      <div className="field">
        <label htmlFor="project-goal">One-line idea</label>
        <textarea
          id="project-goal"
          ref={goalRef}
          rows={3}
          value={goal}
          maxLength={LIMITS.goal + 50}
          aria-invalid={touched.goal && Boolean(errors.goal)}
          aria-describedby="project-goal-help project-goal-error"
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, goal: true }))}
        />
        <p id="project-goal-help" className="field__help">
          Who is it for and what should they feel or do? For example: “Introduce a family-run bakery with warm, cinematic scenes.” {goal.trim().length}/{LIMITS.goal}
        </p>
        <p id="project-goal-error" className="field__error" aria-live="polite">
          {touched.goal ? errors.goal : ''}
        </p>
      </div>

      {serverError && (
        <p className="field__error" role="alert">
          {serverError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={submitting} aria-busy={submitting}>
          {submitting && <SpinnerIcon />}
          Create project
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
