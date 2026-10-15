/* Account / Workspace / Billing / History / Referral pages */

// Decoration for sections whose persistence isn't wired to the backend yet
// (profile save, password change, plan management buttons, social share).
// Blurs the wrapped content + blocks pointer events + drops an "Em breve"
// badge at the top corner. Cheaper than gating each control individually,
// and lets us keep the visual design intact while the backend lands.
function ComingSoonOverlay({ children, label = "Em breve", side = "right" }){
  return (
    <div style={{position:"relative"}}>
      <div style={{filter:"blur(2px)", opacity:0.5, pointerEvents:"none", userSelect:"none"}}>
        {children}
      </div>
      <div style={{
        position:"absolute", top:12, [side]:12,
        background:"var(--accent)", color:"white",
        padding:"4px 12px", borderRadius:999,
        fontSize:12, fontWeight:600, zIndex:2,
        boxShadow:"0 4px 12px -4px rgba(10,138,74,.4)"
      }}>{label}</div>
    </div>
  );
}

// Local boundary so a render error in one section (e.g. a missing icon, a bad
// prop from a half-wired backend) doesn't blank the whole page. Resets when
// the user switches section.
class AccountErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidUpdate(prev){ if(prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render(){
    if(this.state.err){
      return (
        <div style={{padding:"32px 28px", border:"1px dashed var(--line)", borderRadius:14, background:"#fff7f9", textAlign:"center"}}>
          <div style={{fontWeight:700, fontSize:15, marginBottom:6, color:"#c9234a"}}>Não foi possível carregar esta seção</div>
          <div style={{fontSize:13, color:"var(--muted)", lineHeight:1.55, marginBottom:14, maxWidth:380, margin:"0 auto 14px"}}>
            Algo deu errado ao renderizar este conteúdo. Tente trocar de aba ou recarregar a página.
          </div>
          <button onClick={()=> this.setState({ err: null })} className="btn btn-ghost" style={{padding:"8px 14px", fontSize:13}}>Tentar de novo</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AccountView({ tweaks, setTweak, currentUser, section, onSection, onClose }){
  // Authenticated-only screen. The only entry points (tweaks panel, future
  // AuthBubble menu) shouldn't expose this without a session, but guard
  // defensively so an unexpected hop doesn't blow up reading currentUser.email.
  if(!currentUser){
    return (
      <div style={{minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"var(--bg)"}}>
        <div style={{textAlign:"center", maxWidth:360}}>
          <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Faça login para acessar a Conta</div>
          <div style={{fontSize:13, color:"var(--muted)", marginBottom:18}}>Esta área mostra seus dados, faturamento e histórico — só fica disponível quando você está logado.</div>
          <div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap"}}>
            <button className="btn btn-primary" onClick={()=> window.__dashOpenAuth?.("login")}>Entrar</button>
            <button className="btn btn-ghost" onClick={onClose}><Icon.Arrow size={13} style={{transform:"rotate(180deg)"}}/> Voltar</button>
          </div>
        </div>
      </div>
    );
  }
  const isFree = tweaks.plan === "free";
  const displayName = currentUser.fullName || currentUser.email || "Conta";
  const avatarChar = String((displayName[0] || "?")).toUpperCase();
  // Workspace stays locked until the Team plan ships — we leave the entry
  // in the sidebar (with a lock chip) so the IA matches the original design
  // and existing users can see what's coming. Click routes to a teaser
  // ("em breve") rather than the full WorkspaceSection preview.
  const sections = [
    { k:"account",   n:"Conta",                i:<Icon.User size={14}/>,    d:"Perfil e segurança" },
    { k:"workspace", n:"Workspace",            i:<Icon.Grid size={14}/>,    d:"Equipe e permissões", lockReason:"team" },
    { k:"billing",   n:"Faturamento",          i:<Icon.Doc size={14}/>,     d:"Plano, pagamento e notas" },
    { k:"history",   n:"Histórico de análises",i:<Icon.Refresh size={14}/>, d:"Linha do tempo da IA" },
    { k:"referral",  n:"Indique e ganhe",      i:<Icon.Sparkle size={14}/>, d:"Em breve" },
  ];
  const cur = sections.find(s => s.k === section) || sections[0];

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      {/* Topbar */}
      <div style={{
        position:"sticky", top:0, zIndex:30, backdropFilter:"blur(10px)",
        background:"rgba(246,247,251,.85)", borderBottom:"1px solid var(--line)"
      }}>
        <div style={{padding:"14px 24px", maxWidth: 1280, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <button onClick={onClose} style={{display:"flex", alignItems:"center", gap:10, background:"transparent", border:0, cursor:"pointer"}}>
            <Icon.Logo size={28}/>
            <div style={{display:"flex", flexDirection:"column", lineHeight:1, textAlign:"left"}}>
              <span style={{fontWeight:700, fontSize:14}}>{tweaks.brandName}</span>
              <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>DASHBOARDS · IA</span>
            </div>
          </button>
          <div className="tb-crumb" style={{display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--muted)"}}>
            <span>Configurações</span>
            <Icon.Caret size={12}/>
            <span style={{color:"var(--ink-2)", fontWeight:600}}>{cur.n}</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}}>
            <Icon.Arrow size={13} style={{transform:"rotate(180deg)"}}/> Voltar
          </button>
        </div>
      </div>

      <div className="acct-grid" style={{maxWidth: 1280, margin:"0 auto", padding:"32px 24px 80px", display:"grid", gridTemplateColumns:"260px minmax(0, 1fr)", gap:32}}>
        {/* Sidebar */}
        <aside className="acct-aside" style={{position:"sticky", top: 80, alignSelf:"flex-start", display:"flex", flexDirection:"column", gap:14}}>
          {/* User mini */}
          <div style={{padding:"14px 16px", background:"white", border:"1px solid var(--line)", borderRadius:14, display:"flex", gap:10, alignItems:"center"}}>
            <div style={{
              width:36, height:36, borderRadius:"50%", flexShrink:0,
              background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`, color:"white",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:14
            }}>{avatarChar}</div>
            <div style={{minWidth:0, flex:1}}>
              <div style={{fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{displayName}</div>
              <div style={{marginTop:4}}>
                <span className="chip" style={{
                  padding:"1px 8px",
                  background: !isFree ? "#e7f7ef" : "var(--line-2)",
                  color: !isFree ? "#0a5a30" : "var(--ink-2)",
                  fontSize:10, fontWeight:700, gap:4,
                }}>
                  {!isFree && <Icon.Crown size={10}/>} {dashPlanLabel(tweaks.plan)}
                </span>
              </div>
            </div>
          </div>
          <nav style={{display:"flex", flexDirection:"column", gap:2}}>
            {sections.map(s => {
              const on = section === s.k;
              const locked = s.lockReason;
              return (
                <button key={s.k} onClick={()=>onSection(s.k)} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                  borderRadius:10, background: on ? "white" : "transparent",
                  cursor:"pointer", textAlign:"left", boxShadow: on ? "0 2px 8px -4px rgba(15,23,42,.12)" : "none",
                  border: on ? "1px solid var(--line)" : "1px solid transparent",
                  transition:"all .15s"
                }}>
                  <span style={{
                    width:30, height:30, borderRadius:8, flexShrink:0,
                    background: on ? "var(--brand-soft)" : "var(--line-2)",
                    color: on ? "var(--brand)" : "var(--muted)",
                    display:"inline-flex", alignItems:"center", justifyContent:"center"
                  }}>{s.i}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontWeight: on?700:500, fontSize:13, color: on ? "var(--ink)" : "var(--ink-2)", display:"flex", alignItems:"center", gap:6}}>
                      {s.n}
                      {locked && <span className="chip" style={{padding:"0 6px", fontSize:9, background:"var(--ink)", color:"white"}}>{locked === "team" ? "Team" : "Pro"}</span>}
                    </div>
                    <div style={{fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{s.d}</div>
                  </div>
                  {locked && <Icon.Lock size={12} color="var(--muted)"/>}
                </button>
              );
            })}
          </nav>
          {/* Upgrade promo */}
          {tweaks.plan !== "pro" && (
            <div style={{
              padding:"16px", borderRadius:14,
              background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`,
              color:"white", position:"relative", overflow:"hidden"
            }}>
              <Icon.Crown size={18}/>
              <div style={{fontWeight:700, fontSize:14, margin:"8px 0 4px"}}>{isFree ? "Desbloqueie tudo" : "Vá de Pro"}</div>
              <div style={{fontSize:12, opacity:.9, lineHeight:1.5, marginBottom:12}}>
                {isFree
                  ? "Edição completa, 50 análises da IA por mês e exportação."
                  : "300 análises da IA por mês e bases de até 1 milhão de linhas."}
              </div>
              <button onClick={()=> window.__dashUpgrade && window.__dashUpgrade()} style={{
                width:"100%", padding:"8px 12px", background:"white", color:"var(--ink)",
                border:0, borderRadius:8, fontWeight:600, fontSize:12, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6
              }}>Ver planos <Icon.Arrow size={11}/></button>
            </div>
          )}
        </aside>

        {/* Main */}
        <main>
          <AccountErrorBoundary resetKey={section}>
            {section === "account"   && <AccountSection tweaks={tweaks} currentUser={currentUser} onClose={onClose}/>}
            {section === "workspace" && <WorkspaceComingSoon tweaks={tweaks} currentUser={currentUser}/>}
            {section === "billing"   && <BillingSection tweaks={tweaks} setTweak={setTweak} currentUser={currentUser}/>}
            {section === "history"   && <HistorySection tweaks={tweaks} currentUser={currentUser}/>}
            {section === "referral"  && <ReferralSection tweaks={tweaks}/>}
          </AccountErrorBoundary>
        </main>
      </div>
    </div>
  );
}

// Workspace teaser — the Team plan (workspaces, roles, SSO, audit log) isn't
// shipping yet. Until it is, the Workspace tab shows a coming-soon card with
// an interest-capture button so we can build a wait-list. Replace this with
// the real <WorkspaceSection/> when the Team plan lands.
function WorkspaceComingSoon({ tweaks, currentUser }){
  // Lista de espera salva no backend (POST /me/waitlist; CLAUDE.md §22).
  const already = !!(currentUser && Array.isArray(currentUser.waitlist) && currentUser.waitlist.indexOf("workspace") >= 0);
  const [notified, setNotified] = React.useState(already);
  const [wlError, setWlError] = React.useState(null);
  React.useEffect(()=>{ if(already) setNotified(true); }, [already]);
  const join = async ()=>{
    setWlError(null);
    try { await window.DashAPI.joinWaitlist("workspace", "account_view"); setNotified(true); window.DashAPI.me().catch(()=>{}); }
    catch(e){ setWlError("Não foi possível registrar agora. Tente de novo em instantes."); }
  };
  const accent = (tweaks && tweaks.accent) || "var(--brand)";
  const features = [
    "Workspaces compartilhados",
    "Convites e permissões (Owner / Admin / Editor / Viewer)",
    "SSO (Google, Microsoft, SAML)",
    "Audit log + retenção estendida",
    "Branding white-label",
    "Suporte prioritário",
  ];
  return (
    <div>
      <SectionHeader title="Workspace" sub="Identidade, equipe e permissões do seu workspace."/>
      <div style={{
        padding:"36px 32px", borderRadius:18,
        background:"linear-gradient(180deg, #fafbfe, white)",
        border:"1px solid var(--line)", textAlign:"center",
        position:"relative", overflow:"hidden"
      }}>
        <div style={{
          width:64, height:64, margin:"0 auto 16px", borderRadius:16,
          background:`linear-gradient(135deg, ${accent}, var(--violet))`,
          color:"white", display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`0 16px 32px -10px ${accent}`
        }}>
          <Icon.Grid size={26}/>
        </div>
        <div style={{display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:99, background:"var(--ink)", color:"white", fontSize:11, fontWeight:700, marginBottom:10}}>
          <Icon.Lock size={10}/> Plano Team · em breve
        </div>
        <h2 style={{margin:"0 0 10px", fontSize:22, fontWeight:800, letterSpacing:"-.02em"}}>
          Workspace está disponível no plano Team
        </h2>
        <p style={{margin:"0 auto 22px", fontSize:13.5, color:"var(--muted)", lineHeight:1.55, maxWidth: 460}}>
          Pré-cadastre seu interesse para receber novidades. Avisamos assim que o Team estiver disponível.
        </p>
        <ul style={{listStyle:"none", padding:0, margin:"0 auto 24px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, textAlign:"left", maxWidth: 540}}>
          {features.map(f=>(
            <li key={f} style={{display:"flex", gap:8, alignItems:"flex-start", fontSize:12.5, color:"var(--ink-2)"}}>
              <span style={{
                width:18, height:18, borderRadius:6, flexShrink:0, marginTop:1,
                background:`color-mix(in oklch, ${accent} 14%, white)`, color: accent,
                display:"inline-flex", alignItems:"center", justifyContent:"center"
              }}>
                <Icon.Check size={11} stroke={3}/>
              </span>
              {f}
            </li>
          ))}
        </ul>
        <button
          onClick={join}
          disabled={notified}
          className={notified ? "btn btn-ghost" : "btn btn-primary"}
          style={{padding:"11px 18px", opacity: notified ? 1 : undefined}}>
          {notified
            ? <><Icon.Check size={13} stroke={3} color="#0a8a4a"/> Te avisaremos!</>
            : <><Icon.Sparkle size={13}/> Notificar quando estiver disponível</>}
        </button>
        {wlError && <div role="alert" style={{marginTop:10, fontSize:12.5, color:"#c9234a"}}>{wlError}</div>}
      </div>
    </div>
  );
}

function PlanGate({ tier="pro", title, desc, features=[], preview }){
  const accentVar = tier === "team" ? "#7a5cff" : "var(--brand)";
  const ctaLabel = tier === "team" ? "Falar com vendas" : "Experimentar Pro";
  return (
    <div className="paywall-blur" style={{position:"relative", minHeight: 580}}>
      <div className="pw-content" style={{pointerEvents:"none", userSelect:"none"}}>
        {preview}
      </div>
      <div className="pw-overlay" style={{position:"absolute", inset:0, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 20px", background:"radial-gradient(ellipse at center, rgba(255,255,255,.75), rgba(255,255,255,.55))"}}>
        <div style={{
          maxWidth: 520, background:"white", border:"1px solid var(--line)",
          borderRadius: 18, padding:"28px 28px 24px",
          boxShadow:"0 40px 80px -20px rgba(15,23,42,.3)",
          textAlign:"center"
        }}>
          <div style={{
            width:56, height:56, margin:"0 auto 14px", borderRadius:14,
            background:`linear-gradient(135deg, ${accentVar}, var(--violet))`,
            color:"white", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 16px 32px -10px ${accentVar}`
          }}>
            <Icon.Crown size={24}/>
          </div>
          <div style={{display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:99, background:`color-mix(in oklch, ${accentVar} 12%, white)`, color:accentVar, fontSize:11, fontWeight:700, marginBottom:10}}>
            <Icon.Lock size={10}/> Plano {tier === "team" ? "Team" : "Pro"}
          </div>
          <h2 style={{margin:"0 0 8px", fontSize:22, fontWeight:800, letterSpacing:"-.02em"}}>{title}</h2>
          <p style={{margin:"0 0 18px", fontSize:13.5, color:"var(--muted)", lineHeight:1.55}}>{desc}</p>
          <ul style={{listStyle:"none", padding:0, margin:"0 0 22px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, textAlign:"left"}}>
            {features.map(f=>(
              <li key={f} style={{display:"flex", gap:8, alignItems:"flex-start", fontSize:12, color:"var(--ink-2)"}}>
                <span style={{width:16, height:16, borderRadius:5, flexShrink:0, marginTop:1, background:`color-mix(in oklch, ${accentVar} 14%, white)`, color: accentVar, display:"inline-flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Check size={10} stroke={3}/>
                </span>
                {f}
              </li>
            ))}
          </ul>
          <div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap"}}>
            <button onClick={()=> window.__dashUpgrade && window.__dashUpgrade()} className="btn btn-primary" style={{padding:"10px 18px"}}>
              <Icon.Crown size={13}/> {ctaLabel}
            </button>
            <button onClick={()=> window.__dashOpenPlans && window.__dashOpenPlans()} className="btn btn-ghost" style={{padding:"10px 14px"}}>Ver planos</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* — Reusable settings primitives — */

function SettingsCard({ title, sub, action, children }){
  return (
    <div style={{background:"white", border:"1px solid var(--line)", borderRadius:16, overflow:"hidden", marginBottom:18}}>
      {(title || action) && (
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"18px 22px", borderBottom:"1px solid var(--line-2)"
        }}>
          <div>
            <div style={{fontWeight:700, fontSize:15}}>{title}</div>
            {sub && <div style={{fontSize:12, color:"var(--muted)", marginTop:3}}>{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{padding:"22px"}}>{children}</div>
    </div>
  );
}

function SectionHeader({ title, sub, action }){
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, gap:18, flexWrap:"wrap"}}>
      <div>
        <h1 style={{margin:"0 0 6px", fontSize:30, fontWeight:800, letterSpacing:"-.02em"}}>{title}</h1>
        <div style={{fontSize:14, color:"var(--muted)"}}>{sub}</div>
      </div>
      {action}
    </div>
  );
}

function TextField({ label, value, onChange, type="text", hint, suffix, placeholder, readOnly }){
  return (
    <label style={{display:"block"}}>
      {label && <div style={{fontSize:12, fontWeight:600, color:"var(--ink-2)", marginBottom:6}}>{label}</div>}
      <div style={{position:"relative"}}>
        <input type={type} value={value} onChange={e=>onChange && onChange(e.target.value)} placeholder={placeholder}
          readOnly={readOnly}
          style={{
            width:"100%", padding:"10px 12px", border:"1px solid var(--line)", borderRadius:10,
            fontSize:14, fontFamily:"inherit", color:"var(--ink)", outline:"none",
            background: readOnly ? "var(--line-2)" : "white",
            paddingRight: suffix ? 70 : 12
          }}/>
        {suffix && <span style={{position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:12}} className="mono">{suffix}</span>}
      </div>
      {hint && <div style={{fontSize:11, color:"var(--muted)", marginTop:5}}>{hint}</div>}
    </label>
  );
}



/* — 1. CONTA — */

/* — 3. FATURAMENTO — */

function BillingSection({ tweaks, setTweak, currentUser }){
  const isPro  = tweaks.plan === "pro";
  const isPaid = tweaks.plan !== "free";              // essencial OU pro = assinatura ativa
  const planName  = isPro ? "Pro" : tweaks.plan === "essencial" ? "Essencial" : "Free";
  const yearly = !!currentUser && currentUser.billingCycle === "yearly";
  const priceTable = isPaid ? DASH_PRICES[isPro ? "pro" : "essencial"] : null;
  const planPrice = priceTable ? dashFmtBRL(yearly ? priceTable.yearly : priceTable.monthly).replace("R$ ", "") : "0";
  const billingMethod = currentUser && currentUser.billingMethod;
  const periodEnd = currentUser && currentUser.currentPeriodEnd ? new Date(currentUser.currentPeriodEnd) : null;
  const periodEndText = periodEnd && !isNaN(periodEnd) ? periodEnd.toLocaleDateString("pt-BR") : null;
  const isCard = billingMethod === "card";
  // Cancelou no cartão: o acesso segue até o fim do período pago, sem renovar.
  const cancelled = isPaid && isCard && !!currentUser && currentUser.autoRenew === false;
  const limits = (currentUser && currentUser.limits) || null;

  // Cancela a assinatura no backend (Asaas). A renovação para e o plano segue
  // até current_period_end; o webhook marca auto_renew=false e o job do backend
  // derruba para Free depois. NÃO mexer em tweaks.plan aqui.
  const onCancel = async ()=>{
    if(!window.confirm("Cancelar a assinatura? A renovação automática para e você continua no " + planName
      + (periodEndText ? " até " + periodEndText : " até o fim do período já pago") + ". Depois disso a conta volta para o plano Free.")) return;
    try {
      const r = await window.DashAPI.cancel();
      const until = r && r.accessUntil ? new Date(r.accessUntil) : periodEnd;
      window.alert("Assinatura cancelada. Você continua no " + planName
        + (until && !isNaN(until) ? " até " + until.toLocaleDateString("pt-BR") : " até o fim do período pago") + ".");
      // Reidrata o plano (CLAUDE_CODE.md B7); o webhook pode levar alguns segundos.
      window.DashAPI.me().catch(()=>{});
      setTimeout(()=> window.DashAPI.me().catch(()=>{}), 5000);
    } catch(err){
      const code = err && err.data && err.data.error;
      window.alert(code === "sem_assinatura_asaas"
        ? "Seu plano não tem renovação automática (pagamento via Pix): basta não pagar a próxima cobrança e ele volta para o Free no fim do período."
        : "Não foi possível cancelar agora. Tente novamente em instantes.");
    }
  };


  // Só números reais de currentUser.limits (/me). Sem limits (falha no /me),
  // mostra "—" em vez de inventar valores.
  const aiUsed    = limits ? (limits.aiUsed || 0) : null;
  const aiMonthly = limits ? (limits.aiMonthly || 0) : null;
  const aiPct     = aiMonthly > 0 ? Math.min(100, Math.round((aiUsed / aiMonthly) * 100)) : 0;
  const canExport = limits ? !!limits.canExport : isPaid;
  const maxRows   = limits && limits.maxRows ? limits.maxRows : null;

  const usage = [
    { l:"Análises da IA neste mês", v: aiUsed == null ? "—" : aiUsed, max: aiMonthly == null ? "—" : aiMonthly, pct: aiPct, c:"#7a5cff" },
    { l:"Linhas por base", v: maxRows ? maxRows.toLocaleString("pt-BR") : "—", max:"limite do plano", pct:100, c: tweaks.accent },
    { l:"Exportar PDF/PNG", v: canExport ? "Incluído" : "—", max: canExport ? "no seu plano" : "só nos planos pagos", pct: canExport ? 100 : 0, c:"#0a8a4a", locked: !canExport },
  ];

  return (
    <div>
      <SectionHeader title="Faturamento" sub="Plano atual, uso, pagamentos e notas fiscais."/>

      {/* Big plan card */}
      <div style={{
        padding: 32, borderRadius: 18, marginBottom: 18,
        background: isPaid
          ? `linear-gradient(135deg, ${tweaks.accent}, var(--violet))`
          : "linear-gradient(180deg, #fafbfe, white)",
        color: isPaid ? "white" : "var(--ink)",
        border: isPaid ? "none" : "1px solid var(--line)",
        position:"relative", overflow:"hidden"
      }}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:24, flexWrap:"wrap"}}>
          <div>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px",
              borderRadius:99, background: isPaid ? "rgba(255,255,255,.18)" : "var(--brand-soft)",
              color: isPaid ? "white" : "var(--brand-2)",
              fontSize:11, fontWeight:700, marginBottom:12
            }}>
              <Icon.Crown size={11}/> {isPaid ? ("Plano " + planName + (yearly ? " anual" : "") + (cancelled ? " · Cancelado" : " · Ativo")) : "Plano Free"}
            </div>
            <h2 className="ticker" style={{margin:"0 0 6px", fontSize:32, fontWeight:800, letterSpacing:"-.025em"}}>
              R$ {planPrice}<span style={{fontSize:14, fontWeight:500, opacity:.8}}>{isPaid && yearly ? "/ano" : "/mês"}</span>
            </h2>
            <div style={{fontSize:13, opacity: isPaid ? .9 : 1, color: isPaid ? "white" : "var(--muted)"}}>
              {!isPaid ? "Sem cobranças · upgrade quando quiser"
                : cancelled ? "Assinatura cancelada · acesso até " + (periodEndText || "o fim do período pago") + ", sem novas cobranças"
                : isCard ? "Assinatura no cartão (" + (yearly ? "anual" : "mensal") + ") · renovação automática" + (periodEndText ? " por volta de " + periodEndText : "")
                : billingMethod ? "Pagamento via Pix (" + (yearly ? "anual" : "mensal") + ")" + (periodEndText ? " · acesso até " + periodEndText + "; a próxima cobrança chega por e-mail" : "")
                : "Assinatura ativa"}
            </div>
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {isPaid ? (
              // Gestão da assinatura ligada ao backend: "Mudar plano" abre os
              // planos; "Cancelar" chama DashAPI.cancel() (downgrade vem do webhook).
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <button onClick={()=> window.__dashOpenPlans && window.__dashOpenPlans()} style={{padding:"10px 14px", background: cancelled ? "white" : "rgba(255,255,255,.18)", color: cancelled ? "var(--ink)" : "white", border:0, borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer"}}>{cancelled ? "Reativar assinatura" : "Mudar plano"}</button>
                {/* Pix não tem assinatura para cancelar: basta não pagar a próxima cobrança. */}
                {billingMethod !== "pix" && billingMethod !== "boleto" && !cancelled && (
                  <button onClick={onCancel} style={{padding:"10px 14px", background:"transparent", color:"white", border:"1px solid rgba(255,255,255,.3)", borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer"}}>Cancelar</button>
                )}
              </div>
            ) : (
              <button onClick={()=> window.__dashUpgrade && window.__dashUpgrade()} className="btn btn-primary" style={{padding:"10px 16px"}}>
                <Icon.Crown size={14}/> Fazer upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Usage */}
      <SettingsCard title="Uso e limites" sub="A cota de análises da IA reinicia todo dia 1º.">
        <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
          {usage.map((u,i)=>(
            <div key={i} style={{padding:"14px 16px", border:"1px solid var(--line)", borderRadius:12, background: u.locked ? "#fafbfe" : "white", opacity: u.locked ? .7 : 1}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
                <div style={{fontSize:12, color:"var(--muted)", fontWeight:600}}>{u.l}</div>
                {u.locked && <Icon.Lock size={12} color="var(--muted)"/>}
              </div>
              <div style={{display:"flex", alignItems:"baseline", gap:4, marginBottom:6}}>
                <span style={{fontSize:24, fontWeight:800, letterSpacing:"-.02em", color: u.c}}>{u.v}</span>
                <span style={{fontSize:12, color:"var(--muted)"}}>{typeof u.max === "number" ? "/ " + u.max.toLocaleString("pt-BR") : u.max}</span>
              </div>
              <div style={{height:6, background:"var(--line-2)", borderRadius:99, overflow:"hidden"}}>
                <div style={{width: `${Math.min(100, u.pct)}%`, height:"100%", background: u.c, transition:"width .8s ease"}}/>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Payment method */}
      <SettingsCard title="Método de pagamento"
        sub={isPaid ? "Pagamento processado pelo Asaas." : "Escolha cartão ou Pix ao assinar."}>
        {isPaid ? (
          <div style={{display:"flex", alignItems:"center", gap:14, padding:"14px 16px", border:"1px solid var(--line)", borderRadius:12, background:"#fafbfe"}}>
            <span style={{
              width:36, height:36, borderRadius:10, flexShrink:0, background:"var(--brand-soft)", color:"var(--brand)",
              display:"inline-flex", alignItems:"center", justifyContent:"center"
            }}><Icon.Lock size={16}/></span>
            <div style={{fontSize:13, color:"var(--ink-2)", lineHeight:1.5}}>
              Os dados do cartão ou do Pix ficam com o Asaas — nunca passam pelos nossos servidores.
              No cartão a renovação é automática; no Pix, a cobrança do mês seguinte chega por e-mail perto do vencimento.
            </div>
          </div>
        ) : (
          <div style={{padding:16, border:"1px dashed var(--line)", borderRadius:12, textAlign:"center", color:"var(--muted)", fontSize:13}}>
            Nenhuma assinatura ativa. <a style={{color:"var(--brand)", fontWeight:600, cursor:"pointer"}} onClick={()=> window.__dashUpgrade && window.__dashUpgrade()}>Ver planos</a>
          </div>
        )}
      </SettingsCard>

      {/* Faturas reais (account-sections.jsx). O endereço de cobrança e o CPF
          ficam na página do Asaas, que emite a cobrança. */}
      <InvoiceHistory isPaid={isPaid}/>
    </div>
  );
}

function ReferralSection({ tweaks }){
  const link = "https://dash.app/r/maria-MA92K";
  const [copied, setCopied] = React.useState(false);
  const copy = ()=>{
    if(navigator.clipboard) navigator.clipboard.writeText(link).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false), 1800);
  };

  const referrals = [
    { n:"Bruno Sá", e:"bruno@bs.studio", st:"converted", date:"há 3 dias", reward:"+30d Pro" },
    { n:"Carla Lopes", e:"carla.l@quilo.io", st:"trial", date:"há 1 sem.", reward:"pendente" },
    { n:"Diego Ramos", e:"diego@oitava.co", st:"converted", date:"há 2 sem.", reward:"+30d Pro" },
    { n:"Eva Mendes", e:"eva@datavela.com", st:"signup", date:"há 3 sem.", reward:"em análise" },
    { n:"Felipe Tavares", e:"felipe@helix.dev", st:"clicked", date:"há 1 mês", reward:"—" },
  ];

  const stMeta = {
    converted: { n:"Convertido", c:"#0a8a4a", bg:"#e7f7ef" },
    trial:     { n:"Em trial", c:"var(--brand-2)", bg:"var(--brand-soft)" },
    signup:    { n:"Cadastrou", c:"#7a5cff", bg:"color-mix(in oklch, #7a5cff 12%, white)" },
    clicked:   { n:"Clicou no link", c:"var(--muted)", bg:"var(--line-2)" },
  };

  return (
    <div>
      <SectionHeader title="Indique e ganhe"
        sub="O programa de indicação está chegando. Os dados abaixo são ilustrativos."/>

      {/* Sem backend de indicação: link, indicações e saldos são de exemplo.
          Inerte sob "Em breve" para ninguém copiar e divulgar um link que não existe. */}
      <ComingSoonOverlay>

      {/* Hero */}
      <div style={{
        padding:"40px 36px", borderRadius:20, marginBottom:18,
        background:`
          radial-gradient(ellipse at 0% 0%, rgba(255,255,255,.15), transparent 50%),
          radial-gradient(ellipse at 100% 100%, rgba(122,92,255,.5), transparent 50%),
          linear-gradient(135deg, ${tweaks.accent}, var(--violet))
        `,
        color:"white", position:"relative", overflow:"hidden"
      }}>
        <div style={{display:"inline-flex", alignItems:"center", gap:7, padding:"4px 10px", borderRadius:99, background:"rgba(255,255,255,.18)", fontSize:11, fontWeight:600, marginBottom:14}}>
          <Icon.Sparkle size={11}/> Programa de indicação
        </div>
        <h2 style={{margin:"0 0 8px", fontSize:30, fontWeight:800, letterSpacing:"-.025em", maxWidth: 480}}>
          Convide amigos. Ganhe meses do Pro.
        </h2>
        <p style={{margin:"0 0 24px", fontSize:14, color:"rgba(255,255,255,.85)", maxWidth: 460, lineHeight:1.55}}>
          Cada amigo que se cadastrar com seu link e completar o trial te dá <b>+30 dias do Pro grátis</b>. Sem limite.
        </p>
        <div style={{display:"flex", gap:8, maxWidth: 580, alignItems:"center", flexWrap:"wrap"}}>
          <div className="mono" style={{
            flex:"1 1 280px", padding:"12px 14px", borderRadius:10,
            background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)",
            fontSize:13, color:"white", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
          }}>{link}</div>
          <button onClick={copy} style={{
            padding:"12px 16px", background:"white", color:"var(--ink)", border:0,
            borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer",
            display:"inline-flex", alignItems:"center", gap:6
          }}>
            {copied ? <><Icon.Check size={13} stroke={3} color="#0a8a4a"/> Copiado!</> : <><Icon.Share size={13}/> Copiar link</>}
          </button>
        </div>
        {/* Social share ("Compartilhar") — deep links not wired yet, so gated
            as "Em breve". The "Copiar link" button above stays functional so
            users can still share manually. */}
        <ComingSoonOverlay label="Em breve" side="left">
        <div style={{display:"flex", gap:12, marginTop:18, flexWrap:"wrap"}}>
          <button style={{padding:"8px 14px", background:"rgba(255,255,255,.12)", color:"white", border:"1px solid rgba(255,255,255,.25)", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.8a8 8 0 0 1-2.4.7 4 4 0 0 0 1.8-2.3c-.8.5-1.7.8-2.6 1A4 4 0 0 0 11.9 9a11.4 11.4 0 0 1-8.3-4.2 4 4 0 0 0 1.3 5.4 4 4 0 0 1-1.8-.5v.1a4 4 0 0 0 3.2 4 4 4 0 0 1-1.8.1 4 4 0 0 0 3.7 2.8A8.1 8.1 0 0 1 2 18.5 11.4 11.4 0 0 0 8.1 20c7.4 0 11.5-6.1 11.5-11.5v-.5A8.2 8.2 0 0 0 22 5.8z"/></svg>
            X / Twitter
          </button>
          <button style={{padding:"8px 14px", background:"rgba(255,255,255,.12)", color:"white", border:"1px solid rgba(255,255,255,.25)", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11.5 11.5 0 0 0 3.4 18.7L2 22l3.4-1.4A11.5 11.5 0 0 0 22 12 11.5 11.5 0 0 0 20.5 3.5z" opacity=".15"/><path d="M16.6 14c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.5.1a7 7 0 0 1-3.4-3 5.3 5.3 0 0 1-.8-1.6c0-.2 0-.3.1-.4l.4-.5.2-.4c0-.2 0-.3-.1-.4l-.9-1.4c-.2-.5-.5-.5-.6-.5h-.6c-.2 0-.5.1-.7.4-.3.3-1 .9-1 2.3s1 2.7 1.1 2.9c.1.2 2 3.1 5 4.3l1.4.5c.6.2 1.1.2 1.5.1.5-.1 1.6-.6 1.8-1.2.3-.6.3-1.2.2-1.3-.1-.1-.2-.2-.4-.2z"/></svg>
            WhatsApp
          </button>
          <button style={{padding:"8px 14px", background:"rgba(255,255,255,.12)", color:"white", border:"1px solid rgba(255,255,255,.25)", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v12H4z" opacity=".2"/><path d="M4 6l8 7 8-7M4 18h16V6H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Email
          </button>
        </div>
        </ComingSoonOverlay>
      </div>

      {/* Stats */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14, marginBottom:18}}>
        {[
          {l:"Cliques no link", v:42, c:"var(--muted)"},
          {l:"Cadastros", v:8, c:"#7a5cff"},
          {l:"Conversões", v:2, c:tweaks.accent},
          {l:"Pro grátis ganho", v:"60 dias", c:"#0a8a4a"},
        ].map((s,i)=>(
          <div key={i} style={{padding:"16px 18px", background:"white", border:"1px solid var(--line)", borderRadius:14}}>
            <div style={{fontSize:11, color:"var(--muted)", letterSpacing:".06em", textTransform:"uppercase", fontWeight:600, marginBottom:6}}>{s.l}</div>
            <div style={{fontSize:24, fontWeight:800, letterSpacing:"-.02em", color: s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <SettingsCard title="Como funciona" sub="3 passos simples — o resto é seu.">
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14}}>
          {[
            { n:"01", i:<Icon.Share size={16}/>, t:"Compartilhe seu link", d:"Pelo WhatsApp, email, redes sociais ou direto." },
            { n:"02", i:<Icon.User size={16}/>, t:"Amigo se cadastra", d:"Ele ganha 14 dias de Pro grátis (em vez dos 7 normais)." },
            { n:"03", i:<Icon.Crown size={16}/>, t:"Vocês dois ganham", d:"Quando o trial dele converter, você ganha +30 dias do Pro." },
          ].map(s=>(
            <div key={s.n} style={{padding:"18px 20px", background:"#fafbfe", border:"1px solid var(--line-2)", borderRadius:12, position:"relative"}}>
              <div className="mono" style={{position:"absolute", top:18, right:20, fontSize:28, fontWeight:800, color:"var(--line)", letterSpacing:"-.03em"}}>{s.n}</div>
              <div style={{
                width:36, height:36, borderRadius:10,
                background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`, color:"white",
                display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:14
              }}>{s.i}</div>
              <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>{s.t}</div>
              <div style={{fontSize:12.5, color:"var(--muted)", lineHeight:1.5}}>{s.d}</div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Referrals table */}
      <SettingsCard title={`Suas indicações · ${referrals.length}`}
        sub="Acompanhe quem entrou pelo seu link.">
        <div style={{display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr", gap:12, padding:"8px 4px", borderBottom:"1px solid var(--line-2)"}}>
          {["Pessoa","Status","Quando","Recompensa"].map(h=>(
            <div key={h} className="mono" style={{fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase"}}>{h}</div>
          ))}
        </div>
        {referrals.map((r,i)=>{
          const m = stMeta[r.st];
          return (
            <div key={r.e} style={{display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr", gap:12, alignItems:"center", padding:"12px 4px", borderTop: i===0?"none":"1px solid var(--line-2)"}}>
              <div style={{display:"flex", gap:10, alignItems:"center"}}>
                <div style={{
                  width:32, height:32, borderRadius:"50%",
                  background:`linear-gradient(135deg, ${["#ff7849","#7a5cff","#0a8a4a","#2f6bff","#ff5e93"][i%5]}, ${["#ff5e93","#2f6bff","#0a8a4a","#7a5cff","#ff7849"][i%5]})`,
                  color:"white", display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:700, fontSize:11, flexShrink:0
                }}>{r.n.split(" ").map(x=>x[0]).slice(0,2).join("")}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600, fontSize:13}}>{r.n}</div>
                  <div style={{fontSize:11, color:"var(--muted)"}}>{r.e}</div>
                </div>
              </div>
              <div>
                <span className="chip" style={{padding:"3px 9px", background: m.bg, color: m.c, fontSize:11}}>
                  <span style={{width:5, height:5, borderRadius:"50%", background: m.c}}/>
                  {m.n}
                </span>
              </div>
              <div className="mono" style={{fontSize:12, color:"var(--muted)"}}>{r.date}</div>
              <div style={{fontSize:13, fontWeight: r.st==="converted"?700:500, color: r.st==="converted"?"#0a8a4a":"var(--muted)"}}>{r.reward}</div>
            </div>
          );
        })}
      </SettingsCard>

      {/* Rules */}
      <div style={{padding:"14px 18px", background:"#fafbfe", border:"1px dashed var(--line)", borderRadius:12, fontSize:12, color:"var(--muted)", lineHeight:1.55}}>
        <div style={{fontWeight:700, color:"var(--ink-2)", marginBottom:6, display:"flex", alignItems:"center", gap:6}}>
          <Icon.Idea size={13} color="var(--brand)"/> Regras do programa
        </div>
        Recompensa é creditada quando o amigo converte do trial para assinatura paga. Sem limite de indicações. Saldos ficam disponíveis por 12 meses após o crédito. Não vale para auto-indicação ou contas duplicadas.
      </div>
      </ComingSoonOverlay>
    </div>
  );
}

Object.assign(window, { AccountView, SettingsCard, SectionHeader, TextField });
