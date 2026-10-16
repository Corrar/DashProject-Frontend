/* Lightweight inline SVG charts. */

// Generate a smooth path from points (Catmull-Rom-ish via cubic beziers).
function smoothPath(points){
  if(points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for(let i=0;i<points.length-1;i++){
    const p0 = points[i-1] || points[i];
    const p1 = points[i];
    const p2 = points[i+1];
    const p3 = points[i+2] || p2;
    const cp1x = p1[0] + (p2[0]-p0[0])/6;
    const cp1y = p1[1] + (p2[1]-p0[1])/6;
    const cp2x = p2[0] - (p3[0]-p1[0])/6;
    const cp2y = p2[1] - (p3[1]-p1[1])/6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// Média por balde para no máximo `max` pontos (CLAUDE.md §6: nunca > 200
// pontos num gráfico inline). O rótulo é o do primeiro ponto do balde.
function chartDownsample(data, max){
  if(!Array.isArray(data) || data.length <= max) return data || [];
  const size = data.length / max, out = [];
  for(let b = 0; b < max; b++){
    const from = Math.floor(b*size), to = Math.max(from+1, Math.floor((b+1)*size));
    const slice = data.slice(from, to);
    out.push({ ...slice[0], v: slice.reduce((s,d)=> s + d.v, 0) / slice.length });
  }
  return out;
}

// Largura real do contêiner: o SVG é desenhado em pixels de verdade (antes um
// viewBox fixo de 560 com preserveAspectRatio="none" esticava texto e pontos).
function useChartWidth(fallback){
  const [w, setW] = React.useState(fallback);
  const roRef = React.useRef(null);
  // Callback ref: também mede quando o gráfico sai do estado vazio depois.
  const ref = React.useCallback((el)=>{
    if(roRef.current){ roRef.current.disconnect(); roRef.current = null; }
    if(!el) return;
    const read = ()=>{ const cw = Math.round(el.getBoundingClientRect().width); if(cw > 0) setW(cw); };
    read();
    if(typeof ResizeObserver !== "undefined"){ roRef.current = new ResizeObserver(read); roRef.current.observe(el); }
  }, []);
  return [ref, w];
}

// Escala "bonita" (passos 1/2/2,5/5 × 10^n) para o eixo Y: sem rótulos repetidos
// como "2k, 2k, 1k" quando a faixa é estreita.
function chartNiceTicks(min, max, count){
  if(!(max > min)){ const v = max || 0; return [v === 0 ? 0 : v * 0.9, v === 0 ? 1 : v * 1.1].map(x => x); }
  const raw = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => st >= raw) || raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = [];
  for(let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step) * step);
  return out;
}

// Rótulo compacto em pt-BR: 1.250 → "1,3 mil", 2.400.000 → "2,4 mi".
function chartFmt(v){
  const a = Math.abs(v);
  const f = (x)=> x.toLocaleString("pt-BR", { maximumFractionDigits: x < 10 ? 1 : 0 });
  if(a >= 1e9) return f(v / 1e9) + " bi";
  if(a >= 1e6) return f(v / 1e6) + " mi";
  if(a >= 1e3) return f(v / 1e3) + " mil";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: a < 10 ? 2 : a < 100 ? 1 : 0 });
}

function chartFmtFull(v){
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 });
}

function ChartEmpty({ width, height }){
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <text x={width/2} y={height/2} fontSize="12" textAnchor="middle" fill="#8c93a6">Sem dados no período</text>
    </svg>
  );
}

