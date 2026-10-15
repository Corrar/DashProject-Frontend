/* App root — view switcher + tweaks + auth glue (backend próprio via DashAPI). */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brandName": "Dash",
  "accent": "#2f6bff",
  "view": "landing",
  "plan": "free"
}/*EDITMODE-END*/;

function App(){
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // ?s=<slug> abre a página pública de um dashboard compartilhado (share-view.jsx).
  const [shareSlug] = React.useState(()=> new URLSearchParams(window.location.search).get("s"));
  const [view, setView] = React.useState(shareSlug ? "shared" : "landing"); // landing | upload | prompt | dashboard | auth | plans | account | shared
  const [fileInfo, setFileInfo] = React.useState(null);
  // currentUser is hydrated from the backend (DashAPI.me). null while
  // anonymous; populated as { id, email, plan, fullName, emailVerified, limits }
  // once the user signs in. See CLAUDE.md §17.
  const [currentUser, setCurrentUser] = React.useState(null);
  // AuthModal stays as a fallback surface (paywall/inline flows). Primary
  // entry into auth is now the routed AuthView (view==="auth").
  const [authModal, setAuthModal] = React.useState({ open: false, tab: "signin" });
  const [authMode, setAuthMode] = React.useState("login"); // login | signup — drives AuthView tab
  const [profileOpen, setProfileOpen] = React.useState(false);
  // Navigation memory for the secondary views (auth / plans / account).
  // returnView is the screen the user came from so the back button restores
  // it. accountSection picks the AccountView sidebar tab to show on entry.
  const [accountSection, setAccountSection] = React.useState("account");
  const [returnView, setReturnView] = React.useState("landing");
  const [plansCycle, setPlansCycle] = React.useState(null); // ciclo pré-selecionado na PlansView (CTA da landing)
  const isSecondaryView = (v)=> v==="plans" || v==="account" || v==="auth";
  useScrollProgress();
  useReveal(view);

  React.useEffect(()=>{
    document.documentElement.style.setProperty("--brand", tweaks.accent);
  }, [tweaks.accent]);
  React.useEffect(()=>{
    window.scrollTo({top:0, behavior:"auto"});
    window.dashTrackView && window.dashTrackView(view); // Vercel Web Analytics (index.html)
  }, [view]);

  // Hidrata currentUser a partir do backend (/me). Inclui `limits` p/ gates de UX.
  // Obs.: DashAPI.me() também emite via onAuthChange, então o listener do bootstrap
  // abaixo recebe este mesmo user — tudo bem, ele é guardado p/ não re-buscar.
  const loadUserProfile = React.useCallback(async ()=>{
    try {
      const me = await window.DashAPI.me();
      if(me){
        setCurrentUser(dashToCurrentUser(me));
      } else {
        setCurrentUser(null);
      }
    } catch(e){
      // eslint-disable-next-line no-console
      console.error("[Auth] me() falhou:", e);
    }
  }, []);

  // Bootstrap: hidrata UMA vez no mount; depois reage aos eventos de auth que o
  // DashAPI emite (login/signup/logout e o refresh do me()).
  //
  // Guarda anti-loop: DashAPI.me() TAMBÉM emite via onAuthChange. Se este listener
  // chamasse loadUserProfile() (→ me()) sempre, esse emit re-entraria o listener →
  // loadUserProfile() → me() → … pra sempre. Então:
  //   • seta currentUser direto do `user` que o evento traz (sem fetch);
  //   • só chama loadUserProfile() quando o `user` vem SEM o campo `limits`
  //     (payload de login/signup). O me() seguinte emite um user que JÁ tem limits,
  //     então a próxima passada do listener pula o re-fetch. Limitado a exatamente
  //     um /me extra, sem loop (cobre também limits:null, pois null !== undefined).
  React.useEffect(()=>{
    loadUserProfile();
    const off = window.DashAPI.onAuthChange((user)=>{
      if(user){
        setCurrentUser(dashToCurrentUser(user));
        if(user.limits === undefined){ loadUserProfile(); } // busca limits completos, 1x
        // Fecha o auth modal se estava aberto — login acabou de suceder.
        setAuthModal((m)=> m.open ? { ...m, open: false } : m);
      } else {
        setCurrentUser(null);
      }
    });
    return off;
  }, [loadUserProfile]);

  // Plan resolution: anonymous visitors are always "free" — the tweaks
  // panel's plan toggle no longer affects the paywall (security spec, see
  // CLAUDE.md §17). The toggle stays in the UI as a dev-only relic; to test
  // Pro behavior end-to-end, set the user's plan no backend (tabela profiles)
  // — o /me reflete o tier real (CLAUDE.md §18).
  const userPlan = (currentUser && currentUser.plan) || "free";
  const effectiveTweaks = { ...tweaks, plan: userPlan };

  // Dashboards salvos neste navegador (dashboard-saved.jsx), por dono.
  const savedOwner = currentUser ? currentUser.id : "anon";
  const savedKeep = userPlan === "free" ? DashSaved.KEEP.free : DashSaved.KEEP.paid;
  // Quem montou dashboards sem conta e entrou leva-os para a conta.
  React.useEffect(()=>{
    if(currentUser && currentUser.id) DashSaved.claim("anon", currentUser.id);
  }, [currentUser && currentUser.id]);

  // Prompt → Dashboard: leva a seleção de métricas e o foco da IA, e registra a
  // base nos dashboards salvos (só uploads reais, nunca a demonstração).
  const startDashboard = (opts)=>{
    if(!fileInfo){ setView("dashboard"); return; }
    const metricPick = opts && Array.isArray(opts.metrics) ? opts.metrics : null;
    const aiFocus = (opts && opts.focus) || "";
    const fi = { ...fileInfo, metricPick, aiFocus, savedLayout: null };
    if(!fi.isDemo && Array.isArray(fi.data) && fi.data.length){
      if(!fi.savedId){
        fi.savedId = "d-" + Date.now();
        DashSaved.create(fi.savedId, savedOwner, fi).then(ok => { if(ok) DashSaved.prune(savedOwner, savedKeep, fi.savedId); });
      } else {
        DashSaved.update(fi.savedId, { metricPick, aiFocus, layout: null });
      }
      window.dashTrack && window.dashTrack("dashboard_gerado", { linhas: dashRowsBucket(fi.data.length), selecao: metricPick ? "personalizada" : "padrao" });
    }
    setFileInfo(fi);
    setView("dashboard");
  };
  const openSaved = async (id)=>{
    const r = await DashSaved.load(id);
    if(!r){
      window.alert("Não foi possível abrir este dashboard. Envie o arquivo de novo.");
      return false;
    }
    // Mesmo limite do upload: base salva num plano maior não abre depois do downgrade.
    const maxRows = (currentUser && currentUser.limits && currentUser.limits.maxRows) || 5000;
    if(r.fileInfo.rows > maxRows){
      if(window.confirm("Esta base tem " + r.fileInfo.rows.toLocaleString("pt-BR") + " linhas e o seu plano permite até "
        + maxRows.toLocaleString("pt-BR") + " por base. Ver os planos?")) openPlans();
      return false;
    }
    setFileInfo(r.fileInfo);
    setView("dashboard");
    window.dashTrack && window.dashTrack("dashboard_reaberto");
    return true;
  };
  const persistDashboard = (patch)=>{
    if(fileInfo && fileInfo.savedId && DashSaved.enabled()) DashSaved.update(fileInfo.savedId, patch);
  };

  const openApp = ()=> setView("upload");

  // "Ver demonstração": parses the bundled CSV, hydrates fileInfo with
  // isDemo:true and jumps straight to the dashboard, bypassing upload+prompt.
  const loadDemo = ()=>{
    try {
      const parsed = dashParseCSV(DASH_SAMPLE_CSV);
      const schema = dashInferSchema(parsed.header, parsed.rows);
      const data = dashRowsToObjects(parsed.header, parsed.rows, schema);
      const profiles = window.dashProfileColumns ? window.dashProfileColumns(parsed.header, parsed.rows) : [];
      window.dashTrack && window.dashTrack("demo_aberta");
      setFileInfo({
        name: "dados_demonstracao.csv",
        sizeKB: Math.max(1, Math.round(DASH_SAMPLE_CSV.length / 1024)),
        rows: data.length,
        cols: parsed.header.length,
        schema, data, profiles,
        isDemo: true,
      });
      setView("dashboard");
    } catch(e){
      // eslint-disable-next-line no-console
      console.error("Falha ao carregar dados de demonstração:", e);
    }
  };

  // Secondary-view navigation. Remember where the user came from so the
  // back button on AuthView/PlansView/AccountView restores that view instead
  // of dumping people on the landing.
  const openAuth = (mode="login")=>{
    setReturnView(isSecondaryView(view) ? returnView : view);
    setAuthMode(mode === "signup" ? "signup" : "login");
    setView("auth");
  };
  const openPlans = (cycle)=>{
    setReturnView(isSecondaryView(view) ? returnView : view);
    setPlansCycle(cycle === "yearly" || cycle === "monthly" ? cycle : null);
    setView("plans");
  };
  const openAccount = (section="account")=>{
    setReturnView(isSecondaryView(view) ? returnView : view);
    setAccountSection(section);
    setView("account");
  };
  const closeSecondary = ()=> setView(returnView || "landing");

  // Auth UI handlers wired into AuthBubble / Topbar. Sign-in / sign-up now
  // route to the full-screen AuthView; the AuthModal stays mounted as a
  // fallback surface (paywall flows that prefer a popover instead of a route
  // change) but is no longer the primary entry.
  const onSignIn = ()=> openAuth("login");
  const onSignUp = ()=> openAuth("signup");
  const onSignOut = async ()=>{
    try { await window.DashAPI.logout(); }
    finally { setCurrentUser(null); setProfileOpen(false); }
  };
  const onProfile = ()=> setProfileOpen(true);

  // Expose navigation helpers on `window` so deep children (Landing CTAs,
  // Dashboard paywall, AuthBubble dropdown) can route without prop-drilling
  // every level. Always call with `?.()` at the call site so a missing
  // global is a silent no-op (e.g., on initial mount or during HMR).
  //
  // Intent split — keep `enterApp` and `upgrade` separate even though they
  // share the anon branch:
  //   enterApp  = "use the product" — logged users land on upload, anon
  //               funnels into signup so they can use it.
  //   upgrade   = "buy / explore Pro" — anon → signup, free → Plans, pro
  //               users already have Pro, so we send them to upload too.
  React.useEffect(()=>{
    const enterApp = ()=>{
      if(currentUser){ setView("upload"); }
      else { openAuth("signup"); }
    };
    const upgrade = (cycle)=>{
      if(!currentUser){ openAuth("signup"); }
      else if(currentUser.plan === "pro"){ setView("upload"); }
      else { openPlans(cycle); }
    };
    window.__dashOpenAuth    = (mode)=> openAuth(mode === "signup" ? "signup" : "login");
    window.__dashOpenPlans   = (cycle)=> openPlans(cycle);
    window.__dashOpenAccount = (section)=> openAccount(section || "account");
    window.__dashEnterApp    = enterApp;
    window.__dashUpgrade     = upgrade;
    window.__dashOpenLanding = ()=> setView("landing");
    return ()=>{
      delete window.__dashOpenAuth;
      delete window.__dashOpenPlans;
      delete window.__dashOpenAccount;
      delete window.__dashEnterApp;
      delete window.__dashUpgrade;
      delete window.__dashOpenLanding;
    };
    // The closures capture current view/returnView/currentUser via the
    // existing helpers, so re-run whenever any of those change.
  }, [view, returnView, currentUser]);

  return (
    <>
      {view==="shared" && <SharedView slug={shareSlug} tweaks={effectiveTweaks}
        onLeave={()=>{
          // Sai do link: limpa o ?s= e cai no funil (anônimo → cadastro).
          history.replaceState(null, "", window.location.pathname + window.location.hash);
          if(currentUser) setView("landing"); else openAuth("signup");
        }}/>}
      {view==="landing" && <Landing onOpenApp={openApp} onLoadDemo={loadDemo} tweaks={effectiveTweaks} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>}
      {view==="upload" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>
          <UploadView maxRows={(currentUser && currentUser.limits && currentUser.limits.maxRows) || 5000}
            onUploaded={(info)=>{ setFileInfo(info); setView("prompt"); }}>
            <SavedDashboards owner={savedOwner} isPaid={userPlan !== "free"} onOpen={openSaved}/>
          </UploadView>
        </div>
      )}
      {view==="prompt" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>
          <PromptView onGenerate={startDashboard} onBack={()=>setView("upload")} fileInfo={fileInfo}/>
        </div>
      )}
      {view==="dashboard" && <Dashboard onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}
        onPersist={persistDashboard}/>}
      {view==="auth" && <AuthView mode={authMode} onMode={setAuthMode}
        tweaks={effectiveTweaks}
        onSuccess={()=>{
          window.dashTrack && window.dashTrack(authMode === "signup" ? "cadastro" : "login");
          setView(returnView && returnView !== "landing" && returnView !== "shared" ? returnView : "upload");
        }}
        onClose={closeSecondary}/>}
      {view==="plans" && <PlansView tweaks={effectiveTweaks} currentUser={currentUser} initialCycle={plansCycle}
        onChangePlan={(plan, cycle)=> dashChangePlan(plan, cycle, currentUser)}
        onSelectPlan={async (plan, method, cycle)=>{
          // plan: 'essencial'|'pro'  method: 'card'|'pix'  cycle: 'monthly'|'yearly'
          // Anônimo → cadastro primeiro. O flip de plano acontece no servidor
          // via webhook — nunca mutar currentUser.plan no cliente.
          // Retorna true quando o redirect pro Asaas começou (PlansView mantém
          // os botões travados) e false em erro.
          if(!currentUser){ onSignUp(); return false; }
          try {
            window.dashTrack && window.dashTrack("checkout_iniciado", { plano: plan, metodo: method, ciclo: cycle || "monthly" });
            await window.DashAPI.checkout(plan, method, cycle); // redireciona pro Asaas
            return true;
          } catch(err){
            window.alert(checkoutErrorMessage(err));
            return false;
          }
        }}
        onClose={closeSecondary}/>}
      {view==="account" && <AccountView tweaks={effectiveTweaks} setTweak={setTweak} currentUser={currentUser}
        section={accountSection} onSection={setAccountSection}
        onClose={closeSecondary}/>}

      <AuthModal open={authModal.open} initialTab={authModal.tab}
        onClose={()=> setAuthModal({ open: false, tab: authModal.tab })}
        tweaks={effectiveTweaks}/>

      <ProfileModal open={profileOpen} currentUser={currentUser}
        onClose={()=> setProfileOpen(false)} onSignOut={onSignOut} tweaks={effectiveTweaks}/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Visão">
          <TweakSelect label="Fluxo" value={view} onChange={setView}
            options={[
              {value:"landing", label:"Landing"},
              {value:"upload", label:"Upload"},
              {value:"prompt", label:"Prompt"},
              {value:"dashboard", label:"Dashboard"},
              {value:"auth", label:"Auth"},
              {value:"plans", label:"Planos"},
              {value:"account", label:"Conta"},
            ]}/>
        </TweakSection>
        <TweakSection label="Marca">
          <TweakText label="Nome" value={tweaks.brandName} onChange={v=>setTweak("brandName", v)}/>
          <TweakColor label="Cor de destaque" value={tweaks.accent} onChange={v=>setTweak("accent", v)}
            options={["#2f6bff","#0a8a4a","#7a5cff","#ff5e93","#ff7849","#0b1020"]}/>
        </TweakSection>
        <TweakSection label="Plano (override de testes — só efeito sem auth)">
          <TweakRadio label="Tier" value={tweaks.plan} onChange={v=>setTweak("plan", v)}
            options={[{value:"free", label:"Free"},{value:"pro", label:"Pro"}]}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Payload do backend (/me, login, signup) → currentUser. billingMethod,
