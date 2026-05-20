/* App root — view switcher + tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brandName": "Dash",
  "accent": "#2f6bff",
  "view": "landing",
  "plan": "free"
}/*EDITMODE-END*/;

function App(){
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = React.useState("landing"); // landing -> upload -> prompt -> dashboard
  const [fileInfo, setFileInfo] = React.useState(null);
  // currentUser is a scaffold for the upcoming Supabase Auth integration. Stays
  // null while the user is anonymous; once auth lands it will hold the row
  // shape described in CLAUDE.md §17 ({ id, email, plan, stripe_customer_id?, created_at }).
  const [currentUser, setCurrentUser] = React.useState(null);
  useScrollProgress();
  useReveal(view);

  React.useEffect(()=>{
    document.documentElement.style.setProperty("--brand", tweaks.accent);
  }, [tweaks.accent]);
  React.useEffect(()=>{
    window.scrollTo({top:0, behavior:"auto"});
  }, [view]);

  // Effective plan: authenticated user's plan wins, then the Tweaks override
  // (useful for testing the paywall in the browser), then "free" as the floor.
  const userPlan = currentUser?.plan ?? tweaks.plan ?? "free";
  // Mirror userPlan back into the tweaks shape so existing consumers
  // (Dashboard's isFree check, paywall logic) keep working unchanged.
  const effectiveTweaks = { ...tweaks, plan: userPlan };

  const openApp = ()=> setView("upload");

  // "Ver demonstração": parses the bundled CSV, hydrates fileInfo with
  // isDemo:true and jumps straight to the dashboard, bypassing upload+prompt.
  // Uses the same parser/inferer the real upload path uses.
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
      // Surface in console only — the demo path is best-effort and shouldn't
      // break the landing if the bundled CSV ever becomes malformed.
      // eslint-disable-next-line no-console
      console.error("Falha ao carregar dados de demonstração:", e);
    }
  };

  // Auth scaffolding — stubs for the Supabase Auth integration that's queued
  // up for the next phase. The buttons in the Topbar / Nav fire these, which
  // currently just log. When Supabase lands, swap the bodies for actual auth
  // calls and have onSignedIn flip setCurrentUser.
  const onSignIn = ()=>{
    // eslint-disable-next-line no-console
    console.log("[Auth] Entrar — stub. Supabase Auth chega na próxima fase.");
  };
  const onSignOut = ()=>{
    // eslint-disable-next-line no-console
    console.log("[Auth] Sair — stub. Limpar sessão Supabase quando integrar.");
    setCurrentUser(null);
  };
  const onProfile = ()=>{
    // eslint-disable-next-line no-console
    console.log("[Auth] Perfil — stub. Abrirá página /perfil quando integrar.");
  };

  return (
    <>
      {view==="landing" && <Landing onOpenApp={openApp} onLoadDemo={loadDemo} tweaks={effectiveTweaks} currentUser={currentUser} onSignIn={onSignIn} onSignOut={onSignOut} onProfile={onProfile}/>}
      {view==="upload" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignOut={onSignOut} onProfile={onProfile}/>
          <UploadView onUploaded={(info)=>{ setFileInfo(info); setView("prompt"); }}/>
        </div>
      )}
      {view==="prompt" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignOut={onSignOut} onProfile={onProfile}/>
          <PromptView onGenerate={()=>setView("dashboard")} onBack={()=>setView("upload")} fileInfo={fileInfo}/>
        </div>
      )}
      {view==="dashboard" && <Dashboard onClose={()=>setView("landing")} tweaks={effectiveTweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignOut={onSignOut} onProfile={onProfile}/>}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Visão">
          <TweakSelect label="Fluxo" value={view} onChange={setView}
            options={[{value:"landing", label:"Landing"},{value:"upload", label:"Upload"},{value:"prompt", label:"Prompt"},{value:"dashboard", label:"Dashboard"}]}/>
        </TweakSection>
        <TweakSection label="Marca">
          <TweakText label="Nome" value={tweaks.brandName} onChange={v=>setTweak("brandName", v)}/>
          <TweakColor label="Cor de destaque" value={tweaks.accent} onChange={v=>setTweak("accent", v)}
            options={["#2f6bff","#0a8a4a","#7a5cff","#ff5e93","#ff7849","#0b1020"]}/>
        </TweakSection>
        <TweakSection label="Plano">
          <TweakRadio label="Tier" value={tweaks.plan} onChange={v=>setTweak("plan", v)}
            options={[{value:"free", label:"Free"},{value:"pro", label:"Pro"}]}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
