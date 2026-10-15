/* Links públicos de dashboard (plano Pro).
 *
 * ShareModal  — dentro do Dashboard: cria o link a partir de um RETRATO dos
 *               blocos (valores já agregados; as linhas do arquivo não saem do
 *               navegador), lista e desativa os links do usuário.
 * SharedView  — página pública ?s=<slug>: dashboard em modo leitura, sem login.
 *               Também é um canal de aquisição: o rodapé leva para o cadastro.
 * Backend: DashProject-Backend src/share/routes.ts.
 */

// Retrato serializável do dashboard. Só blocos de dado; a análise da IA vai
// como texto (aiSummary) quando o usuário escolhe incluir.
function dashBuildShareSnapshot({ blocks, meta, accent, aiSummary, branding }){
  const keep = blocks.filter(b => b.kind === "kpi" || b.kind === "chart" || b.kind === "ranking");
  return {
    version: 1,
    accent: accent,
    branding: !!branding,
    meta: meta,
    aiSummary: aiSummary || null,
    blocks: keep.map(b => ({
      id: String(b.id).slice(0, 80),
      kind: b.kind,
      span: Math.max(1, Math.min(12, b.span || 6)),
      // JSON round-trip: tira Date/funções e garante dado puro.
      props: b.props ? JSON.parse(JSON.stringify(b.props)) : null,
    })),
  };
}

