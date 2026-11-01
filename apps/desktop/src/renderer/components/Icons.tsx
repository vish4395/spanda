// Original line icons (24px grid, 1.75 stroke) — decorative unless labelled by the caller.
import type { ReactNode } from 'react';

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const LogoMark = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" />
    <path d="M12 7.5 16 9.8v4.4L12 16.5 8 14.2V9.8z" fill="currentColor" />
  </svg>
);
export const FolderIcon = () => <Icon><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></Icon>;
export const PlayIcon = () => <Icon><path d="M8 5.5v13l10-6.5z" /></Icon>;
export const StopIcon = () => <Icon><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" /></Icon>;
export const MonitorIcon = () => <Icon><rect x="3" y="4.5" width="18" height="12" rx="1.5" /><path d="M9 20h6M12 16.5V20" /></Icon>;
export const TabletIcon = () => <Icon><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 17.5h2" /></Icon>;
export const PhoneIcon = () => <Icon><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" /></Icon>;
export const CheckIcon = () => <Icon><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const AlertIcon = () => <Icon><path d="M12 3.5 21.5 20h-19z" /><path d="M12 10v4.5M12 17.5v.01" /></Icon>;
export const XIcon = () => <Icon><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const SpinnerIcon = () => (
  <span className="spinner" aria-hidden="true">
    <Icon><path d="M12 3a9 9 0 1 0 9 9" /></Icon>
  </span>
);
export const TerminalIcon = () => <Icon><rect x="3" y="4.5" width="18" height="15" rx="1.5" /><path d="m7 9.5 3 2.5-3 2.5M12.5 15H17" /></Icon>;
export const ShieldIcon = () => <Icon><path d="M12 3 19.5 6v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" /></Icon>;
export const ChevronIcon = ({ open }: { open: boolean }) => <Icon><path d={open ? 'm6 9 6 6 6-6' : 'm6 15 6-6 6 6'} /></Icon>;
