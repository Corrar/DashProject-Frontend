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
  if(!series.length) return <ChartEmpty width={width} height={height}/>;
  data = series;
  const pad = { l: 36, r: 12, t: 12, b: 22 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  let min = Infinity, max = -Infinity;
  for(const d of data){ if(d.v < min) min = d.v; if(d.v > max) max = d.v; }
  const range = max - min || 1;
  // Um ponto só: centraliza (antes i/(n-1) = 0/0 → NaN e o SVG quebrava).
  const xAt = (i)=> data.length === 1 ? pad.l + W/2 : pad.l + (i/(data.length-1))*W;
  const points = data.map((d,i) => [
    xAt(i),
    pad.t + H - ((d.v - min)/range)*H*0.92 - H*0.04
  ]);
  const path = smoothPath(points);
  const area = `${path} L ${points[points.length-1][0]} ${pad.t+H} L ${points[0][0]} ${pad.t+H} Z`;
  // Muitos pontos: sem bolinhas (centenas de círculos com animação escalonada).
  const showDots = data.length <= 60;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {showAxis && [0,1,2,3,4].map(i=>{
        const y = pad.t + (H/4)*i;
        const v = Math.round(max - (range/4)*i);
        return (
          <g key={i}>
            <line x1={pad.l} x2={width-pad.r} y1={y} y2={y} stroke="#eef0f7" strokeDasharray="3 4"/>
            <text x={pad.l-8} y={y+3} fontSize="10" textAnchor="end" fill="#8c93a6" fontFamily="Geist Mono">{v>=1000?(v/1000).toFixed(0)+"k":v}</text>
          </g>
        );
      })}
      {showAxis && data.map((d,i) => i%Math.ceil(data.length/6)===0 && (
        <text key={i} x={xAt(i)} y={height-6} fontSize="10" textAnchor="middle" fill="#8c93a6" fontFamily="Geist Mono">{d.l}</text>
      ))}
      {fill && <path d={area} fill={`url(#${id})`}/>}
      {/* pathLength=1 normaliza o traço: dispensa medir o path. Estado final é
          o estilo base e a animação só define o início (fill both), então
          "animation: none" (exportação) mostra a linha inteira. */}
      <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" pathLength="1"
        style={animate ? {strokeDasharray: 1, animation: `lineDraw 1.6s ${animDelay}s cubic-bezier(.2,.7,.2,1) both`} : {}}/>
      {(showDots || points.length === 1) && points.map((p,i)=>(
        <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="white" stroke={color} strokeWidth="1.6"
          style={animate ? {animation:`dotIn .3s ${animDelay+1.4 + i*0.04}s both`} : {}}/>
      ))}
      <style>{`@keyframes lineDraw{ from{ stroke-dashoffset: 1; } to{ stroke-dashoffset: 0; } } @keyframes dotIn{ from{ opacity:0; } }`}</style>
    </svg>
  );
}

function BarChart({ data, width=560, height=200, color="#2f6bff", animDelay=0, horizontal=false }){
  if(!data || !data.length) return <ChartEmpty width={width} height={height}/>;
  const pad = { l: 36, r: 12, t: 12, b: 22 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const max = Math.max(...data.map(d=>d.v)) || 1;
  const barW = W / data.length * 0.6;
  const gap = W / data.length * 0.4;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <style>{`@keyframes barGrow{ from{ transform: scaleY(0); } to{ transform: scaleY(1); } }`}</style>
      {[0,1,2,3].map(i=>{
        const y = pad.t + (H/3)*i;
        const v = Math.round(max - (max/3)*i);
        return (
          <g key={i}>
            <line x1={pad.l} x2={width-pad.r} y1={y} y2={y} stroke="#eef0f7" strokeDasharray="3 4"/>
            <text x={pad.l-8} y={y+3} fontSize="10" textAnchor="end" fill="#8c93a6" fontFamily="Geist Mono">{v>=1000?(v/1000).toFixed(0)+"k":v}</text>
          </g>
        );
      })}
      {data.map((d,i)=>{
        const h = (d.v/max)*H;
        const x = pad.l + i*(barW+gap) + gap/2;
        const y = pad.t + H - h;
        const c = d.color || color;
        return (
          <g key={i}>
            {/* Geometria final nos atributos + crescimento por CSS (scaleY).
                Antes era SMIL (<animate>) partindo de height=0: cópias do SVG
                (exportação PNG) perdiam barras que ficavam com altura 0. */}
            <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx="6" fill={c}
              style={{transformBox:"fill-box", transformOrigin:"50% 100%", animation:`barGrow .9s ${animDelay + i*0.06}s cubic-bezier(.2,.7,.2,1) both`}}/>
            <text x={x+barW/2} y={height-6} fontSize="10" textAnchor="middle" fill="#5b6478">{d.l}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ data, size=180, thickness=22, animDelay=0 }){
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
    </svg>
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

Object.assign(window, { LineChart, BarChart, Donut, Sparkline, smoothPath });
