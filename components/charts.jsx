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

function LineChart({ data, width=560, height=200, color="#2f6bff", fill=true, showAxis=true, animate=true, animDelay=0 }){
  const pad = { l: 36, r: 12, t: 12, b: 22 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const min = Math.min(...data.map(d=>d.v));
  const max = Math.max(...data.map(d=>d.v));
  const range = max - min || 1;
  const points = data.map((d,i) => [
    pad.l + (i/(data.length-1))*W,
    pad.t + H - ((d.v - min)/range)*H*0.92 - H*0.04
  ]);
  const path = smoothPath(points);
  const area = `${path} L ${points[points.length-1][0]} ${pad.t+H} L ${points[0][0]} ${pad.t+H} Z`;
  const id = React.useMemo(()=> "g"+Math.random().toString(36).slice(2,8), []);
  const pathRef = React.useRef(null);
  const [len, setLen] = React.useState(0);
  React.useEffect(()=>{
    if(pathRef.current){ setLen(pathRef.current.getTotalLength()); }
  }, [data]);

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
        <text key={i} x={pad.l + (i/(data.length-1))*W} y={height-6} fontSize="10" textAnchor="middle" fill="#8c93a6" fontFamily="Geist Mono">{d.l}</text>
      ))}
      {fill && <path d={area} fill={`url(#${id})`}/>}
      <path ref={pathRef} d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"
        style={animate && len ? {strokeDasharray: len, strokeDashoffset: len, animation: `dash 1.6s ${animDelay}s cubic-bezier(.2,.7,.2,1) forwards`} : {}}/>
      {points.map((p,i)=>(
        <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="white" stroke={color} strokeWidth="1.6"
          style={animate ? {opacity:0, animation:`fadein .3s ${animDelay+1.4 + i*0.04}s forwards`} : {}}/>
      ))}
      <style>{`@keyframes dash{ to{ stroke-dashoffset: 0; } } @keyframes fadein{ to{ opacity:1; } }`}</style>
    </svg>
  );
}

function BarChart({ data, width=560, height=200, color="#2f6bff", animDelay=0, horizontal=false }){
  const pad = { l: 36, r: 12, t: 12, b: 22 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const max = Math.max(...data.map(d=>d.v));
  const barW = W / data.length * 0.6;
  const gap = W / data.length * 0.4;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
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
            <rect x={x} y={pad.t+H} width={barW} height={0} rx="6" fill={c}
              style={{animation: `grow .9s ${animDelay + i*0.06}s cubic-bezier(.2,.7,.2,1) forwards`}}>
              <animate attributeName="height" from="0" to={h} dur=".9s" begin={`${animDelay + i*0.06}s`} fill="freeze"/>
              <animate attributeName="y" from={pad.t+H} to={y} dur=".9s" begin={`${animDelay + i*0.06}s`} fill="freeze"/>
            </rect>
            <text x={x+barW/2} y={height-6} fontSize="10" textAnchor="middle" fill="#5b6478">{d.l}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ data, size=180, thickness=22, animDelay=0 }){
  const total = data.reduce((s,d)=>s+d.v,0);
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
              strokeDasharray: `0 ${C}`,
              animation: `donut-${i} 1s ${animDelay+i*0.15}s cubic-bezier(.2,.7,.2,1) forwards`
            }}>
          </circle>
        );
        const styleTag = (
          <style key={"s"+i}>{`@keyframes donut-${i}{ to{ stroke-dasharray: ${dash} ${C-dash}; } }`}</style>
        );
        offset += dash;
        return <React.Fragment key={"f"+i}>{styleTag}{el}</React.Fragment>;
      })}
    </svg>
  );
}

function Sparkline({ data, color="#2f6bff", width=120, height=36, fill=true }){
  const min = Math.min(...data), max = Math.max(...data);
  const range = max-min || 1;
  const pts = data.map((v,i)=>[i/(data.length-1)*width, height - ((v-min)/range)*height*0.85 - height*0.075]);
  const path = smoothPath(pts);
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  const id = React.useMemo(()=>"sp"+Math.random().toString(36).slice(2,8),[]);
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