// currentPeriodEnd, billingCycle e autoRenew só vêm do /me (login/signup não têm).
function dashToCurrentUser(u){
  return {
    id: u.id,
    email: u.email,
    plan: u.plan || "free",
    fullName: u.fullName,
    emailVerified: u.emailVerified,
    limits: u.limits || null,
    billingMethod: u.billingMethod || null,
    currentPeriodEnd: u.currentPeriodEnd || null,
    billingCycle: u.billingCycle || null,      // 'monthly' | 'yearly' (null no Free)
    autoRenew: u.autoRenew == null ? null : !!u.autoRenew, // false = cancelou, acesso até currentPeriodEnd
  };
}

// Faixa de tamanho da base para analytics (nunca o nome nem o conteúdo).
function dashRowsBucket(n){
  return n <= 1000 ? "ate_1k" : n <= 5000 ? "ate_5k" : n <= 100000 ? "ate_100k" : "acima_100k";
}

// Troca de tier e/ou ciclo na assinatura do cartão (POST /billing/change-plan).
async function dashChangePlan(plan, cycle, currentUser){
  const curPlan = (currentUser && currentUser.plan) || "free";
  const curCycle = (currentUser && currentUser.billingCycle) || "monthly";
  const nextCycle = cycle || curCycle;
  const rank = { free:0, essencial:1, pro:2 };
  const name = plan === "pro" ? "Pro" : "Essencial";
  const curName = curPlan === "pro" ? "Pro" : curPlan === "essencial" ? "Essencial" : "plano atual";
  const cycleWord = nextCycle === "yearly" ? "anual" : "mensal";
  const price = dashFmtBRL(DASH_PRICES[plan][nextCycle]) + (nextCycle === "yearly" ? " por ano" : " por mês");
  const end = currentUser && currentUser.currentPeriodEnd ? new Date(currentUser.currentPeriodEnd) : null;
  const when = end && !isNaN(end) ? " em " + end.toLocaleDateString("pt-BR") : "";
  const upgrade = rank[plan] > rank[curPlan];
  const sameTier = plan === curPlan;
  const ok = window.confirm(upgrade
    ? "Mudar para o " + name + " " + cycleWord + " agora? Os recursos do " + name + " liberam na hora e a próxima cobrança no cartão" + when + " já vem com " + price + "."
    : sameTier
      ? "Mudar o " + name + " para o plano " + cycleWord + "? Nada muda até a próxima cobrança no cartão" + when + ", que virá com " + price + "."
      : "Mudar para o " + name + " " + cycleWord + "? Você continua no " + curName + " até a próxima cobrança no cartão" + when + ", que virá com " + price + ".");
  if(!ok) return false;
  try {
    const r = await window.DashAPI.changePlan(plan, nextCycle);
    window.dashTrack && window.dashTrack("plano_trocado", { plano: plan, ciclo: nextCycle });
    await window.DashAPI.me().catch(()=>{});
    window.alert(r && r.effective === "now"
      ? "Pronto! Seu plano agora é " + name + " " + cycleWord + "."
      : "Combinado. A mudança para o " + name + " " + cycleWord + " vale a partir da próxima cobrança.");
    return true;
  } catch(err){
    const code = err && err.data && err.data.error;
    window.alert(code === "sem_assinatura_cartao"
      ? "Seu plano é pago via Pix. Para trocar, assine o novo plano no Pix."
      : code === "assinatura_cancelada" ? "Sua assinatura foi cancelada. Assine de novo na página de planos para trocar."
      : code === "plano_ja_ativo" ? "Você já está neste plano."
      : "Não foi possível trocar o plano agora. Tente novamente em instantes.");
    return false;
  }
}