function ShareModal({ onClose, tweaks, buildSnapshot, defaultTitle, hasAI }){
  const [title, setTitle] = React.useState(defaultTitle || "Dashboard");
  const [includeAI, setIncludeAI] = React.useState(!!hasAI);
  const [branding, setBranding] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [created, setCreated] = React.useState(null); // { slug, url }
  const [links, setLinks] = React.useState(null);     // null = carregando
  const [copied, setCopied] = React.useState(null);

  const loadLinks = ()=>{
    window.DashAPI.listShares()
      .then(d => setLinks((d && d.links) || []))
      .catch(()=> setLinks([]));
  };
  React.useEffect(()=>{
    loadLinks();
    const onKey = e=>{ if(e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return ()=>{ window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, []);

  const errorText = (err)=>{
    const code = err && err.data && err.data.error;
    if(code === "plano_insuficiente") return "Links públicos são do plano Pro.";
    if(code === "limite_links") return (err.data && err.data.message) || "Limite de links ativos atingido.";
    if(code === "payload_invalido") return "Não foi possível salvar este dashboard. Tente remover alguns blocos.";
    if(!err || !err.status) return "Não foi possível conectar ao servidor. Tente novamente.";
    return "Não foi possível criar o link agora. Tente novamente em instantes.";
  };

  const create = async ()=>{
    if(busy) return;
    setError(null);
    const snap = buildSnapshot({ includeAI, branding });
    // O backend aceita até 512 KB; avisa antes de mandar.
    if(JSON.stringify(snap).length > 480000){
      setError("Este dashboard é grande demais para um link. Remova alguns blocos ou use um período menor.");
      return;
    }
    setBusy(true);
    try {
      const r = await window.DashAPI.createShare(title.trim().slice(0, 120) || "Dashboard", snap);
      setCreated(r);
      loadLinks();
    } catch(err){
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = (url)=>{
    const done = ()=>{ setCopied(url); setTimeout(()=> setCopied(null), 1800); };
    if(navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(done);
    else done();
  };

  const revoke = async (slug)=>{
    if(!window.confirm("Desativar este link? Quem tiver o endereço não conseguirá mais abrir o dashboard.")) return;
    try {
      await window.DashAPI.revokeShare(slug);
      if(created && created.slug === slug) setCreated(null);
      loadLinks();
    } catch(err){
      window.alert("Não foi possível desativar agora. Tente novamente.");
    }
  };

  const label = { fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8 };

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:110, background:"rgba(11,16,32,.5)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
    }}>
      <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Compartilhar por link" style={{
        width:"min(560px, 100%)", maxHeight:"92vh", overflowY:"auto", background:"white", borderRadius:18,
        boxShadow:"0 40px 80px -20px rgba(11,16,32,.5)", padding:24, display:"flex", flexDirection:"column", gap:18,
      }}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
          <div>
            <h2 style={{margin:0, fontSize:18, fontWeight:800, letterSpacing:"-.01em"}}>Compartilhar por link</h2>
            <div style={{fontSize:13, color:"var(--muted)", marginTop:4, lineHeight:1.5}}>
              Quem tiver o link vê este dashboard em modo leitura, sem precisar de conta.
            </div>
          </div>
          <button onClick={onClose} className="icon-btn" style={{width:28, height:28, flexShrink:0}} aria-label="Fechar"><Icon.X size={14}/></button>
        </div>

        <div style={{padding:"12px 14px", borderRadius:12, background:"#fafbfe", border:"1px solid var(--line-2)", display:"flex", gap:10, fontSize:12.5, color:"var(--ink-2)", lineHeight:1.5}}>
          <Icon.Lock size={14} color="#0a8a4a"/>
          <span>Salvamos um retrato dos blocos, com os valores já calculados. As linhas do seu arquivo continuam só no seu navegador. Você pode desativar o link quando quiser.</span>
        </div>

        {created ? (
          <div>
            <div className="mono" style={label}>SEU LINK</div>
            <div style={{display:"flex", gap:8}}>
              <input readOnly value={created.url} onFocus={e=>e.target.select()} className="mono" style={{
                flex:1, minWidth:0, padding:"10px 12px", border:"1px solid var(--line)", borderRadius:10, fontSize:13, background:"var(--line-2)", color:"var(--ink)",
              }}/>
              <button className="btn btn-primary" style={{padding:"10px 14px"}} onClick={()=> copy(created.url)}>
                {copied === created.url ? <><Icon.Check size={13} stroke={3}/> Copiado</> : <><Icon.Share size={13}/> Copiar</>}
              </button>
            </div>
            <div style={{display:"flex", gap:8, marginTop:10}}>
              <a href={created.url} target="_blank" rel="noopener" className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}}><Icon.Eye size={13}/> Abrir</a>
              <button className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}} onClick={()=> setCreated(null)}>Criar outro</button>
            </div>
          </div>
        ) : (
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <label style={{display:"block"}}>
              <div className="mono" style={label}>TÍTULO</div>
              <input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} style={{
                width:"100%", padding:"10px 12px", border:"1px solid var(--line)", borderRadius:10, fontSize:14, fontFamily:"inherit", color:"var(--ink)", outline:"none",
              }}/>
            </label>
            <label style={{display:"flex", gap:10, alignItems:"flex-start", fontSize:13, cursor: hasAI ? "pointer" : "default", opacity: hasAI ? 1 : .65}}>
              <input type="checkbox" checked={includeAI && hasAI} disabled={!hasAI} onChange={()=>setIncludeAI(v=>!v)} style={{accentColor:"var(--brand)", marginTop:2}}/>
              <span>Incluir a análise da IA{!hasAI && <span style={{display:"block", fontSize:11, color:"var(--muted)"}}>gere a análise no dashboard antes</span>}</span>
            </label>
            <label style={{display:"flex", gap:10, alignItems:"flex-start", fontSize:13, cursor:"pointer"}}>
              <input type="checkbox" checked={branding} onChange={()=>setBranding(v=>!v)} style={{accentColor:"var(--brand)", marginTop:2}}/>
              <span>Mostrar "Feito com Dash" na página</span>
            </label>
            {error && <div role="alert" style={{fontSize:13, color:"#c9234a"}}>{error}</div>}
            <button className="btn btn-primary" onClick={create} disabled={busy} style={{justifyContent:"center", padding:"12px", opacity: busy ? .7 : 1}}>
              <Icon.Share size={14}/> {busy ? "Criando link…" : "Criar link"}
            </button>
          </div>
        )}

        <div>
          <div className="mono" style={label}>SEUS LINKS ATIVOS</div>
          {links === null ? (
            <div style={{fontSize:13, color:"var(--muted)"}}>Carregando…</div>
          ) : links.length === 0 ? (
            <div style={{fontSize:13, color:"var(--muted)"}}>Nenhum link ativo.</div>
          ) : (
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {links.map(l => (
                <div key={l.slug} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 10px", border:"1px solid var(--line-2)", borderRadius:10}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{l.title}</div>
                    <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>criado em {new Date(l.createdAt).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12}} onClick={()=> copy(l.url)}>
                    {copied === l.url ? "Copiado" : "Copiar"}
                  </button>
                  <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12, color:"#c9234a"}} onClick={()=> revoke(l.slug)}>Desativar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Página pública ───────────────────────────────────────────────────── */

// O conteúdo vem de outro usuário: só passa cor no formato #hex ou var(--x)
// (nada de url(...) em style) e cada campo é convertido para o tipo esperado.
function dashSafeColor(c, fallback){
  return (typeof c === "string" && (/^#[0-9a-f]{3,8}$/i.test(c) || /^var\(--[a-z0-9-]+\)$/i.test(c))) ? c : fallback;
}
function dashSanitizeSharedBlock(b, accent){
  const p = (b && b.props) || {};
  const num = (v)=> (typeof v === "number" && Number.isFinite(v)) ? v : 0;
  const str = (v, max)=> v == null ? "" : String(v).slice(0, max || 200);
  const span = Math.max(1, Math.min(12, num(b.span) || 6));
  if(b.kind === "kpi"){
    return { id: str(b.id, 80), kind:"kpi", span, props: {
      label: str(p.label, 80),
      value: typeof p.value === "number" ? num(p.value) : str(p.value, 40),
      format: ["brl","pct","int","scale"].indexOf(p.format) >= 0 ? p.format : undefined,
      suffix: p.suffix ? str(p.suffix, 4) : undefined,
      delta: str(p.delta == null ? "—" : p.delta, 20),
      deltaDir: p.deltaDir === "down" ? "down" : "up",
      sub: str(p.sub, 120),
      data: Array.isArray(p.data) ? p.data.slice(0, 400).map(num) : [],
      color: dashSafeColor(p.color, accent),
    }};
  }
  if(b.kind === "chart"){
    return { id: str(b.id, 80), kind:"chart", span, props: {
      title: str(p.title, 120), sub: str(p.sub, 160),
      type: ["bar","line","area","donut"].indexOf(p.type) >= 0 ? p.type : "bar",
      dim: str(p.dim, 40), agg: str(p.agg, 20),
      height: Math.max(160, Math.min(420, num(p.height) || 240)),
      color: dashSafeColor(p.color, accent),
      data: Array.isArray(p.data) ? p.data.slice(0, 400).map(d => ({
        l: str(d && d.l, 60), v: num(d && d.v),
        ...(d && d.color ? { color: dashSafeColor(d.color, accent) } : {}),
      })) : [],
    }};
  }
  if(b.kind === "ranking"){
    return { id: str(b.id, 80), kind:"ranking", span, props: {
      items: Array.isArray(p.items) ? p.items.slice(0, 20).map(it => ({
        n: str(it && it.n, 80), c: str(it && it.c, 60), r: str(it && it.r, 60),
        v: num(it && it.v), pct: Math.max(0, Math.min(100, num(it && it.pct))),
      })) : [],
    }};
  }
  return null;
}

function SharedView({ slug, tweaks, onLeave }){
  const [state, setState] = React.useState({ status:"loading" });
  // Dashboard de usuário não deve parar no Google: noindex enquanto a página
  // pública estiver aberta.
  React.useEffect(()=>{
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return ()=> m.remove();
  }, []);
  React.useEffect(()=>{
    let alive = true;
    window.DashAPI.getShare(slug)
      .then(d => { if(alive) setState({ status:"ok", data:d }); })
      .catch(err => { if(alive) setState({ status: (err && err.status === 404) ? "gone" : "error" }); });
    return ()=>{ alive = false; };
  }, [slug]);

  const cta = (
    <button className="btn btn-primary" onClick={onLeave}>
      Crie o seu grátis <Icon.Arrow size={14}/>
    </button>
  );

  if(state.status !== "ok"){
    const msg = state.status === "loading" ? "Carregando dashboard…"
      : state.status === "gone" ? "Este link não está mais disponível."
      : "Não foi possível abrir o dashboard agora. Tente novamente em instantes.";
    return (
      <div style={{minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"var(--bg)"}}>
        <div style={{textAlign:"center", maxWidth:420}}>
          <Icon.Logo size={36}/>
          <div style={{fontWeight:700, fontSize:18, margin:"14px 0 6px"}}>{msg}</div>
          {state.status !== "loading" && (
            <>
              <div style={{fontSize:13, color:"var(--muted)", marginBottom:18, lineHeight:1.55}}>
                O {tweaks.brandName} transforma planilhas em dashboards com IA em segundos.
              </div>
              {cta}
            </>
          )}
        </div>
      </div>
    );
  }

  const d = state.data;
  const payload = (d && d.payload) || {};
  const accent = dashSafeColor(payload.accent, "#2f6bff");
  const meta = payload.meta || {};
  const branding = payload.branding !== false;
  const blocks = (Array.isArray(payload.blocks) ? payload.blocks : [])
    .map(b => dashSanitizeSharedBlock(b, accent)).filter(Boolean);
  const kpiPalette = [];
  const sharedOn = d.createdAt ? new Date(d.createdAt).toLocaleDateString("pt-BR") : null;

  return (
    <div className="dash-readonly" style={{minHeight:"100vh", background:"var(--bg)"}}>
      {branding && (
        <div className="topbar">
          <div className="tb-row" style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"14px 24px", maxWidth:1480, margin:"0 auto"}}>
            <a href="/" onClick={(e)=>{ e.preventDefault(); onLeave(); }} style={{display:"flex", alignItems:"center", gap:10}}>
              <Icon.Logo size={28}/>
              <div className="tb-brand" style={{display:"flex", flexDirection:"column", lineHeight:1}}>
                <span style={{fontWeight:700, fontSize:14}}>{tweaks.brandName}</span>
                <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>DASHBOARDS · IA</span>
              </div>
            </a>
            {cta}
          </div>
        </div>
      )}
      <div style={{maxWidth:1480, margin:"0 auto", padding:"28px 24px 64px"}}>
        <div style={{marginBottom:22}}>
          <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)", marginBottom:8}}><Icon.Eye size={11}/> Somente leitura</span>
          <h1 style={{margin:"8px 0 4px", fontSize:34, fontWeight:800, letterSpacing:"-.02em"}}>{String(d.title || meta.title || "Dashboard").slice(0, 120)}</h1>
          <div style={{fontSize:13, color:"var(--muted)"}}>
            {[meta.fileName, meta.period, typeof meta.rows === "number" ? meta.rows.toLocaleString("pt-BR") + " linhas" : null, sharedOn ? "compartilhado em " + sharedOn : null]
              .filter(Boolean).map(String).join(" · ")}
          </div>
        </div>

        {payload.aiSummary && (
          <div className="card soft-shadow" style={{padding:24, marginBottom:14}}>
            <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:12}}>
              <div style={{width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${accent}, var(--violet))`, display:"flex", alignItems:"center", justifyContent:"center", color:"white"}}>
                <Icon.Sparkle size={18}/>
              </div>
              <span style={{fontWeight:700, fontSize:16}}>Análise por IA</span>
            </div>
            <p style={{margin:0, color:"var(--ink-2)", fontSize:14, lineHeight:1.6, whiteSpace:"pre-wrap"}}>{String(payload.aiSummary).slice(0, 10000)}</p>
            <div style={{fontSize:11, color:"var(--muted)", marginTop:10}}>Conteúdo gerado por inteligência artificial · pode conter imprecisões.</div>
          </div>
        )}

        <div style={{display:"grid", gridTemplateColumns:"repeat(12, minmax(0, 1fr))", gap:14}}>
          {blocks.map(b => (
            <div key={b.id} className="block-wrap" style={{gridColumn:`span ${b.span}`}}>
              {b.kind === "kpi" && <KPI kpi={{...b.props, span:b.span}} editing={false} palette={kpiPalette}/>}
              {b.kind === "chart" && <ChartCard chart={{id:b.id, ...b.props, span:b.span}} color={b.props.color} editing={false} dims={[]} aggs={[]} palette={[]}/>}
              {b.kind === "ranking" && <RankingTable items={b.props.items} accent={accent}/>}
            </div>
          ))}
        </div>

        {branding && (
          <div style={{marginTop:28, padding:"18px 22px", borderRadius:16, background:"white", border:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap"}}>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <Icon.Logo size={28}/>
              <div>
                <div style={{fontWeight:700, fontSize:15}}>Feito com {tweaks.brandName}</div>
                <div style={{fontSize:13, color:"var(--muted)"}}>Suba uma planilha e tenha um dashboard como este em segundos.</div>
              </div>
            </div>
            {cta}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ShareModal, SharedView, dashBuildShareSnapshot, dashSanitizeSharedBlock });