function LineChart({ data, width=560, height=200, color="#2f6bff", fill=true, showAxis=true, animate=true, animDelay=0 }){
  const series = React.useMemo(()=> chartDownsample(data, 200), [data]);
  const id = React.useMemo(()=> "g"+Math.random().toString(36).slice(2,8), []);
  const [wrapRef, measured] = useChartWidth(width);
  const [hover, setHover] = React.useState(null);
  if(!series.length) return <ChartEmpty width={width} height={height}/>;
  data = series;
  width = Math.max(120, measured);
  let min = Infinity, max = -Infinity;
  for(const d of data){ if(d.v < min) min = d.v; if(d.v > max) max = d.v; }
  const ticks = chartNiceTicks(Math.min(0, min) === 0 && min >= 0 && min < max * 0.35 ? 0 : min, max, 4);
  const tMin = ticks[0], tMax = ticks[ticks.length - 1];
  const labelW = Math.max(...ticks.map(t => chartFmt(t).length)) * 6.4 + 12;
  const pad = { l: showAxis ? Math.max(30, labelW) : 6, r: 14, t: 12, b: showAxis ? 24 : 6 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const span = (tMax - tMin) || 1;
  // Um ponto só: centraliza (antes i/(n-1) = 0/0 → NaN e o SVG quebrava).
  const xAt = (i)=> data.length === 1 ? pad.l + W/2 : pad.l + (i/(data.length-1))*W;
  const yAt = (v)=> pad.t + H - ((v - tMin)/span)*H;
  const points = data.map((d,i) => [xAt(i), yAt(d.v)]);
  const path = smoothPath(points);
  const area = `${path} L ${points[points.length-1][0]} ${pad.t+H} L ${points[0][0]} ${pad.t+H} Z`;
  // Poucos pontos: bolinhas ajudam a ler. Muitos: só a linha (e o ponto sob o mouse).
  const showDots = data.length <= 24;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(W / 80))));

  const onMove = (e)=>{
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = data.length === 1 ? 0 : Math.round(((x - pad.l) / W) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const hp = hover != null ? points[hover] : null;
  const tipText = hover != null ? chartFmtFull(data[hover].v) : "";
  const tipW = Math.max(64, Math.max(String(data[hover != null ? hover : 0].l || "").length, tipText.length) * 7 + 20);
  const tipX = hp ? Math.min(width - pad.r - tipW, Math.max(pad.l, hp[0] - tipW / 2)) : 0;
  const tipY = hp ? (hp[1] - 52 < 2 ? hp[1] + 12 : hp[1] - 52) : 0;

  return (
    <div ref={wrapRef} style={{width:"100%", position:"relative"}}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display:"block", overflow:"visible", maxWidth:"100%", height:"auto"}}
      onMouseMove={onMove} onMouseLeave={()=> setHover(null)} role="img" aria-label="Gráfico de linha">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {showAxis && ticks.map((t, i)=>{
        const y = yAt(t);
        return (
          <g key={i}>
            <line x1={pad.l} x2={width-pad.r} y1={y} y2={y} stroke={i === 0 ? "#e3e7f1" : "#eef0f7"} strokeDasharray={i === 0 ? "" : "3 4"}/>
            <text x={pad.l-8} y={y+3.5} fontSize="10.5" textAnchor="end" fill="#8c93a6" fontFamily="Geist Mono, monospace">{chartFmt(t)}</text>
          </g>
        );
      })}
      {showAxis && data.map((d,i) => (i % labelEvery === 0) && (
        <text key={i} x={xAt(i)} y={height-6} fontSize="10.5" textAnchor={i === 0 && data.length > 1 ? "start" : "middle"} fill="#8c93a6" fontFamily="Geist Mono, monospace">{d.l}</text>
      ))}
      {fill && <path d={area} fill={`url(#${id})`}/>}
      {/* pathLength=1 normaliza o traço: dispensa medir o path. Estado final é
          o estilo base e a animação só define o início (fill both), então
          "animation: none" (exportação) mostra a linha inteira. */}
      <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength="1"
        style={animate ? {strokeDasharray: 1, animation: `lineDraw 1.6s ${animDelay}s cubic-bezier(.2,.7,.2,1) both`} : {}}/>
      {(showDots || points.length === 1) && points.map((p,i)=>(
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="white" stroke={color} strokeWidth="1.8"
          style={animate ? {animation:`dotIn .3s ${animDelay+1.2 + i*0.03}s both`} : {}}/>
      ))}
      {hp && (
        <g className="no-export" pointerEvents="none">
          <line x1={hp[0]} x2={hp[0]} y1={pad.t} y2={pad.t + H} stroke={color} strokeOpacity=".35" strokeDasharray="3 3"/>
          <circle cx={hp[0]} cy={hp[1]} r="5" fill={color} stroke="white" strokeWidth="2"/>
          <g transform={`translate(${tipX} ${tipY})`}>
            <rect width={tipW} height="40" rx="8" fill="#0b1020" opacity=".92"/>
            <text x="10" y="16" fontSize="10.5" fill="#aab3c7" fontFamily="Geist Mono, monospace">{String(data[hover].l || "")}</text>
            <text x="10" y="31" fontSize="12.5" fontWeight="700" fill="white" fontFamily="Geist, sans-serif">{tipText}</text>
          </g>
        </g>
      )}
      <style>{`@keyframes lineDraw{ from{ stroke-dashoffset: 1; } to{ stroke-dashoffset: 0; } } @keyframes dotIn{ from{ opacity:0; } }`}</style>
    </svg>
    </div>
  );
}

