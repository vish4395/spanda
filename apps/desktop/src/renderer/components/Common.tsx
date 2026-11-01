import type { KeyboardEvent, ReactNode } from 'react';
import { AlertIcon, CheckIcon, SpinnerIcon, XIcon } from './Icons';

export type Tone = 'ok' | 'warn' | 'error' | 'busy' | 'idle';

/** Status is always icon + text, never colour alone. */
export function StatusChip({ tone, children }: { tone: Tone; children: string }) {
  const icon = { ok: <CheckIcon />, warn: <AlertIcon />, error: <XIcon />, busy: <SpinnerIcon />, idle: null }[tone];
  return (
    <span className={`chip chip--${tone}`}>
      {icon}
      {children}
    </span>
  );
}

/** Accessible single-choice group rendered as a segmented control (arrow keys move selection). */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; icon?: ReactNode }[]; onChange: (v: T) => void }) {
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const nextIndex = (index + delta + options.length) % options.length;
    onChange(options[nextIndex]!.id);
    (event.currentTarget.parentElement?.children[nextIndex] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          tabIndex={value === option.id ? 0 : -1}
          className="segmented__option"
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onRetry, onDismiss, retryDisabled }: { message: string; onRetry?: (() => void) | undefined; onDismiss: () => void; retryDisabled?: boolean }) {
  return (
    <div className="alert" role="alert">
      <AlertIcon />
      <div className="alert__body">
        <p className="alert__title">Something went wrong</p>
        <pre className="alert__detail">{message}</pre>
      </div>
      {onRetry && (
        <button type="button" className="btn btn--secondary" onClick={onRetry} disabled={retryDisabled}>
          Retry
        </button>
      )}
      <button type="button" className="btn btn--ghost" aria-label="Dismiss error" onClick={onDismiss}>
        <XIcon />
      </button>
    </div>
  );
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86400), 'day');
}
