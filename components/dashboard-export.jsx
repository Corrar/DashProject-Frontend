/* Exportação do dashboard — PDF e PNG.
 *
 * O arquivo reproduz o dashboard REAL (o nó #dash-export-root do Dashboard),
 * não a miniatura da prévia:
 *   - PDF: impressão do navegador com @page do tamanho escolhido ("Salvar como
 *     PDF"). Vetorial, texto selecionável, sem lib.
 *   - PNG: html-to-image, baixado só no primeiro uso (como o SheetJS). Ele
 *     renderiza pelo próprio navegador (SVG foreignObject), então color-mix,
 *     gradientes e os gráficos SVG saem iguais à tela.
 * Durante a exportação o <body> recebe `dash-exporting` (+ `export-no-ai`,
 * `export-no-brand`); as regras ficam no <style> global do index.html.
 * ⚠️ CSP (CLAUDE.md §8): html-to-image vem do unpkg, já previsto na allowlist.
 */

let _htiLoad = null;
function dashEnsureHtmlToImage(){
  if(window.htmlToImage) return Promise.resolve(window.htmlToImage);
  if(_htiLoad) return _htiLoad;
  _htiLoad = new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = "https://unpkg.com/html-to-image@1.11.11/dist/html-to-image.js";
    s.integrity = "sha384-UbfRVKN3/elS1r7JcK2FhmPP+KlJ4CvYwbyYD7tH+uTkbT9bNJr9eJeQ0FoFbAgz";
    s.crossOrigin = "anonymous";
    s.onload = ()=> window.htmlToImage ? resolve(window.htmlToImage) : reject(new Error("html-to-image ausente"));
    s.onerror = ()=>{ _htiLoad = null; reject(new Error("Falha ao carregar html-to-image")); };
    document.head.appendChild(s);
  });
  return _htiLoad;
}

const dashSleep = (ms)=> new Promise(r => setTimeout(r, ms));

