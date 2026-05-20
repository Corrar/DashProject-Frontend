/* Inline SVG icons — simple, geometric. */
const I = ({ children, size = 18, stroke = 1.7, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
);

const Icon = {
  Logo: (p) => (
    <svg width={p.size||28} height={p.size||28} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="url(#lg1)"/>
      <rect x="7" y="14" width="3" height="8" rx="1.2" fill="white" opacity=".9"/>
      <rect x="12.5" y="9" width="3" height="13" rx="1.2" fill="white"/>
      <rect x="18" y="11.5" width="3" height="10.5" rx="1.2" fill="white" opacity=".85"/>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#3b78ff"/>
          <stop offset="1" stopColor="#1e4ed8"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  Sparkle: (p) => <I {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></I>,
  Wand: (p) => <I {...p}><path d="M15 4l5 5M4 20l9-9M14 5l5 5M3 13l1-1M11 5l1-1M19 13l1-1"/></I>,
  Upload: (p) => <I {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></I>,
  Chart: (p) => <I {...p}><path d="M4 4v16h16M8 14l3-3 3 3 5-6"/></I>,
  Bars: (p) => <I {...p}><path d="M4 20V10M10 20V4M16 20v-8M22 20v-4"/></I>,
  Line: (p) => <I {...p}><path d="M3 17l5-6 4 3 9-9"/></I>,
  Pie: (p) => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></I>,
  Lock: (p) => <I {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></I>,
  Check: (p) => <I {...p}><path d="M5 12l4 4 10-10"/></I>,
  Arrow: (p) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6"/></I>,
  Play: (p) => <I {...p}><path d="M7 5v14l12-7L7 5z" fill="currentColor"/></I>,
  Filter: (p) => <I {...p}><path d="M4 5h16M7 12h10M10 19h4"/></I>,
  Plus: (p) => <I {...p}><path d="M12 5v14M5 12h14"/></I>,
  Download: (p) => <I {...p}><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></I>,
  Refresh: (p) => <I {...p}><path d="M20 11a8 8 0 10-2.3 5.7M20 20v-5h-5"/></I>,
  Grid: (p) => <I {...p}><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></I>,
  Cols: (p) => <I {...p}><rect x="4" y="4" width="3" height="16" rx="1"/><rect x="10.5" y="4" width="3" height="16" rx="1"/><rect x="17" y="4" width="3" height="16" rx="1"/></I>,
  Rows: (p) => <I {...p}><rect x="4" y="4" width="16" height="3" rx="1"/><rect x="4" y="10.5" width="16" height="3" rx="1"/><rect x="4" y="17" width="16" height="3" rx="1"/></I>,
  More: (p) => <I {...p}><circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/></I>,
  Spark: (p) => <I {...p}><path d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2zM18 14l1 2.3L21 17l-2 1-1 2-1-2-2-1 2-1 1-2z"/></I>,
  Idea: (p) => <I {...p}><path d="M9 18h6M10 22h4M12 2a6 6 0 00-3 11c.6.5 1 1.3 1 2v1h4v-1c0-.7.4-1.5 1-2a6 6 0 00-3-11z"/></I>,
  Eye: (p) => <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></I>,
  X: (p) => <I {...p}><path d="M6 6l12 12M18 6L6 18"/></I>,
  Crown: (p) => <I {...p}><path d="M3 7l4 5 5-7 5 7 4-5v11H3V7z"/></I>,
  Caret: (p) => <I {...p}><path d="M6 9l6 6 6-6"/></I>,
  Doc: (p) => <I {...p}><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M9 13h8M9 17h5"/></I>,
  Bolt: (p) => <I {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></I>,
  Share: (p) => <I {...p}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></I>,
};

Object.assign(window, { I, Icon });