// Mensagens dos erros de POST /billing/checkout (sem isso o clique falhava em
// silêncio — promessa rejeitada sem catch).
function checkoutErrorMessage(err){
  const code = err && err.data && err.data.error;
  if(code === "plano_ja_ativo") return "Seu plano atual já inclui este plano.";
  if(code === "assinatura_ativa") return "Você já tem uma assinatura no cartão. Use \"Mudar para este plano\" na página de planos.";
  if(err && err.status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if(!err || !err.status) return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  return "Não foi possível abrir o pagamento agora. Tente novamente em instantes.";
}

// Minimal account info modal. Triggered by AuthBubble's "Meu perfil" item.
// Shows the user's email, plan, and a Sair button. Future iteration: link to
// Stripe Customer Portal for plan management, delete-account flow (LGPD).
function ProfileModal({ open, currentUser, onClose, onSignOut, tweaks }){
  React.useEffect(()=>{
    if(!open) return undefined;
    const onKey = (e)=>{ if(e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return ()=>{
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if(!open || !currentUser) return null;
  const accent = (tweaks && tweaks.accent) || "var(--brand)";
  const isPaid = currentUser.plan === "pro" || currentUser.plan === "essencial";
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:125,
      background:"rgba(11,16,32,.55)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
    }}>
      <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true"
        style={{
          width:"min(420px, 100%)", background:"white", borderRadius:18,
          boxShadow:"0 40px 80px -20px rgba(11,16,32,.5)", overflow:"hidden",
        }}>
        <div style={{padding:"22px 24px 18px", borderBottom:"1px solid var(--line-2)", position:"relative"}}>
          <button onClick={onClose} aria-label="Fechar" style={{
            position:"absolute", top:14, right:14, width:30, height:30, borderRadius:8,
            background:"transparent", color:"var(--muted)", border:0, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center"
          }}><Icon.X size={16}/></button>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <div style={{
              width:44, height:44, borderRadius:"50%",
              background:`linear-gradient(135deg, ${accent}, var(--violet))`,
              color:"white", fontWeight:700, fontSize:18,
              display:"inline-flex", alignItems:"center", justifyContent:"center",
            }}>{String((currentUser.email || "?")[0]).toUpperCase()}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:11, color:"var(--muted)", fontWeight:600, letterSpacing:".05em", textTransform:"uppercase"}}>Conta</div>
              <div style={{fontSize:15, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                {currentUser.fullName || currentUser.email}
              </div>
            </div>
          </div>
        </div>
        <div style={{padding:"18px 24px"}}>
          <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:18}}>
            <ProfileRow label="E-mail" value={currentUser.email || "—"}/>
            <ProfileRow label="Plano" value={
              <span className="chip" style={{
                background: isPaid ? "#e7f7ef" : "var(--line-2)",
                color: isPaid ? "#0a5a30" : "var(--ink-2)",
                fontSize:11, fontWeight:700,
              }}>
                {isPaid && <Icon.Crown size={11}/>} {dashPlanLabel(currentUser.plan)}
              </span>
            }/>
          </div>
          <button onClick={onSignOut} className="btn btn-ghost"
            style={{width:"100%", justifyContent:"center", padding:"10px"}}>
            <Icon.Arrow size={14} style={{transform:"rotate(180deg)"}}/> Sair
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }){
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, padding:"6px 0"}}>
      <span style={{fontSize:12, color:"var(--muted)", fontWeight:600}}>{label}</span>
      <span style={{fontSize:13, color:"var(--ink-2)"}}>{value}</span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
