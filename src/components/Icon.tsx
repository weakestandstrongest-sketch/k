/** 細い線で描いたアイコン（外部ライブラリを使わない） */
export type IconName =
  | 'hall'
  | 'orrery'
  | 'equation'
  | 'chronicle'
  | 'plus'
  | 'prev'
  | 'next'
  | 'close'
  | 'edit'
  | 'trash'
  | 'check'
  | 'clock'
  | 'pin'
  | 'grip'
  | 'gear'
  | 'warn'
  | 'lock'
  | 'star'
  | 'undo'
  | 'repeat'
  | 'sun'
  | 'moon'
  | 'device';

const PATHS: Record<IconName, string> = {
  hall: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6a3 3 0 0 1 6 0v6',
  orrery: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M12 12m-9 0a9 4 0 1 0 18 0a9 4 0 1 0 -18 0M19 7.5a1.5 1.5 0 1 0 0.01 0',
  equation: 'M4 7h7M4 12h16M13 17h7M15 4l-4 6M9 20l4-6',
  chronicle: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  plus: 'M12 5v14M5 12h14',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  check: 'M5 12.5l4.5 4.5L19 7',
  clock: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M12 8v4l3 2',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  gear: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  repeat: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  device: 'M8.5 3h7a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5v-15A1.5 1.5 0 0 1 8.5 3zM11 18h2',
};

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'grip' ? 3 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
