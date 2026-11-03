/* Ícones SVG inline no estilo dos símbolos de sistema: traço fino e uniforme,
 * pontas e junções arredondadas, formas geométricas. Desenhados aqui (nada
 * copiado). Ícones "…Fill" são as versões preenchidas para a aba ativa da
 * barra inferior. Lista canônica em CLAUDE.md §23. */
const I = ({ children, size = 18, stroke = 1.6, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
);
// Versão preenchida: mesmo viewBox, sem traço.
const IF = ({ children, size = 18, stroke, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>{children}</svg>
);

const Icon = {
  Logo: (p) => (
    <svg width={p.size||28} height={p.size||28} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="url(#lg1)"/>
      <rect width="28" height="14" rx="8" fill="url(#lg2)"/>
      <rect x="7" y="14" width="3" height="8" rx="1.5" fill="white" opacity=".9"/>
      <rect x="12.5" y="9" width="3" height="13" rx="1.5" fill="white"/>
      <rect x="18" y="11.5" width="3" height="10.5" rx="1.5" fill="white" opacity=".85"/>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#2997ff"/>
          <stop offset="1" stopColor="#0062c4"/>
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="14">
          <stop stopColor="white" stopOpacity=".22"/>
          <stop offset="1" stopColor="white" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  // "Brilhos": estrela grande + duas pequenas (símbolo da IA).
  Sparkle: (p) => <I {...p}><path d="M10 4.5c.5 3.4 2.1 5 5.5 5.5-3.4.5-5 2.1-5.5 5.5-.5-3.4-2.1-5-5.5-5.5 3.4-.5 5-2.1 5.5-5.5z"/><path d="M17.5 3v3M16 4.5h3M18 15.5c.25 1.6 1 2.35 2.5 2.5-1.5.25-2.25 1-2.5 2.5-.25-1.5-1-2.25-2.5-2.5 1.5-.15 2.25-.9 2.5-2.5z"/></I>,
  Wand: (p) => <I {...p}><path d="M4.5 19.5l10-10"/><rect x="13.2" y="6.3" width="4" height="4" rx="1" transform="rotate(45 15.2 8.3)"/><path d="M19 3.5v2M18 4.5h2M20 10v1.6M19.2 10.8h1.6M10 3.5v1.6M9.2 4.3h1.6"/></I>,
  Upload: (p) => <I {...p}><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 13v4.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V13"/></I>,
  Chart: (p) => <I {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 15.5v-3M12 15.5v-7M16 15.5v-5"/></I>,
  ChartFill: (p) => <IF {...p}><path fillRule="evenodd" d="M8 3h8a5 5 0 015 5v8a5 5 0 01-5 5H8a5 5 0 01-5-5V8a5 5 0 015-5zm0 8.5a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm4-4a1 1 0 00-1 1v7a1 1 0 102 0v-7a1 1 0 00-1-1zm4 2a1 1 0 00-1 1v5a1 1 0 102 0v-5a1 1 0 00-1-1z"/></IF>,
  Bars: (p) => <I {...p}><path d="M5 20v-8M10 20V5M15 20v-6M20 20V9"/></I>,
  Line: (p) => <I {...p}><path d="M3.5 17l5-5.5 4 3 8-8.5"/><path d="M15.5 6h5v5"/></I>,
  Pie: (p) => <I {...p}><path d="M20.5 13A8.5 8.5 0 1111 3.5"/><path d="M14 3.2A7 7 0 0120.8 10H14z"/></I>,
  Lock: (p) => <I {...p}><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V7.5a3.5 3.5 0 017 0v3"/></I>,
  Check: (p) => <I {...p}><path d="M5 12.5l4.5 4.5L19 7"/></I>,
  Arrow: (p) => <I {...p}><path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5"/></I>,
  Chevron: (p) => <I {...p}><path d="M9.5 5.5L16 12l-6.5 6.5"/></I>,
  Play: (p) => <I {...p}><path d="M8 5.5v13a1 1 0 001.5.85l10.5-6.5a1 1 0 000-1.7L9.5 4.65A1 1 0 008 5.5z" fill="currentColor"/></I>,
  Filter: (p) => <I {...p}><path d="M4 6.5h16M7 12h10M10 17.5h4"/></I>,
  Plus: (p) => <I {...p}><path d="M12 5v14M5 12h14"/></I>,
  Download: (p) => <I {...p}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 15v2.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V15"/></I>,
  Refresh: (p) => <I {...p}><path d="M19.5 12a7.5 7.5 0 11-2.2-5.3"/><path d="M19.5 4v4h-4"/></I>,
  Clock: (p) => <I {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></I>,
  Grid: (p) => <I {...p}><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></I>,
  GridFill: (p) => <IF {...p}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2.2"/></IF>,
  Home: (p) => <I {...p}><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 01-1.5 1.5H15v-5.5h-6v5.5H5.5A1.5 1.5 0 014 19z"/></I>,
  HomeFill: (p) => <IF {...p}><path d="M11.37 3.22a1 1 0 011.26 0l8 6.5c.24.19.37.47.37.78V19a2.5 2.5 0 01-2.5 2.5H15.5a.5.5 0 01-.5-.5v-5.5a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5V21a.5.5 0 01-.5.5H5.5A2.5 2.5 0 013 19v-8.5c0-.3.13-.59.37-.78z"/></IF>,
  Cols: (p) => <I {...p}><rect x="4" y="4" width="3.5" height="16" rx="1.5"/><rect x="10.25" y="4" width="3.5" height="16" rx="1.5"/><rect x="16.5" y="4" width="3.5" height="16" rx="1.5"/></I>,
  Rows: (p) => <I {...p}><rect x="4" y="4" width="16" height="3.5" rx="1.5"/><rect x="4" y="10.25" width="16" height="3.5" rx="1.5"/><rect x="4" y="16.5" width="16" height="3.5" rx="1.5"/></I>,
  More: (p) => <I {...p}><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/></I>,
  Spark: (p) => <I {...p}><path d="M12 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7z"/></I>,
  Idea: (p) => <I {...p}><path d="M9.5 17.5h5M10.5 21h3"/><path d="M12 3a6 6 0 00-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0012 3z"/></I>,
  Eye: (p) => <I {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></I>,
  X: (p) => <I {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></I>,
  Crown: (p) => <I {...p}><path d="M4 8l4 4 4-6.5 4 6.5 4-4-1.5 10h-13z"/><path d="M6 20.5h12"/></I>,
  CrownFill: (p) => <IF {...p}><path d="M12.85 4.97l3.37 5.47 3.07-3.07a1 1 0 011.7.85l-1.5 10A1 1 0 0118.5 19h-13a1 1 0 01-.99-.85l-1.5-10a1 1 0 011.7-.85l3.07 3.07 3.37-5.47a1 1 0 011.7 0z"/><rect x="5" y="20" width="14" height="1.8" rx=".9"/></IF>,
  Caret: (p) => <I {...p}><path d="M6.5 9.5L12 15l5.5-5.5"/></I>,
  Doc: (p) => <I {...p}><path d="M14 3.5H8A2.5 2.5 0 005.5 6v12A2.5 2.5 0 008 20.5h8a2.5 2.5 0 002.5-2.5V8z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4"/></I>,
  Bolt: (p) => <I {...p}><path d="M13.5 3L5.5 13.5h6l-1 7.5 8-10.5h-6z"/></I>,
  Share: (p) => <I {...p}><path d="M12 14V3.5M8 7.5l4-4 4 4"/><path d="M8.5 10.5H7A2 2 0 005 12.5v6A2 2 0 007 20.5h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1.5"/></I>,
  User: (p) => <I {...p}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/></I>,
  UserFill: (p) => <IF {...p}><path fillRule="evenodd" d="M12 2.75a9.25 9.25 0 110 18.5 9.25 9.25 0 010-18.5zm0 3.5a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5zm0 9c-2.6 0-4.75 1.15-6.1 3.1A8.2 8.2 0 0012 20.75a8.2 8.2 0 006.1-2.4c-1.35-1.95-3.5-3.1-6.1-3.1z"/></IF>,
  Gear: (p) => <I {...p}><circle cx="12" cy="12" r="3"/><path d="M12 3.5l1.4 2.1 2.5-.5.6 2.5 2.4.9-.6 2.5 1.7 1.9-1.7 1.9.6 2.5-2.4.9-.6 2.5-2.5-.5L12 20.5l-1.4-2.1-2.5.5-.6-2.5-2.4-.9.6-2.5L4 11.1l1.7-1.9-.6-2.5 2.4-.9.6-2.5 2.5.5z"/></I>,
  Search: (p) => <I {...p}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></I>,
};

/* Ícone em ladrilho colorido (listas de Ajustes): quadrado de cantos
 * arredondados com degradê leve e o símbolo em branco. */
function IconTile({ color = "var(--brand)", size = 28, children }){
  return (
    <span aria-hidden="true" style={{
      width:size, height:size, borderRadius: Math.round(size * 0.26), flexShrink:0,
      background:`linear-gradient(180deg, color-mix(in oklch, ${color} 82%, white), ${color})`,
      color:"white", display:"inline-flex", alignItems:"center", justifyContent:"center",
      boxShadow:"0 .5px 1px rgba(0,0,0,.12), inset 0 .5px 0 rgba(255,255,255,.25)",
    }}>{children}</span>
  );
}

Object.assign(window, { I, IF, Icon, IconTile });
