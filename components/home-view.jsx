/* Painel do usuário (rota "home"): o lugar para organizar o que a pessoa faz
 * no Dash — dashboards salvos, links públicos, uso do plano, instalação do app
 * e atalhos para a Conta. É a tela de entrada de quem está logado.
 *
 * Os dashboards ficam no IndexedDB deste navegador (DashSaved, dashboard-saved.jsx);
 * os links e os limites vêm do backend (DashAPI.listShares, /me → limits).
 */

// Mesmo padrão do AccountErrorBoundary (CLAUDE.md §23): erro numa seção não
// derruba o Painel inteiro.
class HomeErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidUpdate(prev){ if(prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render(){
    if(this.state.err){
      return (
        <div style={{padding:"32px 28px", border:"1px dashed var(--line)", borderRadius:14, background:"#fff7f9", textAlign:"center"}}>
          <div style={{fontWeight:700, fontSize:15, marginBottom:6, color:"#d70015"}}>Não foi possível carregar esta seção</div>
          <div style={{fontSize:13, color:"var(--muted)", margin:"0 auto 14px", maxWidth:380, lineHeight:1.55}}>Tente outra aba ou recarregue a página.</div>
          <button onClick={()=> this.setState({ err: null })} className="btn btn-ghost" style={{padding:"8px 14px", fontSize:13}}>Tentar de novo</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lista de dashboards salvos do dono, sempre atualizada (DashSaved avisa mudanças).
function useSavedDashboards(owner){
  const [items, setItems] = React.useState(null);
  const [enabled, setEnabled] = React.useState(()=> DashSaved.enabled());
  React.useEffect(()=>{
    let alive = true;
    const refresh = ()=>{
      setEnabled(DashSaved.enabled());
      DashSaved.list(owner).then(list => { if(alive) setItems(list); });
    };
    refresh();
    const off = DashSaved.subscribe(refresh);
    return ()=>{ alive = false; off(); };
  }, [owner]);
  return [items, enabled];
}

// Links públicos ativos (só quem tem o recurso; os outros nem chamam a API).
function useShareLinks(allowed){
  const [links, setLinks] = React.useState(null); // null = carregando
  const [error, setError] = React.useState(false);
  const load = React.useCallback(()=>{
    if(!allowed){ setLinks([]); return; }
    setError(false);
    window.DashAPI.listShares()
      .then(d => setLinks((d && d.links) || []))
      .catch(()=>{ setLinks([]); setError(true); });
  }, [allowed]);
  React.useEffect(()=>{ load(); }, [load]);
  return [links, load, error];
}

function useInstallStatus(){
  const get = ()=> window.DashPWA ? window.DashPWA.status() : "manual";
  const [status, setStatus] = React.useState(get);
  React.useEffect(()=> window.DashPWA ? window.DashPWA.onChange(()=> setStatus(get())) : undefined, []);
  return status;
}

function homeFmtInt(n){ return Number(n || 0).toLocaleString("pt-BR"); }

function HomeView({ tweaks, currentUser, section, onSection, onNew, onOpenSaved, onClose, onSignIn, onSignUp, onSignOut, onProfile }){
  // Hooks antes de qualquer return (regra dos hooks): sem login, valem vazios.
  const limits = (currentUser && currentUser.limits) || {};
  const [items, savingOn] = useSavedDashboards(currentUser ? currentUser.id : "anon");
  const [links, reloadLinks, linksError] = useShareLinks(!!(currentUser && limits.shareLinks));
  const install = useInstallStatus();
  // Atualiza o uso do mês (IA gasta em outra tela não aparece sem isso).
  React.useEffect(()=>{ if(currentUser) window.DashAPI.me().catch(()=>{}); }, [currentUser && currentUser.id]);

  if(!currentUser){
    return (
      <div style={{minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"var(--bg)"}}>
        <div style={{textAlign:"center", maxWidth:360}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Entre para ver o seu Painel</div>
          <div style={{fontSize:13, color:"var(--muted)", marginBottom:18}}>Aqui ficam seus dashboards, links e o uso do plano.</div>
          <div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap"}}>
            <button className="btn btn-primary" onClick={onSignIn}>Entrar</button>
            <button className="btn btn-ghost" onClick={onSignUp}>Criar conta</button>
          </div>
        </div>
      </div>
    );
  }

  const plan = currentUser.plan || "free";
  const isPaid = plan !== "free";
  const keep = isPaid ? DashSaved.KEEP.paid : DashSaved.KEEP.free;
  const displayName = currentUser.fullName || currentUser.email || "Conta";
  const firstName = String(currentUser.fullName || "").trim().split(/\s+/)[0] || "";

  const sections = [
    { k:"overview",   n:"Início",           d:"Resumo e atalhos",        c:"#0071e3", i:<Icon.Home size={16} stroke={1.9}/> },
    { k:"dashboards", n:"Meus dashboards",  d: items ? homeFmtInt(items.length) + " salvos" : "Neste navegador", c:"#5e5ce6", i:<Icon.Chart size={16} stroke={1.9}/> },
    { k:"links",      n:"Links públicos",   d: limits.shareLinks ? (links ? homeFmtInt(links.length) + " ativos" : "Compartilhados") : "Plano Pro", c:"#30b0c7", i:<Icon.Share size={16} stroke={1.9}/>, lock: !limits.shareLinks },
    { k:"usage",      n:"Plano e uso",      d:"Limites do mês",          c:"#ff9500", i:<Icon.Bolt size={16} stroke={1.9}/> },
    { k:"app",        n:"Instalar o app",   d: install === "installed" ? "Instalado" : "Celular e computador", c:"#34c759", i:<Icon.Download size={16} stroke={1.9}/> },
  ];
  const shortcuts = [
    { n:"Conta e segurança", s:"account", c:"#8e8e93", i:<Icon.User size={16} stroke={1.9}/> },
    { n:"Faturamento",       s:"billing", c:"#34c759", i:<Icon.Doc size={16} stroke={1.9}/> },
    { n:"Histórico da IA",   s:"history", c:"#ff375f", i:<Icon.Clock size={16} stroke={1.9}/> },
  ];
  const cur = sections.find(s => s.k === section) || sections[0];
  const go = (k)=>{ onSection(k); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <div className="topbar" style={{position:"sticky", top:0, zIndex:30, backdropFilter:"saturate(180%) blur(20px)", WebkitBackdropFilter:"saturate(180%) blur(20px)", background:"rgba(245,245,247,.72)", borderBottom:"1px solid var(--line)"}}>
        <div className="tb-row" style={{padding:"14px 24px", maxWidth:1280, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12}}>
          <button onClick={onClose} title="Página inicial do site" style={{display:"flex", alignItems:"center", gap:10, background:"transparent", border:0, cursor:"pointer", padding:0}}>
            <Icon.Logo size={28}/>
            <div className="tb-brand" style={{display:"flex", flexDirection:"column", lineHeight:1, textAlign:"left"}}>
              <span style={{fontWeight:700, fontSize:14}}>{tweaks.brandName}</span>
              <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>PAINEL</span>
            </div>
          </button>
          <div className="tb-crumb" style={{display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--muted)"}}>
            <span>Painel</span><Icon.Caret size={12}/><span style={{color:"var(--ink-2)", fontWeight:600}}>{cur.n}</span>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <button className="btn btn-primary home-new-top" onClick={onNew} style={{padding:"9px 14px"}}>
              <Icon.Plus size={14}/> <span className="tb-label">Novo dashboard</span>
            </button>
            <AuthBubble currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile} accent={tweaks.accent}/>
          </div>
        </div>
      </div>

      <div className="acct-grid" style={{maxWidth:1280, margin:"0 auto", padding:"32px 24px 80px", display:"grid", gridTemplateColumns:"250px minmax(0, 1fr)", gap:32}}>
        <aside className="acct-aside" style={{position:"sticky", top:80, alignSelf:"flex-start", display:"flex", flexDirection:"column", gap:14, minWidth:0}}>
          <nav className="home-nav" aria-label="Seções do Painel" style={{display:"flex", flexDirection:"column", gap:2}}>
            {sections.map(s => <HomeNavItem key={s.k} item={s} on={cur.k === s.k} onClick={()=> go(s.k)}/>)}
            <div className="home-nav-group" style={{fontSize:11, fontWeight:600, color:"var(--muted-2)", margin:"16px 10px 4px"}}>Configurações</div>
            {shortcuts.map(s => (
              <HomeNavItem key={s.s} item={{ n:s.n, i:s.i, c:s.c, ext:true }} on={false} onClick={()=> window.__dashOpenAccount?.(s.s)}/>
            ))}
          </nav>
          <div className="home-side-card" style={{padding:"14px 16px", background:"white", border:"1px solid var(--line)", borderRadius:14}}>
            <div style={{fontSize:11, color:"var(--muted)", fontWeight:600}}>Seus dados ficam no seu aparelho</div>
            <div style={{fontSize:12, color:"var(--ink-2)", lineHeight:1.5, marginTop:4}}>
              Os arquivos são tratados no navegador. Para a IA vão só nomes de colunas, indicadores e fatos calculados.
            </div>
          </div>
        </aside>

        <main style={{minWidth:0}}>
          <HomeErrorBoundary resetKey={cur.k}>
            {cur.k === "overview" && <HomeOverview tweaks={tweaks} firstName={firstName} displayName={displayName} plan={plan} limits={limits}
              items={items} keep={keep} links={links} install={install} onNew={onNew} onOpenSaved={onOpenSaved} go={go}/>}
            {cur.k === "dashboards" && <HomeDashboards items={items} keep={keep} isPaid={isPaid} savingOn={savingOn} onNew={onNew} onOpenSaved={onOpenSaved}/>}
            {cur.k === "links" && <HomeLinks allowed={!!limits.shareLinks} links={links} error={linksError} reload={reloadLinks}/>}
            {cur.k === "usage" && <HomeUsage currentUser={currentUser} limits={limits} items={items} keep={keep} links={links}/>}
            {cur.k === "app" && <HomeInstall status={install}/>}
          </HomeErrorBoundary>
        </main>
      </div>
    </div>
  );
}

// Item do menu lateral no estilo da barra lateral de Ajustes: ladrilho
// colorido com o símbolo e, quando selecionado, a linha toda na cor da marca.
function HomeNavItem({ item, on, onClick }){
  return (
    <button onClick={onClick} aria-current={on ? "page" : undefined} className="side-item" style={{
      display:"flex", alignItems:"center", gap:10, padding:"7px 10px", borderRadius:10, border:0,
      background: on ? "var(--brand)" : "transparent", cursor:"pointer", textAlign:"left", fontFamily:"inherit",
      transition:"background .15s",
    }}>
      <IconTile color={item.c || "var(--brand)"} size={28}>{item.i}</IconTile>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:500, fontSize:13.5, color: on ? "white" : "var(--ink)", whiteSpace:"nowrap"}}>{item.n}</div>
        {item.d && <div className="home-nav-desc" style={{fontSize:11, color: on ? "rgba(255,255,255,.78)" : "var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{item.d}</div>}
      </div>
      {item.lock && <Icon.Lock size={12} color={on ? "white" : "var(--muted-2)"}/>}
      {item.ext && <Icon.Chevron size={13} stroke={2} color="#c7c7cc"/>}
    </button>
  );
}

function HomeHeader({ title, sub, action }){
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:16, flexWrap:"wrap", marginBottom:22}}>
      <div>
        <h1 style={{margin:"0 0 6px", fontSize:30, fontWeight:700, letterSpacing:"-.02em"}}>{title}</h1>
        {sub && <div style={{fontSize:14, color:"var(--muted)"}}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function HomeMeter({ label, value, max, hint, icon, color = "var(--brand)", onClick }){
  const unlimited = max == null;
  const pct = unlimited || !max ? 0 : Math.min(100, Math.round(value / max * 100));
  const full = !unlimited && max > 0 && value >= max;
  return (
    <div className="card" onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e)=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); onClick(); } } : undefined}
      style={{padding:"16px 18px", cursor: onClick ? "pointer" : "default", minWidth:0}}>
      <div style={{display:"flex", alignItems:"center", gap:8, color:"var(--muted)", fontSize:12, fontWeight:600}}>
        <span style={{color}}>{icon}</span>{label}
      </div>
      <div className="ticker" style={{fontSize:26, fontWeight:700, letterSpacing:"-.02em", margin:"8px 0 2px"}}>
        {homeFmtInt(value)}{!unlimited && <span style={{fontSize:14, color:"var(--muted)", fontWeight:600}}> / {homeFmtInt(max)}</span>}
      </div>
      {!unlimited && (
        <div style={{height:6, borderRadius:999, background:"var(--line-2)", overflow:"hidden", margin:"8px 0 6px"}}>
          <div style={{width: pct + "%", height:"100%", borderRadius:999, background: full ? "#d70015" : color, transition:"width .4s"}}></div>
        </div>
      )}
      <div style={{fontSize:12, color: full ? "#d70015" : "var(--muted)"}}>{full ? "Limite atingido" : hint}</div>
    </div>
  );
}

function HomeDashRow({ it, onOpenSaved, compact }){
  const [opening, setOpening] = React.useState(false);
  const open = async ()=>{
    if(opening) return;
    setOpening(true);
    const ok = await onOpenSaved(it.id);
    if(!ok) setOpening(false);
  };
  const rename = ()=>{
    const name = window.prompt("Novo nome do dashboard:", it.name || "");
    if(name && name.trim()) DashSaved.update(it.id, { name: name.trim().slice(0, 120) });
  };
  const remove = ()=>{
    if(window.confirm("Apagar “" + it.name + "” deste navegador? O arquivo original no seu computador não é afetado.")) DashSaved.remove(it.id);
  };
  return (
    <div style={{display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"1px solid var(--line)", borderRadius:12, background:"white", minWidth:0}}>
      <button onClick={open} disabled={opening} title={"Abrir " + it.name}
        style={{flex:1, minWidth:0, display:"flex", alignItems:"center", gap:12, background:"transparent", border:0, padding:0, cursor:"pointer", textAlign:"left", color:"var(--ink)"}}>
        <span style={{width:36, height:36, borderRadius:10, flexShrink:0, background:"var(--brand-soft)", color:"var(--brand)", display:"inline-flex", alignItems:"center", justifyContent:"center"}}>
          <Icon.Chart size={16}/>
        </span>
        <span style={{minWidth:0}}>
          <span style={{display:"block", fontWeight:600, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{opening ? "Abrindo…" : it.name}</span>
          <span className="mono" style={{display:"block", fontSize:11, color:"var(--muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
            {homeFmtInt(it.rows)} linhas · {homeFmtInt(it.cols)} colunas · {dashSavedWhen(it.updatedAt)}
          </span>
        </span>
      </button>
      {it.narrative && <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)", fontSize:10}}><Icon.Sparkle size={10}/> IA</span>}
      {!compact && (
        <>
          <button className="icon-btn" onClick={rename} title="Renomear" aria-label={"Renomear " + it.name}><Icon.Wand size={13}/></button>
          <button className="icon-btn" onClick={remove} title="Apagar deste navegador" aria-label={"Apagar " + it.name}><Icon.X size={13}/></button>
        </>
      )}
    </div>
  );
}

function HomeOverview({ tweaks, firstName, plan, limits, items, keep, links, install, onNew, onOpenSaved, go }){
  const recent = (items || []).slice(0, 4);
  const latest = recent[0];
  return (
    <>
      <HomeHeader title={firstName ? "Olá, " + firstName : "Seu Painel"}
        sub={<>Plano <b style={{color:"var(--ink-2)"}}>{dashPlanLabel(plan)}</b> · tudo o que você faz no {tweaks.brandName}, num lugar só.</>}/>

      <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"minmax(0, 1.4fr) minmax(0, 1fr)", gap:14, marginBottom:14}}>
        <div style={{padding:"24px", borderRadius:18, color:"white", background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`, display:"flex", flexDirection:"column", gap:10}}>
          <Icon.Upload size={20}/>
          <div style={{fontWeight:700, fontSize:20, letterSpacing:"-.01em"}}>Criar um dashboard</div>
          <div style={{fontSize:13, opacity:.92, lineHeight:1.5, maxWidth:420}}>Envie um CSV, Excel ou JSON. O arquivo é tratado no seu navegador e vira KPIs, gráficos e insights.</div>
          <div><button className="btn" onClick={onNew} style={{background:"white", color:"var(--ink)", marginTop:4}}><Icon.Plus size={14}/> Novo dashboard</button></div>
        </div>
        <div className="card" style={{padding:"20px", display:"flex", flexDirection:"column", gap:10, minWidth:0}}>
          <div style={{fontSize:12, color:"var(--muted)", fontWeight:600}}>Continuar de onde parou</div>
          {latest ? (
            <>
              <div style={{fontWeight:700, fontSize:16, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{latest.name}</div>
              <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>{homeFmtInt(latest.rows)} linhas · {dashSavedWhen(latest.updatedAt)}</div>
              <div style={{marginTop:"auto"}}><button className="btn btn-ghost" onClick={()=> onOpenSaved(latest.id)}><Icon.Arrow size={13}/> Abrir</button></div>
            </>
          ) : (
            <div style={{fontSize:13, color:"var(--ink-2)", lineHeight:1.5}}>Nenhum dashboard salvo neste navegador ainda. O próximo que você criar aparece aqui.</div>
          )}
        </div>
      </div>

      {/* Só no celular (a barra inferior substitui o menu lateral): atalhos para
          as seções que não estão nas abas de baixo. */}
      <div className="home-shortcuts" style={{display:"none", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:8, marginBottom:14}}>
        {[
          { n:"Links", c:"#30b0c7", i:<Icon.Share size={22} stroke={1.9}/>, on:()=> go("links") },
          { n:"Instalar", c:"#34c759", i:<Icon.Download size={22} stroke={1.9}/>, on:()=> go("app") },
          { n:"Faturas", c:"#ff9500", i:<Icon.Doc size={22} stroke={1.9}/>, on:()=> window.__dashOpenAccount?.("billing") },
          { n:"Histórico IA", c:"#ff375f", i:<Icon.Clock size={22} stroke={1.9}/>, on:()=> window.__dashOpenAccount?.("history") },
        ].map(a => (
          <button key={a.n} onClick={a.on} style={{padding:"4px 2px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer", border:0, background:"transparent", fontFamily:"inherit", minWidth:0}}>
            <IconTile color={a.c} size={52}>{a.i}</IconTile>
            <span style={{fontSize:11.5, fontWeight:500, color:"var(--ink)", whiteSpace:"nowrap"}}>{a.n}</span>
          </button>
        ))}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:14, marginBottom:28}}>
        <HomeMeter label="Resumos com IA no mês" icon={<Icon.Sparkle size={13}/>} value={limits.aiUsed || 0} max={limits.aiMonthly || 0}
          hint={"Renova no dia 1º"} onClick={()=> go("usage")}/>
        <HomeMeter label="Dashboards salvos" icon={<Icon.Chart size={13}/>} value={items ? items.length : 0} max={keep} color="#248a3d"
          hint="Neste navegador" onClick={()=> go("dashboards")}/>
        <HomeMeter label="Links públicos ativos" icon={<Icon.Share size={13}/>} value={limits.shareLinks ? (links ? links.length : 0) : 0}
          max={null} color="#5e5ce6" hint={limits.shareLinks ? "Ver e desativar" : "Disponível no Pro"} onClick={()=> go("links")}/>
        <HomeMeter label="Linhas por base" icon={<Icon.Rows size={13}/>} value={limits.maxRows || 5000} max={null} color="#ff7849"
          hint="Tamanho máximo de arquivo" onClick={()=> go("usage")}/>
      </div>

      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <div style={{fontWeight:700, fontSize:16}}>Recentes</div>
        {items && items.length > 0 && <button className="btn btn-ghost" onClick={()=> go("dashboards")} style={{padding:"6px 12px", fontSize:13}}>Ver todos</button>}
      </div>
      {items === null ? <div style={{fontSize:13, color:"var(--muted)"}}>Carregando…</div>
        : recent.length ? (
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10, marginBottom:28}}>
            {recent.map(it => <HomeDashRow key={it.id} it={it} onOpenSaved={onOpenSaved} compact/>)}
          </div>
        ) : <HomeEmpty text="Seus dashboards vão aparecer aqui." onNew={onNew}/>}

      {install !== "installed" && (
        <div className="card" style={{padding:"18px 20px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginTop:28}}>
          <span style={{width:40, height:40, borderRadius:12, background:"var(--brand-soft)", color:"var(--brand)", display:"inline-flex", alignItems:"center", justifyContent:"center"}}><Icon.Download size={18}/></span>
          <div style={{flex:1, minWidth:200}}>
            <div style={{fontWeight:700, fontSize:14}}>Instale o {tweaks.brandName} no celular ou no computador</div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>Abre em janela própria, com ícone na tela inicial, sem precisar procurar o site.</div>
          </div>
          <button className="btn btn-ghost" onClick={()=> go("app")}>Como instalar</button>
        </div>
      )}
    </>
  );
}

function HomeEmpty({ text, onNew }){
  return (
    <div style={{padding:"28px", border:"1px dashed var(--line)", borderRadius:14, textAlign:"center", background:"white"}}>
      <div style={{fontSize:13, color:"var(--ink-2)", marginBottom: onNew ? 12 : 0}}>{text}</div>
      {onNew && <button className="btn btn-primary" onClick={onNew}><Icon.Plus size={14}/> Novo dashboard</button>}
    </div>
  );
}

function HomeDashboards({ items, keep, isPaid, savingOn, onNew, onOpenSaved }){
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState("recent");
  const list = (items || [])
    .filter(it => !q.trim() || String(it.name || "").toLowerCase().includes(q.trim().toLowerCase()))
    .slice()
    .sort((a, b) => sort === "name" ? String(a.name).localeCompare(String(b.name), "pt-BR")
      : sort === "size" ? (b.rows || 0) - (a.rows || 0) : (b.updatedAt || 0) - (a.updatedAt || 0));
  return (
    <>
      <HomeHeader title="Meus dashboards"
        sub={"Salvos só neste navegador, com layout e resumo da IA. " + (isPaid ? "Até " + keep + " dashboards." : "O Free guarda os " + keep + " mais recentes.")}
        action={<button className="btn btn-primary" onClick={onNew}><Icon.Plus size={14}/> Novo dashboard</button>}/>
      <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:14}}>
        <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar dashboards"
          style={{flex:"1 1 220px", minWidth:0, padding:"10px 12px", border:"1px solid var(--line)", borderRadius:10, fontSize:14, background:"white", fontFamily:"inherit"}}/>
        <div className="seg" role="group" aria-label="Ordenar">
          {[["recent","Recentes"],["name","Nome"],["size","Tamanho"]].map(([k, n]) => (
            <button key={k} className={sort === k ? "on" : ""} aria-pressed={sort === k} onClick={()=> setSort(k)} style={{padding:"7px 12px", fontSize:12, fontWeight:600}}>{n}</button>
          ))}
        </div>
        <label style={{display:"inline-flex", alignItems:"center", gap:10, fontSize:13, color:"var(--ink-2)", cursor:"pointer"}}>
          Salvar neste navegador
          <input type="checkbox" role="switch" className="switch" checked={savingOn} onChange={e=> DashSaved.setEnabled(e.target.checked)}/>
        </label>
      </div>
      {!savingOn && (
        <div style={{padding:"10px 14px", borderRadius:10, background:"#fff6ec", color:"#8a4b12", fontSize:13, marginBottom:14}}>
          O salvamento está desligado: dashboards novos não ficam guardados. Os que já estão aqui continuam.
        </div>
      )}
      {items === null ? <div style={{fontSize:13, color:"var(--muted)"}}>Carregando…</div>
        : list.length ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            {list.map(it => <HomeDashRow key={it.id} it={it} onOpenSaved={onOpenSaved}/>)}
          </div>
        ) : <HomeEmpty text={q ? "Nenhum dashboard com esse nome." : "Nenhum dashboard salvo neste navegador."} onNew={q ? null : onNew}/>}
      <div style={{fontSize:12, color:"var(--muted)", marginTop:14, lineHeight:1.5}}>
        Outro navegador ou aparelho não vê estes dashboards: a base fica guardada só aqui, nunca nos nossos servidores.
      </div>
    </>
  );
}

function HomeLinks({ allowed, links, error, reload }){
  const [copied, setCopied] = React.useState(null);
  if(!allowed){
    return (
      <>
        <HomeHeader title="Links públicos" sub="Compartilhe um dashboard por link, sem a pessoa precisar de conta."/>
        <PlanGate tier="pro" title="Links públicos são do plano Pro"
          desc="Crie um link para qualquer dashboard e mande para clientes, sócios ou a equipe. Só os números agregados vão para o link, nunca as linhas do arquivo."
          features={["Até 50 links ativos ao mesmo tempo","Desative quando quiser","Sem a marca Dash","300 resumos com IA por mês"]}
          preview={<div style={{display:"flex", flexDirection:"column", gap:8}}>{[1,2,3].map(i => (
            <div key={i} style={{height:64, borderRadius:12, background:"white", border:"1px solid var(--line)"}}></div>
          ))}</div>}/>
      </>
    );
  }
  const copy = (url)=>{
    const done = ()=>{ setCopied(url); setTimeout(()=> setCopied(null), 1800); };
    if(navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(done); else done();
  };
  const revoke = async (slug)=>{
    if(!window.confirm("Desativar este link? Quem tiver o endereço não conseguirá mais abrir o dashboard.")) return;
    try { await window.DashAPI.revokeShare(slug); reload(); }
    catch(e){ window.alert("Não foi possível desativar agora. Tente novamente."); }
  };
  return (
    <>
      <HomeHeader title="Links públicos" sub="Dashboards que você compartilhou. Para criar um link, abra o dashboard e use “Compartilhar”."
        action={<button className="btn btn-ghost" onClick={reload}><Icon.Refresh size={13}/> Atualizar</button>}/>
      {links === null ? <div style={{fontSize:13, color:"var(--muted)"}}>Carregando…</div>
        : error ? <HomeEmpty text="Não foi possível carregar os links agora. Verifique a conexão e toque em Atualizar."/>
        : links.length ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            {links.map(l => (
              <div key={l.slug} style={{display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"1px solid var(--line)", borderRadius:12, background:"white", flexWrap:"wrap"}}>
                <span style={{width:36, height:36, borderRadius:10, background:"#f1edff", color:"#5e5ce6", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0}}><Icon.Share size={15}/></span>
                <div style={{flex:"1 1 200px", minWidth:0}}>
                  <div style={{fontWeight:600, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{l.title}</div>
                  <div className="mono" style={{fontSize:11, color:"var(--muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                    {l.createdAt ? "criado em " + new Date(l.createdAt).toLocaleDateString("pt-BR") + " · " : ""}{l.url}
                  </div>
                </div>
                <a className="btn btn-ghost" href={l.url} target="_blank" rel="noopener noreferrer" style={{padding:"7px 12px", fontSize:13}}><Icon.Eye size={13}/> Abrir</a>
                <button className="btn btn-ghost" onClick={()=> copy(l.url)} style={{padding:"7px 12px", fontSize:13}}>{copied === l.url ? <><Icon.Check size={13}/> Copiado</> : "Copiar"}</button>
                <button className="btn btn-ghost" onClick={()=> revoke(l.slug)} style={{padding:"7px 12px", fontSize:13, color:"#d70015"}}>Desativar</button>
              </div>
            ))}
          </div>
        ) : <HomeEmpty text="Nenhum link ativo. Abra um dashboard e toque em “Compartilhar” para criar o primeiro."/>}
    </>
  );
}

function HomeUsage({ currentUser, limits, items, keep, links }){
  const plan = currentUser.plan || "free";
  const isPaid = plan !== "free";
  const end = currentUser.currentPeriodEnd ? new Date(currentUser.currentPeriodEnd) : null;
  const billing = !isPaid ? "Grátis, sem cartão"
    : !currentUser.billingMethod ? "Sem cobrança ativa"
    : (currentUser.billingMethod === "card" ? "Cartão" : "Pix/boleto") + " · " + (currentUser.billingCycle === "yearly" ? "anual" : "mensal")
      + (end && !isNaN(end) ? (currentUser.autoRenew === false ? " · acesso até " : " · renova em ") + end.toLocaleDateString("pt-BR") : "");
  const feats = [
    ["Exportar PDF e PNG", !!limits.canExport],
    ["Editar e adicionar blocos", isPaid],
    ["Links públicos", !!limits.shareLinks],
    ["Exportar sem a marca Dash", !!limits.removeBranding],
  ];
  return (
    <>
      <HomeHeader title="Plano e uso" sub="O que o seu plano inclui e quanto você já usou neste mês."
        action={<div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <button className="btn btn-ghost" onClick={()=> window.__dashOpenAccount?.("billing")}><Icon.Doc size={13}/> Faturamento</button>
          {plan !== "pro" && <button className="btn btn-primary" onClick={()=> window.__dashOpenPlans?.()}><Icon.Crown size={13}/> Ver planos</button>}
        </div>}/>
      <div className="card" style={{padding:"20px 22px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:14}}>
        <span style={{width:44, height:44, borderRadius:12, background: isPaid ? "#e7f7ef" : "var(--line-2)", color: isPaid ? "#0a5a30" : "var(--muted)", display:"inline-flex", alignItems:"center", justifyContent:"center"}}><Icon.Crown size={18}/></span>
        <div style={{flex:1, minWidth:200}}>
          <div style={{fontWeight:700, fontSize:20}}>Plano {dashPlanLabel(plan)}</div>
          <div style={{fontSize:13, color:"var(--muted)", marginTop:2}}>{billing}</div>
        </div>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:14, marginBottom:14}}>
        <HomeMeter label="Resumos com IA no mês" icon={<Icon.Sparkle size={13}/>} value={limits.aiUsed || 0} max={limits.aiMonthly || 0} hint="Renova no dia 1º"/>
        <HomeMeter label="Dashboards salvos" icon={<Icon.Chart size={13}/>} value={items ? items.length : 0} max={keep} color="#248a3d" hint="Neste navegador"/>
        <HomeMeter label="Linhas por base" icon={<Icon.Rows size={13}/>} value={limits.maxRows || 5000} max={null} color="#ff7849" hint="Tamanho máximo de arquivo"/>
        {limits.shareLinks && <HomeMeter label="Links ativos" icon={<Icon.Share size={13}/>} value={links ? links.length : 0} max={null} color="#5e5ce6" hint="Compartilhados por você"/>}
      </div>
      <div className="card" style={{padding:"6px 22px"}}>
        {feats.map(([n, ok], i) => (
          <div key={n} style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 0", borderTop: i ? "1px solid var(--line-2)" : "none"}}>
            <span style={{fontSize:14, color:"var(--ink-2)"}}>{n}</span>
            {ok ? <span className="chip" style={{background:"#e7f7ef", color:"#0a5a30", fontSize:11}}><Icon.Check size={11}/> Incluído</span>
              : <span className="chip" style={{background:"var(--line-2)", color:"var(--muted)", fontSize:11}}><Icon.Lock size={11}/> Não incluído</span>}
          </div>
        ))}
      </div>
    </>
  );
}

function HomeInstall({ status }){
  const [result, setResult] = React.useState(null);
  const install = async ()=>{ setResult(await window.DashPWA.install()); };
  const step = (n, text)=> (
    <div style={{display:"flex", gap:12, alignItems:"flex-start", padding:"10px 0"}}>
      <span className="mono" style={{width:24, height:24, borderRadius:999, background:"var(--brand-soft)", color:"var(--brand)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0}}>{n}</span>
      <span style={{fontSize:14, color:"var(--ink-2)", lineHeight:1.5}}>{text}</span>
    </div>
  );
  return (
    <>
      <HomeHeader title="Instalar o app" sub="O Dash funciona como aplicativo no celular e no computador, sem loja de apps."/>
      <div className="card" style={{padding:"22px", marginBottom:14}}>
        {status === "installed" ? (
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <span className="chip" style={{background:"#e7f7ef", color:"#0a5a30"}}><Icon.Check size={12}/> Instalado</span>
            <span style={{fontSize:14, color:"var(--ink-2)"}}>Você já está usando o app instalado.</span>
          </div>
        ) : status === "available" ? (
          <div style={{display:"flex", alignItems:"center", gap:14, flexWrap:"wrap"}}>
            <button className="btn btn-primary" onClick={install}><Icon.Download size={14}/> Instalar o Dash</button>
            <span style={{fontSize:13, color:"var(--muted)"}}>{result === "dismissed" ? "Instalação cancelada. Você pode tentar de novo." : "Leva poucos segundos e não ocupa quase nada."}</span>
          </div>
        ) : status === "ios" ? (
          <>
            <div style={{fontWeight:700, fontSize:15, marginBottom:4}}>No iPhone ou iPad (Safari)</div>
            {step(1, "Toque no botão Compartilhar (o quadrado com a seta para cima).")}
            {step(2, "Escolha “Adicionar à Tela de Início”.")}
            {step(3, "Toque em “Adicionar”. O ícone do Dash aparece com os outros apps.")}
          </>
        ) : (
          <>
            <div style={{fontWeight:700, fontSize:15, marginBottom:4}}>Pelo menu do navegador</div>
            {step(1, "No Chrome ou no Edge (computador ou Android), abra o menu ⋮ do navegador.")}
            {step(2, "Escolha “Instalar Dash” ou “Adicionar à tela inicial”. No computador, também aparece um ícone de instalar na barra de endereço.")}
            {step(3, "No Firefox para computador a instalação não é suportada: use o Chrome ou o Edge.")}
          </>
        )}
      </div>
      <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:14}}>
        {[
          [<Icon.Bolt size={16}/>, "Abre direto", "Ícone na tela inicial ou no menu Iniciar, em janela própria, sem abas."],
          [<Icon.Refresh size={16}/>, "Sempre atualizado", "Cada vez que abre, carrega a versão mais nova. Não precisa atualizar nada."],
          [<Icon.Lock size={16}/>, "Mesma privacidade", "Os arquivos continuam sendo tratados no aparelho, como no site."],
        ].map(([ic, t, d]) => (
          <div key={t} className="card" style={{padding:"18px"}}>
            <span style={{color:"var(--brand)"}}>{ic}</span>
            <div style={{fontWeight:700, fontSize:14, margin:"8px 0 4px"}}>{t}</div>
            <div style={{fontSize:13, color:"var(--muted)", lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>
    </>
  );
}

Object.assign(window, { HomeView });
