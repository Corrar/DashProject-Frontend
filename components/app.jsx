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
  useScrollProgress();
  useReveal(view);

  React.useEffect(()=>{
    document.documentElement.style.setProperty("--brand", tweaks.accent);
  }, [tweaks.accent]);
  React.useEffect(()=>{
    window.scrollTo({top:0, behavior:"auto"});
  }, [view]);

  const openApp = ()=> setView("upload");

  return (
    <>
      {view==="landing" && <Landing onOpenApp={openApp} tweaks={tweaks}/>}
      {view==="upload" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={tweaks} fileInfo={fileInfo}/>
          <UploadView onUploaded={(info)=>{ setFileInfo(info); setView("prompt"); }}/>
        </div>
      )}
      {view==="prompt" && (
        <div style={{minHeight:"100vh", background:"var(--bg)"}}>
          <Topbar onClose={()=>setView("landing")} tweaks={tweaks} fileInfo={fileInfo}/>
          <PromptView onGenerate={()=>setView("dashboard")} onBack={()=>setView("upload")} fileInfo={fileInfo}/>
        </div>
      )}
      {view==="dashboard" && <Dashboard onClose={()=>setView("landing")} tweaks={tweaks} fileInfo={fileInfo}/>}

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