function BarChart({ data, width=560, height=200, color="#2f6bff", animDelay=0, horizontal=false }){
  const [wrapRef, measured] = useChartWidth(width);
  const [hover, setHover] = React.useState(null);
  if(!data || !data.length) return <ChartEmpty width={width} height={height}/>;
  width = Math.max(120, measured);
  const maxV = Math.max(...data.map(d=>d.v), 0);
  const minV = Math.min(...data.map(d=>d.v), 0);
  const ticks = chartNiceTicks(minV, maxV || 1, 3);
  const tMin = ticks[0], tMax = ticks[ticks.length - 1];
  const labelW = Math.max(...ticks.map(t => chartFmt(t).length)) * 6.4 + 12;
  const pad = { l: Math.max(30, labelW), r: 12, t: 14, b: 26 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const span = (tMax - tMin) || 1;
  const yAt = (v)=> pad.t + H - ((v - tMin)/span)*H;
  const slot = W / data.length;
  const barW = Math.min(56, slot * 0.62);
  // Rótulo do eixo X cabe no slot? Senão corta com reticências.
  const maxChars = Math.max(3, Math.floor(slot / 6.2));
  const cut = (l)=>{ const t = String(l); return t.length > maxChars ? t.slice(0, maxChars - 1) + "…" : t; };
  return (
    <div ref={wrapRef} style={{width:"100%"}}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display:"block", overflow:"visible", maxWidth:"100%", height:"auto"}} role="img" aria-label="Gráfico de barras"
      onMouseLeave={()=> setHover(null)}>
      <style>{`@keyframes barGrow{ from{ transform: scaleY(0); } to{ transform: scaleY(1); } }`}</style>
      {ticks.map((t, i)=>{
        const y = yAt(t);
        return (
          <g key={i}>
            <line x1={pad.l} x2={width-pad.r} y1={y} y2={y} stroke={t === 0 ? "#e3e7f1" : "#eef0f7"} strokeDasharray={t === 0 ? "" : "3 4"}/>
            <text x={pad.l-8} y={y+3.5} fontSize="10.5" textAnchor="end" fill="#8c93a6" fontFamily="Geist Mono, monospace">{chartFmt(t)}</text>
          </g>
        );
      })}
      {data.map((d,i)=>{
        const y0 = yAt(0), y1 = yAt(d.v);
        const top = Math.min(y0, y1), h = Math.abs(y0 - y1);
        const x = pad.l + i*slot + (slot - barW)/2;
        const c = d.color || color;
        const on = hover === i;
        return (
          <g key={i} onMouseEnter={()=> setHover(i)}>
            {/* Área de hover do slot inteiro (barra baixa também mostra o valor). */}
            <rect x={pad.l + i*slot} y={pad.t} width={slot} height={H} fill="transparent"/>
            <title>{String(d.l) + ": " + chartFmtFull(d.v)}</title>
            {/* Geometria final nos atributos + crescimento por CSS (scaleY).
                Antes era SMIL (<animate>) partindo de height=0: cópias do SVG
                (exportação PNG) perdiam barras que ficavam com altura 0. */}
            <rect x={x} y={top} width={barW} height={Math.max(0, h)} rx={Math.min(6, barW/4)} fill={c}
              opacity={hover == null || on ? 1 : .45}
              style={{transition:"opacity .15s ease", transformBox:"fill-box", transformOrigin:"50% 100%", animation:`barGrow .9s ${animDelay + i*0.06}s cubic-bezier(.2,.7,.2,1) both`}}/>
            {on && (
              <text className="no-export" x={x + barW/2} y={Math.max(11, top - 6)} fontSize="11" fontWeight="700" textAnchor="middle" fill="#0b1020" fontFamily="Geist, sans-serif">{chartFmt(d.v)}</text>
            )}
            <text x={x+barW/2} y={height-8} fontSize="10.5" textAnchor="middle" fill={on ? "#0b1020" : "#5b6478"}>{cut(d.l)}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

function Donut({ data, size=180, thickness=22, animDelay=0, center=null }){
  // Nome de keyframe por instância: "donut-0" era global, então dois donuts na
  // mesma página sobrescreviam o tamanho dos arcos um do outro.
  const uid = React.useMemo(()=> "d"+Math.random().toString(36).slice(2,8), []);
  data = data || [];
  const total = data.reduce((s,d)=>s+d.v,0) || 1;
  const r = size/2 - thickness/2;
  const C = 2*Math.PI*r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} stroke="#eef0f7" strokeWidth={thickness} fill="none"/>
      {data.map((d,i)=>{
        const frac = d.v/total;
        const dash = C*frac;
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r} stroke={d.color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${dash} ${C-dash}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{
              animation: `donut-${uid}-${i} 1s ${animDelay+i*0.15}s cubic-bezier(.2,.7,.2,1) both`
            }}>
          </circle>
        );
        const styleTag = (
          <style key={"s"+i}>{`@keyframes donut-${uid}-${i}{ from{ stroke-dasharray: 0 ${C}; } to{ stroke-dasharray: ${dash} ${C-dash}; } }`}</style>
        );
        offset += dash;
        return <React.Fragment key={"f"+i}>{styleTag}{el}</React.Fragment>;
      })}
      {center && (
        <g>
          <text x={size/2} y={size/2 - 2} textAnchor="middle" fontSize={Math.round(size/8)} fontWeight="800" fill="#0b1020" fontFamily="Geist, sans-serif">{center.value}</text>
          <text x={size/2} y={size/2 + Math.round(size/11)} textAnchor="middle" fontSize="10.5" fill="#8c93a6" fontFamily="Geist, sans-serif">{center.label}</text>
        </g>
      )}
    </svg>
  );
}

// Donut + legenda (rótulo, valor e %). Sem legenda o donut não diz nada:
// eram só fatias coloridas sem nome.
const DONUT_PALETTE = ["#2f6bff","#7a5cff","#0a8a4a","#ff7849","#ff5e93","#94b7ff","#1b2240"];
function DonutLegend({ data, height=240, color, unit }){
  const items = (data || []).filter(d => d && d.v > 0);
  if(!items.length) return <ChartEmpty width={300} height={height}/>;
  const total = items.reduce((s,d)=> s + d.v, 0) || 1;
  const colored = items.map((d,i)=> ({ ...d, color: d.color || (i === 0 && color ? color : DONUT_PALETTE[i % DONUT_PALETTE.length]) }));
  const size = Math.max(120, Math.min(height - 30, 190));
  const isPct = unit === "%";
  return (
    <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:22, flexWrap:"wrap", minHeight:height, padding:"6px 0"}}>
      <Donut data={colored} size={size} thickness={Math.round(size/8)}
        center={{ value: isPct ? colored.length : chartFmt(total), label: isPct ? (colored.length === 1 ? "item" : "itens") : "total" }}/>
      <ul style={{listStyle:"none", margin:0, padding:0, display:"flex", flexDirection:"column", gap:8, minWidth:140, flex:"1 1 140px", maxWidth:260}}>
        {colored.slice(0, 7).map((d,i)=>{
          const pct = isPct ? d.v : (d.v / total) * 100;
          return (
            <li key={i} style={{display:"flex", alignItems:"center", gap:8, fontSize:12.5}}>
              <span style={{width:10, height:10, borderRadius:3, background:d.color, flexShrink:0}}/>
              <span style={{flex:1, minWidth:0, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}} title={String(d.l)}>{String(d.l)}</span>
              {!isPct && <span className="mono" style={{fontSize:11.5, color:"var(--muted)"}}>{chartFmt(d.v)}</span>}
              <span className="mono" style={{fontSize:11.5, fontWeight:700, color:"var(--ink)", minWidth:38, textAlign:"right"}}>{pct.toLocaleString("pt-BR", {maximumFractionDigits: pct < 10 ? 1 : 0})}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Sparkline({ data, color="#2f6bff", width=120, height=36, fill=true }){
  const id = React.useMemo(()=>"sp"+Math.random().toString(36).slice(2,8),[]);
  // Série diária longa (2 anos ≈ 730 pontos) não cabe em 160px: reduz a 80.
  const vals = chartDownsample((data || []).map(v => ({ v })), 80).map(d => d.v);
  if(vals.length < 2) return <svg width={width} height={height}/>;
  let min = Infinity, max = -Infinity;
  for(const v of vals){ if(v < min) min = v; if(v > max) max = v; }
  const range = max-min || 1;
  const pts = vals.map((v,i)=>[i/(vals.length-1)*width, height - ((v-min)/range)*height*0.85 - height*0.075]);
  const path = smoothPath(pts);
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`}/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

Object.assign(window, { LineChart, BarChart, Donut, DonutLegend, Sparkline, smoothPath, chartFmt, chartNiceTicks });
