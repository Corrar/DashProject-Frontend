/* Landing — heavy scroll choreography. */

function useScrollProgress(){
  React.useEffect(()=>{
    const el = document.getElementById("scroll-progress");
    const onScroll = ()=>{
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max>0 ? (window.scrollY/max)*100 : 0;
      if(el) el.style.width = p+"%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return ()=> window.removeEventListener("scroll", onScroll);
  }, []);
}

function useReveal(dep){
  React.useEffect(()=>{
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    const scan = ()=> document.querySelectorAll(".rv:not(.in)").forEach(el=>io.observe(el));
    scan();
    // Re-scan on minor DOM changes (view swaps)
    const mo = new MutationObserver(()=> scan());
    mo.observe(document.body, { subtree: true, childList: true });
    return ()=>{ io.disconnect(); mo.disconnect(); };
  }, [dep]);
}

function useScrollY(){
  const [y, setY] = React.useState(0);
  React.useEffect(()=>{
    let raf = 0;
    const on = ()=>{
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=> setY(window.scrollY));
    };
    window.addEventListener("scroll", on, { passive: true });
    on();
    return ()=> window.removeEventListener("scroll", on);
  }, []);
  return y;
}

// Count-up animator. Runs exactly once per mount: when `when` flips to true,
// the animation starts from 0 and eases to `target` over `ms`. Guarded by a
// ref so the closure's target stays stable across re-renders. A previous
// rewrite tried to re-animate on target change by writing to a ref during
// render — that fought React 18's render/commit pipeline and the visual froze
// at intermediate frames while the underlying state actually reached the
// target. The trade-off here: if `target` ever changes after the animation
// kicks off, the display does NOT follow the new value. That's acceptable for
// today's Dashboard, where the KPI target is derived from realAgg which is
// stable from mount per visit.
function useCount(target, when, ms=1400){
  const [v, setV] = React.useState(0);
  const started = React.useRef(false);
  React.useEffect(()=>{
    if(!when || started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = (t)=>{
      const p = Math.min(1, (t-start)/ms);
      const eased = 1 - Math.pow(1-p, 3);
      setV(target * eased);
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [when, target]);
  return v;
}

// Reusable auth control. While unauthenticated → "Entrar" / "Criar conta"
// buttons that route to the AuthView via window.__dashOpenAuth. Once
// authenticated → an avatar bubble with the email's first letter that opens
// a small menu with shortcuts to AccountView, PlansView, and signOut. See
// CLAUDE.md §17 for the currentUser shape.
function AuthBubble({ currentUser, onSignIn, onSignUp, onSignOut, onProfile, accent = "var(--brand)" }){
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(()=>{
    if(!open) return undefined;
    const close = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    setTimeout(()=> document.addEventListener("click", close), 0);
    return ()=> document.removeEventListener("click", close);
  }, [open]);
  if(!currentUser){
    return (
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <button className="btn btn-ghost" onClick={onSignIn}>Entrar</button>
        {onSignUp && (
          <button className="btn btn-ghost" onClick={onSignUp}
            style={{color:"var(--ink)", fontWeight:600}}>
            Criar conta
          </button>
        )}
      </div>
    );
  }
  const initial = String((currentUser.email || "?")[0] || "?").toUpperCase();
  const menuItemStyle = {
    display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
    width:"100%", border:0, background:"transparent", borderRadius:6,
    cursor:"pointer", fontSize:13, color:"var(--ink-2)", textAlign:"left",
  };
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={(e)=>{ e.stopPropagation(); setOpen(o=>!o); }}
        title={currentUser.email || "Conta"}
        style={{
          width:36, height:36, borderRadius:"50%",
          background:`linear-gradient(135deg, ${accent}, var(--violet))`,
          color:"white", fontWeight:700, fontSize:14,
          border:0, cursor:"pointer",
          display:"inline-flex", alignItems:"center", justifyContent:"center",
        }}>{initial}</button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:60,
          minWidth:220, padding:6, background:"white",
          border:"1px solid var(--line)", borderRadius:12,
          boxShadow:"0 20px 40px -16px rgba(15,23,42,.25)",
        }}>
          <div style={{padding:"8px 10px 10px", borderBottom:"1px solid var(--line-2)", marginBottom:4}}>
            <div style={{fontSize:11, color:"var(--muted)"}}>Conta</div>
            <div style={{fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{currentUser.email}</div>
            {currentUser.plan && (
              <div style={{marginTop:6}}>
                <span className="chip" style={{
                  background: currentUser.plan === "pro" ? "#e7f7ef" : "var(--line-2)",
                  color: currentUser.plan === "pro" ? "#0a5a30" : "var(--ink-2)",
                  fontSize:10, fontWeight:700, gap:4,
                }}>
                  {currentUser.plan === "pro"
                    ? <><Icon.Crown size={10}/> Plano: Pro</>
                    : <>Plano: Free</>}
                </span>
              </div>
            )}
          </div>
          <button onClick={()=>{ setOpen(false); window.__dashOpenAccount?.(); }} style={menuItemStyle}
            onMouseEnter={e=>e.currentTarget.style.background="var(--line-2)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <Icon.Wand size={14}/> Configurações
          </button>
          <button onClick={()=>{ setOpen(false); window.__dashOpenPlans?.(); }} style={menuItemStyle}
            onMouseEnter={e=>e.currentTarget.style.background="var(--line-2)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <Icon.Crown size={14}/> Planos
          </button>
          <hr style={{border:0, borderTop:"1px solid var(--line-2)", margin:"4px 0"}}/>
          <button onClick={()=>{ setOpen(false); onSignOut && onSignOut(); }} style={menuItemStyle}
            onMouseEnter={e=>e.currentTarget.style.background="var(--line-2)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <Icon.Arrow size={14} style={{transform:"rotate(180deg)"}}/> Sair
          </button>
        </div>
      )}
    </div>
  );
}

function Nav({ onOpenApp, tweaks, currentUser, onSignIn, onSignUp, onSignOut, onProfile }){
  const y = useScrollY();
  const scrolled = y > 20;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      backdropFilter: "blur(12px)",
      background: scrolled ? "rgba(246,247,251,.82)" : "transparent",
      borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
      transition: "background .25s ease, border-color .25s ease"
    }}>
      <div className="wrap nav-row" style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <Icon.Logo size={30}/>
          <div style={{display:"flex", flexDirection:"column", lineHeight:1}}>
            <span style={{fontWeight:700, fontSize:15}}>{tweaks.brandName}</span>
            <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>DASHBOARDS · IA</span>
          </div>
        </div>
        <nav className="nav-links" style={{display:"flex", gap:28, alignItems:"center"}}>
          <a href="#exemplos" style={{fontSize:14, color:"var(--ink-2)", fontWeight:500}}>Exemplos</a>
          <a href="#recursos" style={{fontSize:14, color:"var(--ink-2)", fontWeight:500}}>Recursos</a>
          <a href="#como" style={{fontSize:14, color:"var(--ink-2)", fontWeight:500}}>Como funciona</a>
          <a href="#planos" style={{fontSize:14, color:"var(--ink-2)", fontWeight:500}}>Planos</a>
        </nav>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <AuthBubble currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile} accent={tweaks.accent}/>
          <button className="btn btn-primary nav-cta" onClick={()=> window.__dashEnterApp?.()}>
            {currentUser ? <>Abrir app <Icon.Arrow size={14}/></> : <>Começar grátis <Icon.Arrow size={14}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroPreview({ tweaks }){
  const y = useScrollY();
  // Parallax of preview as we scroll
  const offset = Math.min(80, y*0.12);
  const tilt = Math.max(0, 6 - y*0.01);
  const ref = React.useRef(null);
  const [mx, setMx] = React.useState(0);
  const [my, setMy] = React.useState(0);
  const onMove = (e)=>{
    const r = ref.current.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width - 0.5;
    const cy = (e.clientY - r.top) / r.height - 0.5;
    setMx(cx); setMy(cy);
  };
  const onLeave = ()=>{ setMx(0); setMy(0); };
  const line = Array.from({length: 28}, (_,i)=>({ l: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul"][Math.floor(i/4)], v: 30 + i*2 + Math.sin(i/2)*8 + (i>15? i*1.5 : 0) }));
  return (
    <div className="tilt" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{
        position:"relative",
        transform: `perspective(1200px) rotateX(${tilt - my*4}deg) rotateY(${mx*4}deg) translateY(${-offset}px)`,
        transition: "transform .15s ease-out",
      }}>
      <div className="glow-ring"/>
      <div className="preview-shell">
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--line)"}}>
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <span className="chrome-dot" style={{background:"#ff5e5e"}}/>
            <span className="chrome-dot" style={{background:"#ffbe2e"}}/>
            <span className="chrome-dot" style={{background:"#27c93f"}}/>
          </div>
          <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>{tweaks.brandName.toLowerCase()}.app/dashboard/q3-vendas</div>
          <div style={{display:"flex", gap:8}}>
            <span className="icon-btn" style={{width:24, height:24, borderRadius:6}}><Icon.Share size={12}/></span>
            <span className="icon-btn" style={{width:24, height:24, borderRadius:6}}><Icon.More size={12}/></span>
          </div>
        </div>
        <div style={{padding:18, display:"grid", gap:14}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end"}}>
            <div>
              <div style={{fontSize:12, color:"var(--muted)", fontWeight:600, letterSpacing:".06em", textTransform:"uppercase"}}>Receita · Q3</div>
              <div style={{fontSize:36, fontWeight:800, letterSpacing:"-.02em"}}>R$ <span className="ticker">1,284M</span></div>
            </div>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <span className="chip" style={{background:"#e7f7ef", color:"#0a8a4a"}}>▲ 18,4%</span>
              <span className="chip">vs Q2</span>
            </div>
          </div>
          <div style={{height:180}}>
            <LineChart data={line} height={180} color={tweaks.accent} animate animDelay={.3}/>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr", gap:10}}>
            <div style={{padding:"12px 14px", border:"1px solid var(--line)", borderRadius:12, background:"#fafbfe"}}>
              <div style={{fontSize:11, color:"var(--muted)"}}>NPS</div>
              <div style={{fontSize:20, fontWeight:700}}>74</div>
              <div style={{height:18}}>
                <Sparkline data={[58,62,64,66,68,70,72,74]} color={tweaks.accent} height={18} width={140}/>
              </div>
            </div>
            <div style={{padding:"12px 14px", border:"1px solid var(--line)", borderRadius:12, background:"#fafbfe"}}>
              <div style={{fontSize:11, color:"var(--muted)"}}>Conversão</div>
              <div style={{fontSize:20, fontWeight:700}}>4,8%</div>
              <div style={{display:"flex", gap:3, alignItems:"flex-end", height:18}}>
                {[3,5,4,6,7,8,7,9].map((h,i)=><span key={i} style={{width:6, height:h*2, background:tweaks.accent, opacity:.6+i*0.05, borderRadius:2}}/>)}
              </div>
            </div>
            <div style={{padding:"12px 14px", border:"1px solid var(--line)", borderRadius:12, background:"#fafbfe"}}>
              <div style={{fontSize:11, color:"var(--muted)"}}>Ticket médio</div>
              <div style={{fontSize:20, fontWeight:700}}>R$ 219</div>
              <div className="mono" style={{fontSize:11, color:"#0a8a4a"}}>+12%</div>
            </div>
          </div>
        </div>
      </div>
      {/* floating cards */}
      <div className="float-card" style={{top:"-18px", right:"6%", transform:`translateY(${-offset*0.3}px) translateX(${mx*-20}px)`}}>
        <span style={{width:8, height:8, borderRadius:"50%", background:"var(--accent)"}}/> IA detectou tendência ↑
      </div>
      <div className="float-card" style={{bottom:"-18px", left:"-3%", transform:`translateY(${-offset*0.2}px) translateX(${mx*20}px)`, padding:"10px 14px"}}>
        <Icon.Sparkle size={14}/> 3 insights novos
      </div>
      <div className="float-card" style={{top:"40%", left:"-7%", transform:`translateY(${-offset*0.4}px) rotate(${mx*-3}deg)`, padding:"8px 12px"}}>
        <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>vendas.csv</span>
        <span className="chip" style={{padding:"2px 6px", background:"var(--brand-soft)", color:"var(--brand-2)"}}>1.284 linhas</span>
      </div>
    </div>
  );
}

function Hero({ onOpenApp, onLoadDemo, tweaks }){
  const y = useScrollY();
  return (
    <section style={{position:"relative", padding:"72px 24px 96px", overflow:"hidden"}}>
      <div className="hero-bg">
        <div className="grid-bg"/>
        <div className="hero-blob" style={{width:520, height:520, background: tweaks.accent, top: -120, right: -80, transform: `translateY(${y*0.15}px)`}}/>
        <div className="hero-blob" style={{width:380, height:380, background: "var(--violet)", top: 220, left: -120, opacity:.35, transform: `translateY(${y*0.08}px)`}}/>
      </div>
      <div className="wrap resp-collapse" style={{position:"relative", display:"grid", gridTemplateColumns:"1.05fr 1fr", gap:60, alignItems:"center"}}>
        <div>
          <div className="rv eyebrow" style={{marginBottom:18}}>
            <span className="dot"/> v2.6 · agora com narrativa por IA
          </div>
          <h1 className="rv rv-up h-display" style={{margin:"0 0 18px"}}>
            Da planilha ao<br/>
            <span style={{
              background: `linear-gradient(120deg, ${tweaks.accent} 0%, var(--violet) 100%)`,
              WebkitBackgroundClip:"text", color:"transparent",
            }}>dashboard</span> em segundos.
          </h1>
          <p className="rv lede" style={{margin:"0 0 28px", maxWidth: 520}}>
            Suba um CSV, JSON ou Excel. Descreva o que quer ver. O {tweaks.brandName} monta KPIs, gráficos e análises — e você edita visualmente. Sem código.
          </p>
          <div className="rv" style={{display:"flex", gap:12, marginBottom:24, flexWrap:"wrap"}}>
            <button className="btn btn-primary" onClick={()=> window.__dashEnterApp?.()}>Começar grátis <Icon.Arrow size={14}/></button>
            <button className="btn btn-ghost" onClick={onLoadDemo}><Icon.Sparkle size={12}/> Ver demonstração com dados de exemplo</button>
          </div>
          <div className="rv" style={{display:"flex", gap:18, flexWrap:"wrap"}}>
            {["Sem cartão", "CSV · JSON · Excel", "100% no navegador", "LGPD"].map(t=>(
              <span key={t} style={{display:"inline-flex", gap:6, alignItems:"center", color:"var(--muted)", fontSize:13}}>
                <Icon.Check size={14} stroke={2.4}/> {t}
              </span>
            ))}
          </div>
        </div>
        <div className="rv rv-scale rv-blur">
          <HeroPreview tweaks={tweaks}/>
        </div>
      </div>
    </section>
  );
}

function StatStrip(){
  const [vis, setVis] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVis(true); }, {threshold: 0.4});
    if(ref.current) io.observe(ref.current);
    return ()=>io.disconnect();
  }, []);
  const a = useCount(48000, vis);
  const b = useCount(12, vis);
  const c = useCount(99.4, vis);
  const d = useCount(7, vis);
  return (
    <section className="pad" style={{padding:"32px 24px 24px"}}>
      <div className="wrap rv" ref={ref}>
        <div className="strip soft-shadow">
          {[
            { k: Math.round(a).toLocaleString("pt-BR"), s:"dashboards gerados" },
            { k: b.toFixed(1)+"s", s:"tempo médio para o primeiro insight" },
            { k: c.toFixed(1)+"%", s:"uptime de processamento local" },
            { k: d.toFixed(0), s:"tipos de gráfico cobertos por padrão" },
          ].map((it,i)=>(
            <div key={i} style={{textAlign:"left"}}>
              <div className="ticker" style={{fontSize:30, fontWeight:800, letterSpacing:"-.02em"}}>{it.k}</div>
              <div style={{color:"var(--muted)", fontSize:13, marginTop:4}}>{it.s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Sticky pinned 3-step section — flagship scroll effect */
function PinnedSteps({ tweaks }){
  const wrapRef = React.useRef(null);
  const [progress, setProgress] = React.useState(0);
  React.useEffect(()=>{
    const onScroll = ()=>{
      if(!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = Math.max(0, Math.min(1, -r.top / total));
      setProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return ()=> window.removeEventListener("scroll", onScroll);
  }, []);

  const stage = progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;
  const subP = stage === 0 ? progress/0.34 : stage === 1 ? (progress-0.34)/0.33 : (progress-0.67)/0.33;

  return (
    <section className="pin-wrap" id="como" ref={wrapRef} style={{height: "320vh"}}>
      <div className="pin-stage">
        <div className="wrap resp-collapse" style={{display:"grid", gridTemplateColumns: "1fr 1.1fr", gap: 64, alignItems:"center", padding:"0 24px"}}>
          <div>
            <span className="eyebrow"><span className="dot"/> Como funciona</span>
            <h2 className="h-section" style={{margin:"18px 0 14px"}}>Três passos.<br/>Zero fricção.</h2>
            <p className="lede" style={{maxWidth: 460, margin: 0}}>Role para ver — o {tweaks.brandName} processa, descreve e renderiza, tudo dentro do seu navegador.</p>

            <div style={{marginTop: 36, display:"flex", flexDirection:"column", gap:14}}>
              {[
                {n:"01", t:"Suba seus dados", s:"CSV, JSON ou Excel. Nada sai do seu navegador.", icon: <Icon.Upload size={18}/>},
                {n:"02", t:"Descreva as métricas", s:'Em linguagem natural — "receita por região, evolução mensal".', icon: <Icon.Wand size={18}/>},
                {n:"03", t:"Receba o dashboard", s:"KPIs, gráficos e análises. Edite, reorganize, exporte.", icon: <Icon.Chart size={18}/>},
              ].map((s,i)=>(
                <div key={i} style={{
                  display:"flex", gap:14, alignItems:"flex-start", padding:"14px 16px",
                  borderRadius: 14, border: `1px solid ${stage===i ? "transparent" : "var(--line)"}`,
                  background: stage===i ? "white" : "transparent",
                  boxShadow: stage===i ? "0 20px 40px -20px rgba(47,107,255,.25)" : "none",
                  transform: stage===i ? "translateX(0)" : "translateX(-4px)",
                  opacity: stage===i ? 1 : 0.45,
                  transition: "all .35s ease"
                }}>
                  <div className="step-num" style={{background: stage===i ? `linear-gradient(180deg, ${tweaks.accent}, var(--brand-2))` : undefined}}>{s.n}</div>
                  <div>
                    <div style={{fontWeight:700, fontSize:16}}>{s.t}</div>
                    <div style={{color:"var(--muted)", fontSize:13, marginTop:4}}>{s.s}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="pin-dots" style={{marginTop:24}}>
              {[0,1,2].map(i=><span key={i} className={"pin-dot "+(stage>=i?"on":"")}/>)}
            </div>
          </div>

          {/* Stage canvas */}
          <div style={{position:"relative", height: 480}}>
            <PinStageCanvas stage={stage} subP={subP} tweaks={tweaks}/>
          </div>
        </div>
      </div>
    </section>
  );
}

function PinStageCanvas({ stage, subP, tweaks }){
  // Stage 0 — file drop animation
  // Stage 1 — prompt + chips animating in
  // Stage 2 — dashboard appearing (charts populate)
  const bars = [82, 64, 92, 48, 73];
  const line = Array.from({length:14}, (_,i)=>({l:""+(i+1), v: 30 + i*3 + Math.sin(i)*5}));
  return (
    <div style={{position:"absolute", inset:0}}>
      {/* Stage 0 */}
      <div style={{position:"absolute", inset:0, opacity: stage===0 ? 1 : 0, transform:`scale(${stage===0?1:0.96})`, transition:"all .5s ease"}}>
        <div className="preview-shell" style={{padding:32, height:"100%", display:"flex", alignItems:"center", justifyContent:"center"}}>
          <div style={{textAlign:"center", maxWidth: 380}}>
            <div style={{
              width:96, height:96, margin:"0 auto 18px", borderRadius:24,
              background: `linear-gradient(180deg, ${tweaks.accent}, var(--brand-2))`,
              display:"flex", alignItems:"center", justifyContent:"center", color:"white",
              boxShadow:`0 30px 60px -20px ${tweaks.accent}`,
              transform: `translateY(${(0.5-subP)*-20}px) rotate(${(subP-0.5)*8}deg)`,
              transition:"transform .2s linear"
            }}>
              <Icon.Upload size={36}/>
            </div>
            <div style={{fontWeight:700, fontSize:20, marginBottom:6}}>vendas_q3_2026.csv</div>
            <div className="mono" style={{fontSize:12, color:"var(--muted)"}}>1.284 linhas · 12 colunas · 86 KB</div>
            <div style={{marginTop:18, height:6, background:"var(--line-2)", borderRadius:99, overflow:"hidden"}}>
              <div style={{width: `${Math.min(100, subP*100*1.2)}%`, height:"100%", background: tweaks.accent, transition:"width .2s linear"}}/>
            </div>
            <div className="mono" style={{fontSize:11, color:"var(--muted)", marginTop:8}}>analisando colunas…</div>
          </div>
        </div>
      </div>
      {/* Stage 1 */}
      <div style={{position:"absolute", inset:0, opacity: stage===1 ? 1 : 0, transform:`scale(${stage===1?1:0.96})`, transition:"all .5s ease"}}>
        <div className="preview-shell" style={{padding:24}}>
          <div style={{fontSize:13, fontWeight:600, color:"var(--muted)", marginBottom:8}}>Quais métricas você quer ver?</div>
          <div style={{
            padding: "16px 18px", border:"1px solid var(--brand)", borderRadius: 14, minHeight: 96,
            boxShadow: `0 0 0 4px ${tweaks.accent}22`
          }}>
            <span style={{fontSize: 16, lineHeight:1.5}}>
              {("Mostre receita por região, top 10 produtos e tendência mensal de 2026").slice(0, Math.floor(subP*70))}
              <span style={{display:"inline-block", width:2, height:18, background:"var(--ink)", marginLeft:2, verticalAlign:"middle", animation:"blink 1s steps(1) infinite"}}/>
            </span>
          </div>
          <div style={{marginTop:14, display:"flex", flexWrap:"wrap", gap:8}}>
            {["data","produto","categoria","regiao","vendedor","canal","valor_total","ticket"].map((c,i)=>(
              <span key={c} className="chip mono" style={{
                opacity: subP > i*0.1 ? 1 : 0,
                transform: subP > i*0.1 ? "translateY(0)" : "translateY(6px)",
                transition: "all .3s ease"
              }}>{c}</span>
            ))}
          </div>
          <div style={{marginTop:18, display:"flex", flexDirection:"column", gap:8}}>
            {["Resumo executivo + KPIs principais","Receita por região (barras)","Tendência mensal (linha)","Top 10 produtos (barra horizontal)"].map((s,i)=>(
              <div key={s} style={{
                display:"flex", gap:10, alignItems:"center", fontSize:13, color:"var(--ink-2)",
                opacity: subP > 0.4 + i*0.12 ? 1 : 0.2,
                transition:"opacity .3s"
              }}>
                <span style={{
                  width:18, height:18, borderRadius:6, background:"var(--brand-soft)", color:"var(--brand)",
                  display:"inline-flex", alignItems:"center", justifyContent:"center"
                }}>
                  <Icon.Check size={12} stroke={3}/>
                </span>
                {s}
              </div>
            ))}
          </div>
          <style>{`@keyframes blink{ 50%{opacity:0;} }`}</style>
        </div>
      </div>
      {/* Stage 2 */}
      <div style={{position:"absolute", inset:0, opacity: stage===2 ? 1 : 0, transform:`scale(${stage===2?1:0.96})`, transition:"all .5s ease"}}>
        <div className="preview-shell" style={{padding:20, display:"grid", gap:14, gridTemplateColumns:"1fr 1fr", gridTemplateRows:"auto 1fr", height:"100%"}}>
          <div style={{gridColumn:"1 / -1", display:"flex", justifyContent:"space-between", alignItems:"flex-end"}}>
            <div>
              <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>VISÃO GERAL</div>
              <div style={{fontWeight:800, fontSize:22}}>Vendas Q3 · 2026</div>
            </div>
            <div style={{display:"flex", gap:6}}>
              <span className="icon-btn"><Icon.Filter size={14}/></span>
              <span className="icon-btn"><Icon.Download size={14}/></span>
              <span className="icon-btn"><Icon.More size={14}/></span>
            </div>
          </div>
          <div style={{padding:14, border:"1px solid var(--line)", borderRadius:12}}>
            <div style={{fontSize:12, color:"var(--muted)"}}>Receita</div>
            <div style={{fontSize:22, fontWeight:800}}>R$ 1,28M</div>
            <div style={{height:100, marginTop:6}}>
              <LineChart key={"l"+stage} data={line} height={100} color={tweaks.accent} animate animDelay={0}/>
            </div>
          </div>
          <div style={{padding:14, border:"1px solid var(--line)", borderRadius:12}}>
            <div style={{fontSize:12, color:"var(--muted)"}}>Top regiões</div>
            <div style={{height:130, marginTop:6}}>
              <BarChart key={"b"+stage} data={["SE","S","NE","CO","N"].map((l,i)=>({l, v:bars[i]}))} height={130} color={tweaks.accent} animDelay={0}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartGallery({ tweaks }){
  return (
    <section id="exemplos" className="pad" style={{paddingTop:48}}>
      <div className="wrap">
        <div style={{textAlign:"center", marginBottom: 48}}>
          <span className="rv eyebrow"><span className="dot"/> Exemplos visuais</span>
          <h2 className="rv h-section" style={{margin:"16px auto 8px"}}>Gráficos com qualidade de produto.</h2>
          <p className="rv lede" style={{margin:"0 auto", maxWidth: 560}}>Tipografia limpa, cores acessíveis, animações suaves. Tudo ajustável no Pro.</p>
        </div>
        <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr", gap:18}}>
          <div className="rv card soft-shadow lift" style={{padding:22}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8}}>
              <div>
                <div style={{fontWeight:700, fontSize:15}}>Receita por região</div>
                <div style={{fontSize:12, color:"var(--muted)"}}>Comparativo trimestral · BR</div>
              </div>
              <span className="chip" style={{background:"#e7f7ef", color:"#0a8a4a"}}>+22%</span>
            </div>
            <div style={{height:200}}>
              <BarChart data={[{l:"SUL",v:72,color:"#94b7ff"},{l:"SE",v:96,color:tweaks.accent},{l:"NE",v:58,color:"#94b7ff"},{l:"N",v:34,color:"#94b7ff"},{l:"CO",v:46,color:"#94b7ff"}]} height={200}/>
            </div>
          </div>
          <div className="rv card soft-shadow lift" style={{padding:22}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8}}>
              <div>
                <div style={{fontWeight:700, fontSize:15}}>Tendência semanal</div>
                <div style={{fontSize:12, color:"var(--muted)"}}>Últimas 8 semanas</div>
              </div>
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)"}}>▲ tendência</span>
            </div>
            <div style={{height:200}}>
              <LineChart data={[10,14,16,15,18,22,26,30].map((v,i)=>({l:"S"+(i+1), v}))} height={200} color={tweaks.accent}/>
            </div>
          </div>
          <div className="rv card soft-shadow lift" style={{padding:22, display:"flex", flexDirection:"column"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8}}>
              <div>
                <div style={{fontWeight:700, fontSize:15}}>Mix de planos</div>
                <div style={{fontSize:12, color:"var(--muted)"}}>Distribuição</div>
              </div>
            </div>
            <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:18}}>
              <Donut data={[
                {v:54, color: tweaks.accent},
                {v:26, color:"var(--violet)"},
                {v:12, color:"#0a8a4a"},
                {v:8, color:"#1b2240"},
              ]} size={160}/>
              <div style={{display:"flex", flexDirection:"column", gap:6, fontSize:12}}>
                {[{n:"Free", c:tweaks.accent, v:"54%"},{n:"Pro", c:"var(--violet)", v:"26%"},{n:"Team", c:"#0a8a4a", v:"12%"},{n:"Enterprise", c:"#1b2240", v:"8%"}].map(x=>(
                  <div key={x.n} style={{display:"flex", gap:8, alignItems:"center"}}>
                    <span style={{width:8, height:8, borderRadius:"50%", background:x.c}}/>
                    <span style={{fontWeight:600}}>{x.n}</span>
                    <span className="mono" style={{color:"var(--muted)"}}>{x.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features({ tweaks }){
  const feats = [
    { i: <Icon.Wand size={20}/>, t:"IA monta para você", d:"Descreva em português o que quer ver. Os gráficos certos aparecem.", c: tweaks.accent },
    { i: <Icon.Sparkle size={20}/>, t:"Análises automáticas", d:"Resumo executivo + insights destacando tendências e outliers.", c: "var(--violet)"},
    { i: <Icon.Chart size={20}/>, t:"Edição visual", d:"Troque tipo de gráfico, cores, ordem e título sem código.", c: "#0a8a4a"},
    { i: <Icon.Lock size={20}/>, t:"Tudo no navegador", d:"Seus dados nunca saem do dispositivo durante a análise.", c: "#ff7849"},
    { i: <Icon.Bars size={20}/>, t:"7 tipos de gráfico", d:"KPI, barras, linha, área, pizza, donut e tabela com tema unificado.", c: "#ff5e93"},
    { i: <Icon.Eye size={20}/>, t:"Compartilhamento", d:"Link público, embed ou PDF — com filtros aplicados.", c: "#1b2240" },
  ];
  return (
    <section id="recursos" className="pad" style={{paddingTop: 80}}>
      <div className="wrap">
        <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"end", marginBottom: 48}}>
          <div>
            <span className="rv eyebrow"><span className="dot"/> Recursos</span>
            <h2 className="rv h-section" style={{margin:"16px 0 0"}}>Tudo que você precisa<br/>para entender seus dados.</h2>
          </div>
          <p className="rv lede" style={{margin:0}}>
            Da ingestão à narrativa visual, sem fricção e sem código. Cada recurso pensado para reduzir o tempo entre "tenho um CSV" e "tenho uma resposta".
          </p>
        </div>
        <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:18}}>
          {feats.map((f, i)=>(
            <div key={i} className="rv feat" style={{transitionDelay: (i*0.06)+"s"}}>
              <div style={{
                width:42, height:42, borderRadius:12,
                background: `color-mix(in oklch, ${f.c} 15%, white)`,
                color: f.c, display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:18
              }}>{f.i}</div>
              <div style={{fontWeight:700, fontSize:16, marginBottom:6}}>{f.t}</div>
              <div style={{color:"var(--muted)", fontSize:14, lineHeight:1.5}}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Logos(){
  const items = ["acme co","north star","quilo labs","oitava","datavela","helix","brisa","monorail","palmar"];
  return (
    <section style={{padding:"24px 0 24px"}}>
      <div className="wrap" style={{textAlign:"center", marginBottom:18}}>
        <span style={{fontSize:13, color:"var(--muted)"}}>Times de dados e produto usam para fechar o ciclo de análise:</span>
      </div>
      <div className="marquee">
        <div className="marquee-track">
          {[...items, ...items].map((t,i)=>(
            <span key={i} className="marquee-item" style={{fontSize:22, letterSpacing:"-.03em", fontWeight:600, opacity:.55}}>
              <span style={{width:18,height:18,borderRadius:5, background:"linear-gradient(135deg,#1b2240,#5b6478)"}}/>
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ onOpenApp }){
  return (
    <section id="planos" className="pad">
      <div className="wrap">
        <div style={{textAlign:"center", marginBottom:48}}>
          <span className="rv eyebrow"><span className="dot"/> Planos</span>
          <h2 className="rv h-section" style={{margin:"16px 0 8px"}}>Comece grátis.<br/>Edite tudo no Pro.</h2>
          <p className="rv lede" style={{margin:"0 auto", maxWidth:500}}>Sem cartão de crédito. Cancele a qualquer momento.</p>
        </div>
        <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, maxWidth: 920, margin:"0 auto"}}>
          <div className="rv card" style={{padding:32}}>
            <div style={{fontWeight:700, fontSize:18}}>Free</div>
            <div style={{color:"var(--muted)", fontSize:14, marginTop:4}}>Perfeito para experimentar.</div>
            <div style={{margin:"24px 0 18px"}}>
              <span style={{fontSize:44, fontWeight:800, letterSpacing:"-.03em"}}>R$ 0</span>
              <span style={{color:"var(--muted)"}}>/sempre</span>
            </div>
            <ul style={{listStyle:"none", padding:0, margin:"0 0 24px", display:"flex", flexDirection:"column", gap:10}}>
              {["Upload CSV / JSON / Excel","Dashboard gerado por IA","Resumo + 3-5 análises automáticas","Visualizar 5 tipos de gráfico","Filtros por período e categoria"].map(t=>(
                <li key={t} style={{display:"flex", gap:10, alignItems:"center", fontSize:14}}>
                  <Icon.Check size={16} stroke={2.4} color="var(--brand)"/> {t}
                </li>
              ))}
            </ul>
            <button className="btn btn-ghost" style={{width:"100%", justifyContent:"center"}} onClick={()=> window.__dashEnterApp?.()}>Começar grátis</button>
          </div>
          <div className="rv card soft-shadow" style={{padding:32, border:"1.5px solid var(--brand)", position:"relative", background: "linear-gradient(180deg, #f5f8ff, white)"}}>
            <span className="chip" style={{position:"absolute", top:24, right:24, background:"var(--ink)", color:"white"}}><Icon.Crown size={11}/> Mais popular</span>
            <div style={{fontWeight:700, fontSize:18}}>Pro</div>
            <div style={{color:"var(--muted)", fontSize:14, marginTop:4}}>Para edição e exportação completas.</div>
            <div style={{margin:"24px 0 18px"}}>
              <span style={{fontSize:44, fontWeight:800, letterSpacing:"-.03em", color:"var(--brand)"}}>R$ 29</span>
              <span style={{color:"var(--muted)"}}>/mês</span>
            </div>
            <ul style={{listStyle:"none", padding:0, margin:"0 0 24px", display:"flex", flexDirection:"column", gap:10}}>
              {["Tudo do Free, e mais:","Trocar tipo de gráfico (barra, linha, pizza, área)","Personalizar cores, métricas e agregações","Reordenar via drag-and-drop e layouts","Exportar PDF / PNG com pré-visualização","Reanálise com IA sobre dados filtrados"].map((t,i)=>(
                <li key={t} style={{display:"flex", gap:10, alignItems:"center", fontSize:14, fontWeight: i===0?700:500}}>
                  <Icon.Check size={16} stroke={2.4} color="var(--brand)"/> {t}
                </li>
              ))}
            </ul>
            <button className="btn btn-primary" style={{width:"100%", justifyContent:"center"}} onClick={()=> window.__dashUpgrade?.()}><Icon.Crown size={14}/> Experimentar Pro</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA({ onOpenApp }){
  return (
    <section className="pad" style={{paddingTop: 0}}>
      <div className="wrap rv">
        <div className="cta-banner">
          <span className="chip" style={{background:"rgba(255,255,255,.18)", color:"white"}}><Icon.Sparkle size={12}/> Sem cadastro</span>
          <h2 className="h-section" style={{margin:"14px 0 10px", color:"white"}}>Pronto para ver seus dados<br/>de outro jeito?</h2>
          <p style={{maxWidth:520, color:"rgba(255,255,255,.85)", margin:0}}>Suba sua primeira planilha agora. Em segundos, um dashboard interativo.</p>
          <div style={{display:"flex", gap:10, marginTop:24}}>
            <button className="btn" style={{background:"white", color:"var(--ink)"}} onClick={()=> window.__dashEnterApp?.()}>Abrir o app <Icon.Arrow size={14}/></button>
            <button className="btn" style={{background:"rgba(255,255,255,.12)", color:"white", border:"1px solid rgba(255,255,255,.3)"}}>Ver exemplos</button>
          </div>
          <svg style={{position:"absolute", right:-40, bottom:-40, opacity:.15}} width="320" height="320" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth=".5"/>
            <circle cx="100" cy="100" r="70" fill="none" stroke="white" strokeWidth=".5"/>
            <circle cx="100" cy="100" r="50" fill="none" stroke="white" strokeWidth=".5"/>
            <circle cx="100" cy="100" r="30" fill="none" stroke="white" strokeWidth=".5"/>
          </svg>
        </div>
      </div>
    </section>
  );
}

function Footer({ tweaks }){
  return (
    <footer>
      <div className="wrap" style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:24, flexWrap:"wrap"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <Icon.Logo size={26}/>
          <div style={{display:"flex", flexDirection:"column", lineHeight:1}}>
            <span style={{fontWeight:700}}>{tweaks.brandName}</span>
            <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>DASHBOARDS · IA</span>
          </div>
        </div>
        <div style={{display:"flex", gap:24, fontSize:13, color:"var(--muted)"}}>
          <a href="#exemplos">Exemplos</a>
          <a href="#recursos">Recursos</a>
          <a href="#planos">Planos</a>
          <a>Privacidade</a>
          <a>Termos</a>
        </div>
        <div style={{fontSize:12, color:"var(--muted)"}}>© 2026 {tweaks.brandName}. Feito com IA, para humanos.</div>
      </div>
    </footer>
  );
}

function Landing({ onOpenApp, onLoadDemo, tweaks, currentUser, onSignIn, onSignUp, onSignOut, onProfile }){
  return (
    <div>
      <Nav onOpenApp={onOpenApp} tweaks={tweaks} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>
      <Hero onOpenApp={onOpenApp} onLoadDemo={onLoadDemo} tweaks={tweaks}/>
      <StatStrip/>
      <ChartGallery tweaks={tweaks}/>
      <Logos/>
      <PinnedSteps tweaks={tweaks}/>
      <Features tweaks={tweaks}/>
      <Pricing onOpenApp={onOpenApp}/>
      <CTA onOpenApp={onOpenApp}/>
      <Footer tweaks={tweaks}/>
    </div>
  );
}

Object.assign(window, { Landing, AuthBubble, useReveal, useScrollProgress, useScrollY, useCount });
