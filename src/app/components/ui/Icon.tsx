import React from 'react';

// Minimal inline SVG icon set (no external emoji). Stroke uses currentColor.
const PATHS: Record<string, React.ReactNode> = {
  play: <path d="M8 5v14l11-7z" />,
  folder: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  gamepad: (
    <>
      <rect x="3" y="8" width="18" height="9" rx="3" />
      <path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z" />
      <path d="M19 18H6a2 2 0 0 0-2 2" />
    </>
  ),
  doc: (
    <>
      <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v4h4M8 13h8M8 17h6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16l3-4 3 3 4-6" />
    </>
  ),
  shield: <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  news: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  ai: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  consult: <path d="M12 2l2.5 6.5L21 9l-5 4 2 8-6-4-6 4 2-8-5-4 6.5-.5z" />,
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3a6 6 0 0 0-4-10z" />
    </>
  ),
  heart: <path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />,
  star: <path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" />,
  dept: <path d="M4 4h16v16H4zM4 9h16M9 4v16" />,
  rerun: (
    <>
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 20v-5h5" />
    </>
  ),
  check: <path d="M5 12l5 5L20 6" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export const Icon: React.FC<{ name: IconName; size?: number; className?: string }> = ({ name, size = 16, className }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {PATHS[name]}
  </svg>
);
