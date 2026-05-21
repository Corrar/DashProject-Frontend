/* App root — view switcher + tweaks + Supabase auth glue. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brandName": "Dash",
  "accent": "#2f6bff",
  "view": "landing",
  "plan": "free"
}/*EDITMODE-END*/;

function App(){
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = React.useState("landing"); // landing -> upload -> prompt -> dashboard -> plans -> account (auth view lands in commit 3)
  const [fileInfo, setFileInfo] = React.useState(null);
  // currentUser is hydrated from Supabase Auth + profiles. null while
  // anonymous; populated as { id, email, plan, fullName, stripeCustomerId }
  // once the user signs in. See CLAUDE.md §17.
  const [currentUser, setCurrentUser] = React.useState(null);
  const [authModal, setAuthModal] = React.useState({ open: false, tab: "signin" });
  const [profileOpen, setProfileOpen] = React.useState(false);
  // Navigation memory for the secondary views (plans / account). returnView
  // is the screen the user came from so the back button restores it.
  // accountSection picks the AccountView sidebar tab to show on entry.
  const [accountSection, setAccountSection] = React.useState("account");
  const [returnView, setReturnView] = React.useState("landing");
  useScrollProgress();
  useReveal(view);

  React.useEffect(()=>{
    document.documentElement.style.setProperty("--brand", tweaks.accent);
  }, [tweaks.accent]);
  React.useEffect(()=>{
    window.scrollTo({top:0, behavior:"auto"});
  }, [view]);

  // Read the `profiles` row for the signed-in user and shape it into the
  // local currentUser model. RLS keeps this scoped to the user's own row.
  const loadUserProfile = React.useCallback(async (userId)=>{
    const supa = window.supabaseClient;
    if(!supa) return;
    try {
      const { data, error } = await supa
        .from("profiles")
        .select("id, email, plan, full_name, stripe_customer_id")
        .eq("id", userId)
        .single();
      if(error){
        // eslint-disable-next-line no-console
        console.error("[Auth] loadUserProfile:", error.message);
        return;
      }
      if(data){
        setCurrentUser({
          id: data.id,
          email: data.email,
          plan: data.plan || "free",
          fullName: data.full_name,
          stripeCustomerId: data.stripe_customer_id,
        });
      }
    } catch(e){
      // eslint-disable-next-line no-console
      console.error("[Auth] loadUserProfile threw:", e);
    }
  }, []);

  // Bootstrap: pick up an existing session on mount and subscribe to auth
  // events. Signed-in → hydrate currentUser from profiles. Signed-out →
  // clear currentUser. Subscription is cleaned up on unmount.
  React.useEffect(()=>{
    const supa = window.supabaseClient;
    if(!supa){
      // eslint-disable-next-line no-console
      console.warn("[Auth] window.supabaseClient ausente — verifique o init em Dash.html.");
      return undefined;
    }
    supa.auth.getSession().then(({ data })=>{
      const session = data && data.session;
      if(session && session.user){ loadUserProfile(session.user.id); }
    }).catch((e)=>{
      // eslint-disable-next-line no-console
      console.error("[Auth] getSession threw:", e);
    });
    const sub = supa.auth.onAuthStateChange((_event, session)=>{
      if(session && session.user){
        loadUserProfile(session.user.id);
        // Close the auth modal if it was open — sign-in just succeeded.
        setAuthModal((m)=> m.open ? { ...m, open: false } : m);
      } else {
        setCurrentUser(null);
      }
    });
    return ()=>{
      const subscription = sub && sub.data && sub.data.subscription;
      if(subscription && subscription.unsubscribe){ subscription.unsubscribe(); }
    };
  }, [loadUserProfile]);

  // Plan resolution: anonymous visitors are always "free" — the tweaks
  // panel's plan toggle no longer affects the paywall (security spec, see
  // CLAUDE.md §17). The toggle stays in the UI as a dev-only relic; to test
  // Pro behavior end-to-end, edit profiles.plan in the Supabase dashboard
  // (CLAUDE.md §18).
  const userPlan = (currentUser && currentUser.plan) || "free";
  const effectiveTweaks = { ...tweaks, plan: userPlan };

  const openApp = ()=> setView("upload");

  // "Ver demonstração": parses the bundled CSV, hydrates fileInfo with
  // isDemo:true and jumps straight to the dashboard, bypassing upload+prompt.
  const loadDemo = ()=>{
    try {
      const parsed = dashParseCSV(DASH_SAMPLE_CSV);
      const schema = dashInferSchema(parsed.header, parsed.rows);
      const data = dashRowsToObjects(parsed.header, parsed.rows, schema);
      setFileInfo({
        name: "dados_demonstracao.csv",
        sizeKB: Math.max(1, Math.round(DASH_SAMPLE_CSV.length / 1024)),
        rows: data.length,
        cols: parsed.header.length,
        schema, data,
        isDemo: true,
      });
      setView("dashboard");
    } catch(e){
      // eslint-disable-next-line no-console
      console.error("Falha ao carregar dados de demonstração:", e);
    }
  };

  // Auth UI handlers wired into AuthBubble / Topbar.
  const onSignIn = ()=> setAuthModal({ open: true, tab: "signin" });
  const onSignUp = ()=> setAuthModal({ open: true, tab: "signup" });
  const onSignOut = async ()=>{
    const supa = window.supabaseClient;
    if(supa && supa.auth){ await supa.auth.signOut(); }
    setCurrentUser(null);
    setProfileOpen(false);
  };
  const onProfile = ()=> setProfileOpen(true);

  // Secondary-view navigation. Remember where the user came from so the
  // back button on PlansView/AccountView restores that view instead of
  // dumping people on the landing.
  const openPlans = ()=>{
    setReturnView(view==="plans" || view==="account" ? returnView : view);
    setView("plans");
  };
  const openAccount = (section="account")=>{
    setReturnView(view==="plans" || view==="account" ? returnView : view);
    setAccountSection(section);
    setView("account");
  };
  const closeSecondary = ()=> setView(returnView || "landing");

  return (
    <>
      {view==="landing" && <Landing onOpenApp={openApp} onLoadDemo={loadDemo} tweaks={effectiveTweaks} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>}
      {view==="upload" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>
          <UploadView onUploaded={(info)=>{ setFileInfo(info); setView("prompt"); }}/>
        </div>
      )}
      {view==="prompt" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>
          <PromptView onGenerate={()=>setView("dashboard")} onBack={()=>setView("upload")} fileInfo={fileInfo}/>
        </div>
      )}
      {view==="dashboard" && <Dashboard onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>}
      {view==="plans" && <PlansView tweaks={effectiveTweaks} currentUser={currentUser}
        onSelectPro={()=>{
          // Stripe Checkout lands in a future sprint (CLAUDE.md §15).
          // For now: anonymous users get bounced into signup, logged-in users
          // see a placeholder. Plan flips happen server-side via webhook —
          // never mutate currentUser.plan from the client.
          if(!currentUser) return onSignUp();
          window.alert("Checkout do Stripe em breve.");
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
  const isPro = currentUser.plan === "pro";
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
                background: isPro ? "#e7f7ef" : "var(--line-2)",
                color: isPro ? "#0a5a30" : "var(--ink-2)",
                fontSize:11, fontWeight:700,
              }}>
                {isPro ? <><Icon.Crown size={11}/> Pro</> : "Free"}
              </span>
            }/>
            {currentUser.stripeCustomerId && (
              <ProfileRow label="Stripe ID" value={<span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{currentUser.stripeCustomerId}</span>}/>
            )}
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
