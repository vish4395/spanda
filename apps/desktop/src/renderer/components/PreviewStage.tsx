import { useLayoutEffect, useRef, useState } from 'react';
import type { PreviewIssue } from '@studio/contracts';
import { AlertIcon, MonitorIcon, PhoneIcon, TabletIcon, XIcon } from './Icons';

export const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900, Icon: MonitorIcon },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024, Icon: TabletIcon },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844, Icon: PhoneIcon },
] as const;
export type DeviceId = (typeof DEVICES)[number]['id'];

interface StageProps {
  url: string | null;
  device: DeviceId;
  title: string;
  /** Scene id to scroll to (fragment navigation inside the sandboxed frame, no reload). */
  anchor?: string | null;
  /** Build error to show over the stage (T019). */
  error?: string | null;
  onRetry?: () => void;
  /** Errors reported by the running page (T019); shown without blocking the preview. */
  issues?: PreviewIssue[];
  issuesDropped?: number;
  onDismissIssues?: () => void;
}

const ISSUE_LABEL: Record<PreviewIssue['kind'], string> = { exception: 'Uncaught error', console: 'Console error', network: 'Failed to load', security: 'Blocked by security policy' };

export function PreviewStage({ url, device, title, anchor, error, onRetry, issues = [], issuesDropped = 0, onDismissIssues }: StageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const spec = DEVICES.find((d) => d.id === device)!;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const padding = 48;
      setScale(Math.max(0.1, Math.min(1, (stage.clientWidth - padding) / spec.width, (stage.clientHeight - padding) / spec.height)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [spec.width, spec.height]);

  return (
    <div className="stage" ref={stageRef}>
      {url ? (
        <div className="device" style={{ width: spec.width * scale, height: spec.height * scale }}>
          <iframe
            key={url}
            title={title}
            src={anchor ? `${url}#${anchor}` : url}
            // Opaque origin, no same-origin access to the studio, no popups/forms/top navigation.
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            style={{ width: spec.width, height: spec.height, transform: `scale(${scale})` }}
          />
        </div>
      ) : error ? null : (
        <div className="empty">
          <MonitorIcon />
          <p className="empty__title">No preview yet</p>
          <p className="empty__body">Generate the project to build native HTML and React sites from its StorySpec.</p>
        </div>
      )}
      {error && (
        <div className="stage__overlay" role="alert">
          <p className="alert__title">The last build failed</p>
          <pre className="alert__detail">{error}</pre>
          {onRetry && (
            <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
              Retry build
            </button>
          )}
        </div>
      )}
      {url && !error && issues.length > 0 && (
        <section className="stage__issues" aria-label="Preview errors">
          <div className="stage__issues-head">
            <AlertIcon />
            <p className="alert__title">
              The page reported {issues.length + issuesDropped} error{issues.length + issuesDropped === 1 ? '' : 's'}
            </p>
            {onDismissIssues && (
              <button type="button" className="btn btn--ghost btn--small" aria-label="Dismiss preview errors" onClick={onDismissIssues}>
                <XIcon />
              </button>
            )}
          </div>
          <ol className="stage__issues-list">
            {issues.map((issue, i) => (
              <li key={`${issue.at}-${i}`} className="stage__issue">
                <p className="stage__issue-head">
                  <span className="stage__issue-kind">{ISSUE_LABEL[issue.kind]}</span>
                  {issue.source && (
                    <span className="muted small mono">
                      {issue.source}
                      {issue.line !== null ? `:${issue.line}` : ''}
                    </span>
                  )}
                </p>
                <pre className="stage__issue-message">{issue.message}</pre>
              </li>
            ))}
          </ol>
          {issuesDropped > 0 && <p className="muted small">{issuesDropped} earlier error{issuesDropped === 1 ? '' : 's'} not shown.</p>}
        </section>
      )}
    </div>
  );
}