// "vendas_q3.csv" → "dash-vendas_q3-2026-10-15" (nome do arquivo baixado / título do PDF).
function dashExportFilename(fileInfo){
  const base = String((fileInfo && fileInfo.name) || "dashboard").replace(/\.[^.]+$/, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "dashboard";
  const d = new Date();
  const ymd = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  return "dash-" + base + "-" + ymd;
}

// Valor do KPI como aparece no card (sem a animação de contagem).
function dashKpiText(k){
  const v = k && k.value;
  if(typeof v === "string"){
    if(!/\d/.test(v) || !k.suffix || v.endsWith(k.suffix)) return v; // texto ("Segunda") ou sufixo já presente
    return v + k.suffix;
  }
  if(typeof v !== "number" || !Number.isFinite(v)) return "—";
  if(k.format === "brl"){
    const a = Math.abs(v);
    if(a >= 1e6) return "R$ " + (v/1e6).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "M";
    if(a >= 1e3) return "R$ " + (v/1e3).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "k";
    return "R$ " + Math.round(v).toLocaleString("pt-BR");
  }
  if(k.format === "pct") return v.toLocaleString("pt-BR", {maximumFractionDigits:1}) + (k.suffix || "%");
  if(k.format === "scale") return v.toLocaleString("pt-BR", {maximumFractionDigits:1}) + (k.suffix || "");
  return Math.round(v).toLocaleString("pt-BR") + (k.suffix || "");
}

/* Liga o modo exportação e garante que tudo está desenhado: gráficos e KPIs
 * só renderizam quando entram na tela (IntersectionObserver), então a página é
 * percorrida antes da captura. Devolve o nó raiz e a função de limpeza. */
async function dashPrepareExport({ includeAI, branding }){
  const root = document.getElementById("dash-export-root");
  if(!root) throw new Error("Dashboard não encontrado.");
  const cls = document.body.classList;
  cls.add("dash-exporting");
  cls.toggle("export-no-ai", !includeAI);
  cls.toggle("export-no-brand", !branding);
  const y0 = window.scrollY;
  const step = Math.max(240, Math.round(window.innerHeight * 0.6));
  for(let y = 0; y < document.documentElement.scrollHeight; y += step){
    window.scrollTo(0, y);
    await dashSleep(60);
  }
  window.scrollTo(0, y0);
  // Contagem dos KPIs (1,4s) + barras SVG (0,9s + escalonamento).
  await dashSleep(1700);
  const cleanup = ()=>{ cls.remove("dash-exporting", "export-no-ai", "export-no-brand"); };
  return { root, cleanup };
}

async function dashExportPNG(opts, fileInfo){
  const hti = await dashEnsureHtmlToImage();
  const { root, cleanup } = await dashPrepareExport(opts);
  try {
    const base = { pixelRatio: 2, backgroundColor: "#f6f7fb", cacheBust: false };
    let url;
    try { url = await hti.toPng(root, base); }
    // Embutir a Geist exige ler a folha do Google Fonts; se o navegador
    // bloquear, sai com a fonte do sistema em vez de falhar.
    catch(e){ url = await hti.toPng(root, { ...base, skipFonts: true }); }
    const a = document.createElement("a");
    a.href = url;
    a.download = dashExportFilename(fileInfo) + ".png";
    document.body.appendChild(a); a.click(); a.remove();
  } finally {
    cleanup();
  }
}

async function dashExportPDF(opts, fileInfo){
  const { cleanup } = await dashPrepareExport(opts);
  const size = opts.paper === "wide" ? "297mm 167mm"
    : (opts.paper === "letter" ? "letter " : "A4 ") + (opts.orient === "landscape" ? "landscape" : "portrait");
  const page = document.createElement("style");
  page.id = "dash-page-size";
  page.textContent = `@page { size: ${size}; margin: 10mm; }`;
  document.head.appendChild(page);
  // O Chrome usa o título da página como nome sugerido do PDF.
  const prevTitle = document.title;
  document.title = dashExportFilename(fileInfo);
  let done = false;
  const finish = ()=>{
    if(done) return; done = true;
    page.remove(); document.title = prevTitle; cleanup();
  };
  window.addEventListener("afterprint", finish, { once: true });
  window.print();
  // Navegadores em que print() não bloqueia nem dispara afterprint.
  setTimeout(finish, 60000);
}

function ExportModal({ onClose, blocks, tweaks, fileInfo, meta, canExport, canRemoveBranding, hasAI, onLocked }){
  const [format, setFormat] = React.useState("pdf"); // pdf, png
  const [paper, setPaper] = React.useState("a4"); // a4, letter, wide
  // Dashboard é largo: paisagem aproveita melhor a folha.
  const [orient, setOrient] = React.useState("landscape");
  const [opts, setOpts] = React.useState({ ai: !!hasAI, branding: true });
  const [busy, setBusy] = React.useState(false);
  // Sem "remover marca" no plano, a marca fica sempre.
  const branding = canRemoveBranding ? opts.branding : true;
  const includeAI = !!hasAI && opts.ai;

  const visibleBlocks = blocks.filter(b => b.kind !== "cta" && (b.kind !== "insights" || includeAI));
  const charts = blocks.filter(b => b.kind === "chart");
  const kpis = blocks.filter(b => b.kind === "kpi");

  const paperSizes = {
    a4: { p:[2480, 3508], n:"A4" },
    letter: { p:[2550, 3300], n:"Carta" },
    wide: { p:[2880, 1620], n:"Apresentação 16:9" },
  };
  const sz = paperSizes[paper].p;
  const [pw, ph] = (orient==="portrait" || paper==="wide") ? sz : [sz[1], sz[0]];
  const ratio = pw/ph;

  // Preview page dimensions
  const previewW = paper === "wide" ? 720 : (orient==="portrait" ? 500 : 700);
  const previewH = previewW / ratio;
  const pad = paper === "wide" ? 22 : 18;
  const contentW = previewW - pad*2;
  const today = new Date().toLocaleDateString("pt-BR");

  React.useEffect(()=>{
    const onKey = e=>{ if(e.key==="Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return ()=>{ window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [busy]);

  const togOpt = (k)=> setOpts(o=>({...o, [k]:!o[k]}));

  const run = async ()=>{
    if(!canExport){ onLocked && onLocked(); return; }
    if(busy) return;
    setBusy(true);
    // A captura é da página: o modal sai da frente (e libera o scroll) antes.
    document.body.style.overflow = "";
    const params = { includeAI, branding, paper, orient };
    const close = onClose;
    close();
    try {
      if(format === "png") await dashExportPNG(params, fileInfo);
      else await dashExportPDF(params, fileInfo);
    } catch(e){
      window.alert(format === "png"
        ? "Não foi possível gerar o PNG agora. Verifique sua conexão e tente de novo, ou exporte em PDF."
        : "Não foi possível preparar o PDF. Tente novamente.");
    }
  };

  const optRows = [
    { k:"ai", n:"Análise da IA", disabled: !hasAI, hint: !hasAI ? "gere a análise no dashboard antes" : null, checked: includeAI },
    { k:"branding", n:"Marca do Dash no rodapé", disabled: !canRemoveBranding, hint: !canRemoveBranding ? "remover a marca é do plano Pro" : null, checked: branding },
  ];

  return (
    <div onClick={()=> !busy && onClose()} style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(11,16,32,.5)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
      animation:"fade .2s ease"
    }}>
      <style>{`@keyframes fade{ from{ opacity:0 } } @keyframes pop{ from{ opacity:0; transform: translateY(8px) scale(.98); } }`}</style>
      <div className="export-modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Exportar dashboard" style={{
        width:"min(1240px, 100%)", maxHeight:"94vh", background:"white", borderRadius:18,
        boxShadow:"0 40px 80px -20px rgba(11,16,32,.5)",
        display:"grid", gridTemplateColumns:"320px minmax(0, 1fr)", overflow:"hidden",
        animation:"pop .3s cubic-bezier(.2,.7,.2,1)"
      }}>
        {/* Sidebar */}
        <div style={{padding:24, borderRight:"1px solid var(--line)", background:"#fafbfe", display:"flex", flexDirection:"column", gap:20, overflowY:"auto"}}>
          <div>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <h2 style={{margin:0, fontSize:18, fontWeight:800, letterSpacing:"-.01em"}}>Exportar</h2>
              <button onClick={onClose} className="icon-btn" style={{width:28, height:28}} aria-label="Fechar"><Icon.X size={14}/></button>
            </div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>O arquivo reproduz o dashboard como está na tela.</div>
          </div>

          <div>
            <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>FORMATO</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              {[
                {k:"pdf", n:"PDF", d:"Texto selecionável, ideal para imprimir"},
                {k:"png", n:"PNG", d:"Imagem em alta resolução (2×)"},
              ].map(o=>(
                <button key={o.k} onClick={()=>setFormat(o.k)} style={{
                  padding:"12px 12px", borderRadius:10, textAlign:"left", cursor:"pointer",
                  border: format===o.k ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                  background: format===o.k ? "var(--brand-soft)" : "white"
                }}>
                  <div style={{fontWeight:700, fontSize:13, color: format===o.k ? "var(--brand-2)" : "var(--ink)"}}>{o.n}</div>
                  <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{o.d}</div>
                </button>
              ))}
            </div>
          </div>

          {format === "pdf" && (
            <div>
              <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>TAMANHO</div>
              <div style={{display:"flex", flexDirection:"column", gap:6}}>
                {[
                  {k:"a4", n:"A4", d:"210 × 297 mm"},
                  {k:"letter", n:"Carta US", d:"216 × 279 mm"},
                  {k:"wide", n:"Apresentação", d:"16:9 widescreen"},
                ].map(o=>(
                  <label key={o.k} style={{
                    display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, cursor:"pointer",
                    background: paper===o.k ? "white" : "transparent", border: paper===o.k ? "1px solid var(--brand)" : "1px solid transparent"
                  }}>
                    <input type="radio" name="paper" checked={paper===o.k} onChange={()=>setPaper(o.k)} style={{accentColor:"var(--brand)"}}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600, fontSize:13}}>{o.n}</div>
                      <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>{o.d}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {format === "pdf" && paper !== "wide" && (
            <div>
              <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>ORIENTAÇÃO</div>
              <div className="seg" style={{padding:3, background:"var(--line-2)"}}>
                <button onClick={()=>setOrient("portrait")} className={orient==="portrait"?"on":""}>Retrato</button>
                <button onClick={()=>setOrient("landscape")} className={orient==="landscape"?"on":""}>Paisagem</button>
              </div>
            </div>
          )}

          <div>
            <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>INCLUIR</div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {optRows.map(o=>(
                <label key={o.k} style={{display:"flex", alignItems:"flex-start", gap:10, padding:"6px 4px", cursor: o.disabled ? "default" : "pointer", opacity: o.disabled ? .65 : 1}}>
                  <input type="checkbox" checked={o.checked} disabled={o.disabled} onChange={()=>togOpt(o.k)} style={{accentColor:"var(--brand)", marginTop:2}}/>
                  <span style={{fontSize:13}}>
                    {o.n}
                    {o.hint && <span style={{display:"block", fontSize:11, color:"var(--muted)"}}>{o.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{marginTop:"auto", paddingTop:16, borderTop:"1px solid var(--line)"}}>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--muted)", marginBottom:8}}>
              <span>Blocos</span>
              <span className="mono">{kpis.length} KPI · {charts.length} gráficos</span>
            </div>
            {format === "pdf" && canExport && (
              <div style={{fontSize:11, color:"var(--muted)", lineHeight:1.45, marginBottom:8}}>
                Na janela de impressão, escolha <b>Salvar como PDF</b> como destino.
              </div>
            )}
            <button className="btn btn-primary" onClick={run} disabled={busy}
              style={{width:"100%", justifyContent:"center", padding:"12px", opacity: busy ? .7 : 1}}>
              {canExport ? <Icon.Download size={14}/> : <Icon.Lock size={14}/>}
              {busy ? " Preparando…" : canExport ? ` Baixar ${format.toUpperCase()}` : " Exportar nos planos pagos"}
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{width:"100%", justifyContent:"center", marginTop:8, padding:"10px"}}>Cancelar</button>
          </div>
        </div>

        {/* Preview */}
        <div style={{padding:28, overflowY:"auto", background:"#eef0f7", display:"flex", flexDirection:"column", alignItems:"center", gap:14}}>
          <div style={{display:"flex", justifyContent:"space-between", width:"100%", alignItems:"center", maxWidth: previewW}}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <span className="chip" style={{background:"white", border:"1px solid var(--line)"}}><Icon.Eye size={11}/> Prévia do layout</span>
              {format === "pdf" && <span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{paperSizes[paper].n} · {paper === "wide" ? "16:9" : orient==="portrait" ? "retrato" : "paisagem"}</span>}
            </div>
          </div>
          <div style={{
            background:"white", boxShadow:"0 30px 60px -30px rgba(11,16,32,.4)",
            width: previewW, maxWidth:"100%", height: previewH, padding: pad, overflow:"hidden",
            display:"flex", flexDirection:"column", gap: 8,
          }}>
            {/* Header */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", paddingBottom:8, borderBottom:"1px solid var(--line-2)"}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:8, color:"var(--muted)", letterSpacing:".08em", fontWeight:600, textTransform:"uppercase"}} className="mono">{(meta && meta.title) || "Dashboard"}</div>
                <div style={{fontWeight:800, fontSize:14, letterSpacing:"-.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{(fileInfo && fileInfo.name) || "dashboard"}</div>
              </div>
              <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2, flexShrink:0}}>
                <span className="mono" style={{fontSize:8, color:"var(--muted)"}}>{(meta && meta.period) || ""}{meta && meta.rows ? " · " + meta.rows : ""}</span>
                <span className="mono" style={{fontSize:8, color:"var(--muted)"}}>exportado em {today}</span>
              </div>
            </div>

            {/* Block grid — mirrors the dashboard */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(12, minmax(0, 1fr))", gap:5, flex:1, minHeight:0, overflow:"hidden", alignContent:"start"}}>
              {visibleBlocks.map(b => (
                <div key={b.id} style={{gridColumn:`span ${Math.min(12, b.span)}`, minHeight: 0}}>
                  <MiniBlock block={b} accent={tweaks.accent} contentW={contentW} aiSummary={meta && meta.aiSummary}/>
                </div>
              ))}
            </div>

            {branding && (
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:5, borderTop:"1px solid var(--line-2)", fontSize:7.5, color:"var(--muted)", flexShrink:0}}>
                <span style={{display:"inline-flex", alignItems:"center", gap:4}}><Icon.Logo size={10}/> Gerado com {tweaks.brandName} · dashboards com IA</span>
              </div>
            )}
          </div>
          <div className="mono" style={{fontSize:11, color:"var(--muted)", textAlign:"center"}}>
            Os blocos seguem a mesma ordem e proporção do dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniBlock({ block, accent, contentW, aiSummary }){
  if(block.kind === "kpi"){
    const k = block.props || {};
    return (
      <div style={{
        padding:"5px 7px", border:"1px solid var(--line)", borderRadius:5, background:"white",
        height:"100%", display:"flex", flexDirection:"column", justifyContent:"space-between", overflow:"hidden"
      }}>
        <div style={{display:"flex", alignItems:"center", gap:3}}>
          <span style={{width:5, height:5, borderRadius:"50%", background:k.color, flexShrink:0}}/>
          <span style={{fontSize:7, color:"var(--muted)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{k.label}</span>
        </div>
        <div style={{display:"flex", alignItems:"baseline", gap:3, flexWrap:"nowrap"}}>
          <span style={{fontWeight:800, fontSize:13, color:"var(--ink)", letterSpacing:"-.02em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{dashKpiText(k)}</span>
          <span style={{fontSize:7, fontWeight:700, color: k.deltaDir==="up"?"#0a8a4a":"#c9234a", flexShrink:0}}>{k.deltaDir==="up"?"▲":"▼"} {k.delta}</span>
        </div>
        <div style={{fontSize:6.5, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{k.sub}</div>
        <div style={{marginTop:2}}>
          <Sparkline data={k.data || []} color={k.color} width={Math.max(80, Math.round(contentW*(block.span/12)))} height={18} fill={true}/>
        </div>
      </div>
    );
  }
  if(block.kind === "chart"){
    const c = block.props || {};
    const cardW = Math.round(contentW * (block.span/12));
    const chartH = block.span >= 8 ? 70 : block.span >= 6 ? 64 : 56;
    return (
      <div style={{
        padding:"5px 7px", border:"1px solid var(--line)", borderRadius:5, background:"white",
        height:"100%", display:"flex", flexDirection:"column", gap:3, overflow:"hidden"
      }}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <span style={{width:5, height:5, borderRadius:"50%", background:c.color || accent, flexShrink:0}}/>
          <div style={{fontSize:8, fontWeight:700, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1}}>{c.title}</div>
          <span style={{fontSize:7, color:"var(--muted)", fontFamily:"'Geist Mono', monospace", flexShrink:0}}>{c.dim}</span>
        </div>
        <div style={{fontSize:7, color:"var(--muted)", marginBottom:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.sub}</div>
        <div style={{flex:1, minHeight: chartH}}>
          <MiniChart chart={c} color={c.color || accent} width={cardW-14} height={chartH}/>
        </div>
      </div>
    );
  }
  if(block.kind === "insights"){
    // Só entra na prévia quando a análise da IA foi gerada: mostra o começo
    // do resumo real (antes eram 4 insights de exemplo fixos).
    return (
      <div style={{
        padding:"6px 8px", background:"linear-gradient(135deg, var(--brand-soft), white)",
        border:"1px solid var(--brand-soft)", borderRadius:5, height:"100%", overflow:"hidden",
        display:"flex", flexDirection:"column", gap:3
      }}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <Icon.Sparkle size={9} color="var(--brand)"/>
          <span className="mono" style={{fontSize:7.5, fontWeight:700, color:"var(--brand-2)"}}>ANÁLISE POR IA</span>
        </div>
        <div style={{fontSize:7.5, lineHeight:1.45, color:"var(--ink-2)", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:4, WebkitBoxOrient:"vertical"}}>
          {aiSummary || "Resumo gerado pela IA."}
        </div>
      </div>
    );
  }
  if(block.kind === "ranking"){
    const items = ((block.props && block.props.items) || []).slice(0,5);
    return (
      <div style={{
        padding:"6px 8px", border:"1px solid var(--line)", borderRadius:5, background:"white",
        height:"100%", overflow:"hidden", display:"flex", flexDirection:"column", gap:3
      }}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <span style={{width:5, height:5, borderRadius:"50%", background:accent}}/>
          <span style={{fontSize:8, fontWeight:700}}>Top produtos</span>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:2, flex:1}}>
          {items.map((p,i)=>(
            <div key={i} style={{display:"grid", gridTemplateColumns:"12px 1.6fr 1fr 60px", gap:5, alignItems:"center", fontSize:7}}>
              <span className="mono" style={{color:"var(--muted)"}}>{String(i+1).padStart(2,"0")}</span>
              <span style={{fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.n}</span>
              <div style={{position:"relative", height:4, background:"var(--line-2)", borderRadius:99, overflow:"hidden"}}>
                <div style={{width:p.pct+"%", height:"100%", background:`linear-gradient(90deg, ${accent}, var(--violet))`}}/>
              </div>
              <span style={{textAlign:"right", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>{dashKpiText({ value: p.v, format:"brl" })}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function MiniChart({ chart, color, width, height }){
  const { type } = chart;
  const data = chart.data || [];
  if(type==="line" || type==="area"){
    return <LineChart data={data} width={width||200} height={height} color={color} fill={type==="area"} showAxis={false} animate={false}/>;
  }
  if(type==="donut"){
    return (
      <div style={{display:"flex", alignItems:"center", justifyContent:"center", height:"100%", gap:6}}>
        <Donut data={data.map((d,i)=>({v:d.v, color: i===0? color : ["#94b7ff","#7a5cff","#0a8a4a","#1b2240","#ff7849"][i%5]}))} size={Math.min(height-4, 48)} thickness={6}/>
        <div style={{display:"flex", flexDirection:"column", gap:1, fontSize:6.5}}>
          {data.slice(0,3).map((d,i)=>(
            <div key={i} style={{display:"flex", alignItems:"center", gap:3}}>
              <span style={{width:4, height:4, borderRadius:"50%", background: i===0? color : ["#94b7ff","#7a5cff","#0a8a4a"][i%3]}}/>
              <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth: 60}}>{d.l}</span>
              <span className="mono" style={{color:"var(--muted)", marginLeft:"auto"}}>{Math.round(d.v).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <MiniBars data={data} color={color} width={width||200} height={height}/>;
}

function MiniBars({ data, color, width, height }){
  if(!data || !data.length) return <svg width="100%" height={height}/>;
  const pad = { l: 2, r: 2, t: 2, b: 10 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const max = Math.max(...data.map(d=>d.v)) || 1;
  const barW = W / data.length * 0.7;
  const gap = W / data.length * 0.3;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((d,i)=>{
        const h = Math.max(0, (d.v/max)*H);
        const x = pad.l + i*(barW+gap) + gap/2;
        const y = pad.t + H - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="1.5" fill={color}/>
            <text x={x+barW/2} y={height-2} fontSize="5.5" textAnchor="middle" fill="#8c93a6">{String(d.l).slice(0,5)}</text>
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, { ExportModal, MiniBlock, MiniChart, MiniBars, dashEnsureHtmlToImage, dashExportFilename });
