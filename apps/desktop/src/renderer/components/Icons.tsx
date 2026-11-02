// Original line icons (24px grid, 1.75 stroke) — decorative unless labelled by the caller.
import type { ReactNode } from 'react';

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Spanda's Kolam S: one unbroken line around two lamps (docs/brand/assets/spanda-mark.svg). */
export const LogoMark = () => (
  <svg width={24} height={24} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path d="M42.34 16.24A11 11 0 1 0 32 31a11 11 0 1 1-10.34 14.76" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
    <circle cx={32} cy={20} r={3.4} fill="var(--brand-gold)" />
    <circle cx={32} cy={42} r={3.4} fill="var(--brand-gold)" />
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
export const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;
export const PuzzleIcon = () => <Icon><path d="M9 4.5a2 2 0 1 1 4 0V6h4v4h-1.5a2 2 0 1 0 0 4H17v4h-4v-1.5a2 2 0 1 0-4 0V18H5v-4h1.5a2 2 0 1 0 0-4H5V6h4z" /></Icon>;
export const ServerIcon = () => <Icon><rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" /><path d="M8 7.5h.01M8 16.5h.01" /></Icon>;
export const MotionIcon = () => <Icon><path d="M3 12h4l2.5-6 5 12 2.5-6h4" /></Icon>;
