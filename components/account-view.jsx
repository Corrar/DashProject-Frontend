/* Account / Workspace / Billing / History / Referral pages */

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
          <button className="btn btn-ghost" onClick={onClose}><Icon.Arrow size={13} style={{transform:"rotate(180deg)"}}/> Voltar</button>
        </div>
      </div>
    );
  }
  const isFree = tweaks.plan === "free";
  const displayName = currentUser.fullName || currentUser.email || "Conta";
  const avatarChar = String((displayName[0] || "?")).toUpperCase();
  const sections = [
    { k:"account",   n:"Conta",                i:<Icon.User size={14}/>,    d:"Perfil e segurança" },
    { k:"billing",   n:"Faturamento",          i:<Icon.Doc size={14}/>,     d:"Plano, pagamento e notas" },
    { k:"history",   n:"Histórico de análises",i:<Icon.Refresh size={14}/>, d:"Linha do tempo da IA" },
    { k:"referral",  n:"Indique e ganhe",      i:<Icon.Sparkle size={14}/>, d:"Ganhe 30 dias Pro" },
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
          <div style={{display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--muted)"}}>
            <span>Configurações</span>
            <Icon.Caret size={12}/>
            <span style={{color:"var(--ink-2)", fontWeight:600}}>{cur.n}</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}}>
            <Icon.Arrow size={13} style={{transform:"rotate(180deg)"}}/> Voltar
          </button>
        </div>
      </div>

      <div style={{maxWidth: 1280, margin:"0 auto", padding:"32px 24px 80px", display:"grid", gridTemplateColumns:"260px 1fr", gap:32}}>
        {/* Sidebar */}
        <aside style={{position:"sticky", top: 80, alignSelf:"flex-start", display:"flex", flexDirection:"column", gap:14}}>
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
              <div style={{fontSize:11, color:"var(--muted)"}}>{tweaks.plan === "pro" ? "Plano Pro" : "Plano Free"}</div>
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
              <div style={{fontWeight:700, fontSize:14, margin:"8px 0 4px"}}>Desbloqueie tudo</div>
              <div style={{fontSize:12, opacity:.9, lineHeight:1.5, marginBottom:12}}>
                Edição completa, análises da IA, exportação avançada.
              </div>
              <button onClick={()=> window.__dashUpgrade && window.__dashUpgrade()} style={{
                width:"100%", padding:"8px 12px", background:"white", color:"var(--ink)",
                border:0, borderRadius:8, fontWeight:600, fontSize:12, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6
              }}>Experimentar Pro <Icon.Arrow size={11}/></button>
            </div>
          )}
        </aside>

        {/* Main */}
        <main>
          {section === "account"   && <AccountSection tweaks={tweaks} setTweak={setTweak} currentUser={currentUser} onClose={onClose}/>}
          {section === "billing"   && <BillingSection tweaks={tweaks} setTweak={setTweak}/>}
          {section === "history"   && <HistorySection tweaks={tweaks}/>}
          {section === "referral"  && <ReferralSection tweaks={tweaks}/>}
        </main>
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

function Toggle({ checked, onChange, label, sub }){
  return (
    <label style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:14, cursor:"pointer", padding:"4px 0"}}>
      <div>
        <div style={{fontWeight:600, fontSize:13, color:"var(--ink-2)"}}>{label}</div>
        {sub && <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>{sub}</div>}
      </div>
      <button onClick={()=> onChange && onChange(!checked)} type="button" style={{
        width:38, height:22, borderRadius:99, position:"relative",
        background: checked ? "var(--brand)" : "var(--line)",
        border:0, cursor:"pointer", transition:"background .2s",
        flexShrink:0
      }}>
        <span style={{
          position:"absolute", top:2, left: checked ? 18 : 2,
          width:18, height:18, borderRadius:"50%", background:"white",
          transition:"left .2s ease", boxShadow:"0 1px 3px rgba(0,0,0,.2)"
        }}/>
      </button>
    </label>
  );
}

function SaveBar({ onSave, onDiscard, dirty }){
  if(!dirty) return null;
  return (
    <div style={{
      position:"sticky", bottom: 20, marginTop: 24, padding:"12px 16px",
      background:"var(--ink)", color:"white", borderRadius: 14,
      display:"flex", justifyContent:"space-between", alignItems:"center",
      boxShadow:"0 20px 40px -16px rgba(15,23,42,.4)",
      animation:"saveIn .25s cubic-bezier(.2,.7,.2,1)"
    }}>
      <style>{`@keyframes saveIn{ from{ opacity:0; transform: translateY(10px); } }`}</style>
      <div style={{fontSize:13}}>
        <b>Alterações não salvas.</b> <span style={{opacity:.7}}>Salve antes de sair.</span>
      </div>
      <div style={{display:"flex", gap:8}}>
        <button onClick={onDiscard} style={{padding:"7px 12px", background:"rgba(255,255,255,.1)", color:"white", border:0, borderRadius:8, fontSize:12, cursor:"pointer"}}>Descartar</button>
        <button onClick={onSave} style={{padding:"7px 14px", background:"var(--brand)", color:"white", border:0, borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6}}>
          <Icon.Check size={11} stroke={3}/> Salvar
        </button>
      </div>
    </div>
  );
}

/* — 1. CONTA — */

function AccountSection({ tweaks, setTweak, currentUser, onClose }){
  // Initial values come from the Supabase profile. Email is read-only (auth
  // identity); name/role are editable but persistence is wired in a later
  // sprint — for now the Save bar is UI-only. Role isn't stored in profiles
  // yet, so it defaults to empty.
  const [name, setName] = React.useState(currentUser?.fullName || "");
  const [email, setEmail] = React.useState(currentUser?.email || "");
  const [role, setRole] = React.useState("");
  const [lang, setLang] = React.useState("pt-BR");
  const [tz, setTz] = React.useState("America/Sao_Paulo");
  const [fmt, setFmt] = React.useState("brl");
  const [emails2FA, setEmails2FA] = React.useState(true);
  const [twofa, setTwofa] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const set = (fn)=> { fn(); setDirty(true); };

  const sessions = [
    { device:"Chrome · macOS", loc:"São Paulo, BR", ip:"177.43.•••.42", last:"agora", current:true },
    { device:"Safari · iPhone", loc:"São Paulo, BR", ip:"177.43.•••.42", last:"há 3h" },
    { device:"Edge · Windows", loc:"Rio de Janeiro, BR", ip:"189.6.•••.18", last:"há 2 dias" },
  ];

  return (
    <div>
      <SectionHeader
        title="Conta"
        sub="Gerencie seu perfil, preferências e segurança."
      />

      <SettingsCard title="Perfil" sub="Como você aparece para sua equipe.">
        <div style={{display:"grid", gridTemplateColumns:"96px 1fr", gap:24, alignItems:"flex-start"}}>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
            <div style={{
              width:96, height:96, borderRadius:"50%",
              background:"linear-gradient(135deg, #ff7849, #ff5e93)", color:"white",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:800, fontSize:32, position:"relative",
              boxShadow:"0 12px 24px -8px rgba(255,94,147,.4)"
            }}>
              MA
              <button style={{
                position:"absolute", bottom:-2, right:-2,
                width:28, height:28, borderRadius:"50%", background:"white",
                border:"1px solid var(--line)", color:"var(--ink)", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center"
              }}>
                <Icon.Upload size={12}/>
              </button>
            </div>
            <button style={{
              padding:"3px 8px", border:0, background:"transparent",
              fontSize:11, color:"var(--muted)", cursor:"pointer", fontWeight:600
            }}>Remover</button>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
            <TextField label="Nome completo" value={name} onChange={v=>set(()=>setName(v))}/>
            <TextField label="Cargo" value={role} onChange={v=>set(()=>setRole(v))}/>
            <TextField label="Email" value={email} onChange={v=>set(()=>setEmail(v))} type="email" hint="Usado para login e notificações"/>
            <TextField label="Telefone" placeholder="+55 (11) ••••• ••••" onChange={()=>setDirty(true)}/>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Preferências" sub="Formatos, idioma e fuso horário.">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
          <SelectField label="Idioma" value={lang} onChange={v=>set(()=>setLang(v))}
            options={[{v:"pt-BR", n:"Português (BR)"},{v:"en-US", n:"English (US)"},{v:"es-419", n:"Español"}]}/>
          <SelectField label="Fuso horário" value={tz} onChange={v=>set(()=>setTz(v))}
            options={[{v:"America/Sao_Paulo", n:"GMT−3 · São Paulo"},{v:"America/Los_Angeles", n:"GMT−8 · Los Angeles"},{v:"Europe/London", n:"GMT · Londres"}]}/>
          <SelectField label="Formato numérico" value={fmt} onChange={v=>set(()=>setFmt(v))}
            options={[{v:"brl", n:"1.234,56 · R$"},{v:"us", n:"1,234.56 · US$"},{v:"eu", n:"1.234,56 · €"}]}/>
        </div>
      </SettingsCard>

      <SettingsCard title="Segurança" sub="Senha, autenticação em 2 fatores e dispositivos conectados.">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18}}>
          <TextField label="Senha" value="••••••••••••" readOnly hint="Atualizada há 32 dias"/>
          <div style={{display:"flex", alignItems:"flex-end"}}>
            <button className="btn btn-ghost" style={{padding:"10px 14px"}}>Alterar senha</button>
          </div>
        </div>
        <div style={{borderTop:"1px dashed var(--line-2)", paddingTop:16, display:"flex", flexDirection:"column", gap:6}}>
          <Toggle checked={twofa} onChange={v=>set(()=>setTwofa(v))}
            label="Autenticação em 2 fatores"
            sub="Use app autenticador ou SMS. Recomendado para contas Pro/Team."/>
          <Toggle checked={emails2FA} onChange={v=>set(()=>setEmails2FA(v))}
            label="Avisar por email em novos logins"
            sub="Alerta sempre que um novo dispositivo acessar sua conta."/>
        </div>
        <div style={{marginTop:20, paddingTop:16, borderTop:"1px dashed var(--line-2)"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
            <div style={{fontWeight:600, fontSize:13}}>Sessões ativas <span className="mono" style={{color:"var(--muted)", fontWeight:500}}>· {sessions.length}</span></div>
            <button style={{padding:"4px 10px", background:"transparent", border:"1px solid var(--line)", borderRadius:8, fontSize:11, fontWeight:600, color:"#c9234a", cursor:"pointer"}}>Encerrar todas</button>
          </div>
          <div style={{display:"flex", flexDirection:"column"}}>
            {sessions.map((s,i)=>(
              <div key={i} style={{display:"grid", gridTemplateColumns:"24px 1.4fr 1fr .7fr auto", gap:10, alignItems:"center", padding:"10px 0", borderTop: i===0?"none":"1px solid var(--line-2)"}}>
                <span style={{width:8, height:8, borderRadius:"50%", background: s.current?"#0a8a4a":"var(--muted)"}}/>
                <div>
                  <div style={{fontWeight:600, fontSize:13}}>{s.device} {s.current && <span className="chip" style={{padding:"1px 6px", fontSize:10, background:"#e7f7ef", color:"#0a8a4a", marginLeft:6}}>esta sessão</span>}</div>
                  <div style={{fontSize:11, color:"var(--muted)"}}>{s.loc} · {s.ip}</div>
                </div>
                <div style={{fontSize:12, color:"var(--muted)"}}>{s.last}</div>
                <div style={{fontSize:11, color:"var(--muted)"}}>{s.current?"agora":"online"}</div>
                {!s.current && (
                  <button style={{padding:"4px 8px", background:"transparent", border:"1px solid var(--line)", borderRadius:6, fontSize:11, cursor:"pointer", color:"var(--muted)"}}>Encerrar</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Zona de perigo" sub="Ações irreversíveis." action={null}>
        <div style={{padding:16, border:"1px solid #ffd2dd", background:"#fff7f9", borderRadius:12, display:"flex", justifyContent:"space-between", alignItems:"center", gap:18, flexWrap:"wrap"}}>
          <div>
            <div style={{fontWeight:700, fontSize:13, color:"#c9234a", marginBottom:4}}>Excluir conta</div>
            <div style={{fontSize:12, color:"var(--muted)"}}>Remove permanentemente sua conta, workspace e todos os dashboards. Esta ação não pode ser desfeita.</div>
          </div>
          <button style={{padding:"8px 14px", background:"white", border:"1px solid #c9234a", color:"#c9234a", borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer"}}>Excluir conta</button>
        </div>
      </SettingsCard>

      <SaveBar dirty={dirty} onSave={()=>setDirty(false)} onDiscard={()=>setDirty(false)}/>
    </div>
  );
}

function SelectField({ label, value, onChange, options }){
  return (
    <label style={{display:"block"}}>
      <div style={{fontSize:12, fontWeight:600, color:"var(--ink-2)", marginBottom:6}}>{label}</div>
      <select value={value} onChange={e=>onChange && onChange(e.target.value)} style={{
        width:"100%", padding:"10px 12px", border:"1px solid var(--line)", borderRadius:10,
        fontSize:14, fontFamily:"inherit", color:"var(--ink)", outline:"none",
        background:"white", cursor:"pointer", appearance:"none",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%235b6478' d='M6 8L0 0h12z'/></svg>")`,
        backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center"
      }}>
        {options.map(o=><option key={o.v} value={o.v}>{o.n}</option>)}
      </select>
    </label>
  );
}


/* — 3. FATURAMENTO — */

function BillingSection({ tweaks, setTweak }){
  const isPro = tweaks.plan === "pro";

  // Free users have no real billing history yet — showing fake "Pro · Mensal"
  // rows here would be misleading. The empty-state below kicks in when the
  // list is empty. When Stripe lands, populate from the real invoice API.
  const invoices = isPro ? [
    { id:"INV-2026-005", date:"01/mai/2026", amount:29.00, st:"paid", desc:"Pro · Mensal" },
    { id:"INV-2026-004", date:"01/abr/2026", amount:29.00, st:"paid", desc:"Pro · Mensal" },
    { id:"INV-2026-003", date:"01/mar/2026", amount:29.00, st:"paid", desc:"Pro · Mensal" },
    { id:"INV-2026-002", date:"01/fev/2026", amount:29.00, st:"paid", desc:"Pro · Mensal" },
    { id:"INV-2026-001", date:"15/jan/2026", amount:0.00, st:"paid", desc:"Pro · Trial" },
  ] : [];

  const usage = [
    { l:"Dashboards", v: isPro ? 14 : 3, max: isPro ? "ilimitado" : 5, pct: isPro ? 18 : 60, c: tweaks.accent },
    { l:"Análises da IA neste mês", v: isPro ? 86 : 5, max: isPro ? 1000 : 10, pct: isPro ? 8.6 : 50, c: "#7a5cff" },
    { l:"Exportações no mês", v: isPro ? 32 : 0, max: isPro ? "ilimitado" : 0, pct: isPro ? 18 : 0, c: "#0a8a4a", locked: !isPro },
  ];

  return (
    <div>
      <SectionHeader title="Faturamento" sub="Plano atual, uso, pagamentos e notas fiscais."/>

      {/* Big plan card */}
      <div style={{
        padding: 32, borderRadius: 18, marginBottom: 18,
        background: isPro
          ? `linear-gradient(135deg, ${tweaks.accent}, var(--violet))`
          : "linear-gradient(180deg, #fafbfe, white)",
        color: isPro ? "white" : "var(--ink)",
        border: isPro ? "none" : "1px solid var(--line)",
        position:"relative", overflow:"hidden"
      }}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:24, flexWrap:"wrap"}}>
          <div>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px",
              borderRadius:99, background: isPro ? "rgba(255,255,255,.18)" : "var(--brand-soft)",
              color: isPro ? "white" : "var(--brand-2)",
              fontSize:11, fontWeight:700, marginBottom:12
            }}>
              <Icon.Crown size={11}/> {isPro ? "Plano Pro · Ativo" : "Plano Free"}
            </div>
            <h2 style={{margin:"0 0 6px", fontSize:32, fontWeight:800, letterSpacing:"-.025em"}}>
              {isPro ? "R$ 29" : "R$ 0"}<span style={{fontSize:14, fontWeight:500, opacity:.8}}>/mês</span>
            </h2>
            <div style={{fontSize:13, opacity: isPro ? .9 : 1, color: isPro ? "white" : "var(--muted)"}}>
              {isPro ? "Próxima cobrança em 14 dias · 03/jun/2026" : "Sem cobranças · upgrade quando quiser"}
            </div>
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {isPro ? (
              <>
                <button style={{padding:"10px 14px", background:"rgba(255,255,255,.18)", color:"white", border:0, borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer"}}>Mudar plano</button>
                <button onClick={()=>setTweak({plan:"free"})} style={{padding:"10px 14px", background:"transparent", color:"white", border:"1px solid rgba(255,255,255,.3)", borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer"}}>Cancelar Pro</button>
              </>
            ) : (
              <button onClick={()=> window.__dashUpgrade && window.__dashUpgrade()} className="btn btn-primary" style={{padding:"10px 16px"}}>
                <Icon.Crown size={14}/> Fazer upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Usage */}
      <SettingsCard title="Uso neste mês" sub="Limites por plano. Resetam todo dia 1º.">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
          {usage.map((u,i)=>(
            <div key={i} style={{padding:"14px 16px", border:"1px solid var(--line)", borderRadius:12, background: u.locked ? "#fafbfe" : "white", opacity: u.locked ? .7 : 1}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
                <div style={{fontSize:12, color:"var(--muted)", fontWeight:600}}>{u.l}</div>
                {u.locked && <Icon.Lock size={12} color="var(--muted)"/>}
              </div>
              <div style={{display:"flex", alignItems:"baseline", gap:4, marginBottom:6}}>
                <span style={{fontSize:24, fontWeight:800, letterSpacing:"-.02em", color: u.c}}>{u.v}</span>
                <span style={{fontSize:12, color:"var(--muted)"}}>/ {u.max}</span>
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
        sub={isPro ? "Cartão usado para a assinatura." : "Cadastre quando fizer upgrade."}
        action={isPro && <button className="btn btn-ghost" style={{padding:"6px 12px", fontSize:12}}>Atualizar</button>}>
        {isPro ? (
          <div style={{display:"flex", alignItems:"center", gap:14, padding:"14px 16px", border:"1px solid var(--line)", borderRadius:12, background:"#fafbfe"}}>
            <div style={{
              width:56, height:36, borderRadius:6,
              background:"linear-gradient(135deg, #1b2240, #0b1020)", color:"white",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:11, fontFamily:"'Geist Mono', monospace"
            }}>VISA</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600, fontSize:14, fontFamily:"'Geist Mono', monospace"}}>•••• •••• •••• 4242</div>
              <div style={{fontSize:12, color:"var(--muted)"}}>Maria Andrade · expira 12/2028</div>
            </div>
            <span className="chip" style={{background:"#e7f7ef", color:"#0a8a4a"}}>Padrão</span>
          </div>
        ) : (
          <div style={{padding:16, border:"1px dashed var(--line)", borderRadius:12, textAlign:"center", color:"var(--muted)", fontSize:13}}>
            Nenhum cartão cadastrado. <a style={{color:"var(--brand)", fontWeight:600, cursor:"pointer"}} onClick={()=> window.__dashUpgrade && window.__dashUpgrade()}>Adicionar agora</a>
          </div>
        )}
      </SettingsCard>

      {/* Billing address */}
      <SettingsCard title="Endereço de cobrança" sub="Aparece nas notas fiscais emitidas.">
        <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:14, marginBottom: 14}}>
          <TextField label="Razão social / Nome" value="North Star Tecnologia LTDA" readOnly/>
          <TextField label="CNPJ" value="12.345.678/0001-90" suffix="BR" readOnly/>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:14}}>
          <TextField label="Endereço" value="Av. Paulista, 1000, sala 1801" readOnly/>
          <TextField label="Cidade" value="São Paulo" readOnly/>
          <TextField label="CEP" value="01310-100" readOnly/>
        </div>
      </SettingsCard>

      {/* Invoices */}
      <SettingsCard title="Notas fiscais"
        sub="Histórico das últimas cobranças."
        action={invoices.length > 0 && <button className="btn btn-ghost" style={{padding:"6px 12px", fontSize:12}}><Icon.Download size={12}/> Baixar tudo</button>}>
        {invoices.length === 0 ? (
          <div style={{
            padding:"32px 24px", border:"1px dashed var(--line)", borderRadius:12,
            background:"#fafbfe", textAlign:"center"
          }}>
            <div style={{
              width:44, height:44, margin:"0 auto 12px", borderRadius:11,
              background:"var(--line-2)", color:"var(--muted)",
              display:"flex", alignItems:"center", justifyContent:"center"
            }}>
              <Icon.Doc size={20}/>
            </div>
            <div style={{fontWeight:700, fontSize:14, marginBottom:6}}>Sem faturas ainda</div>
            <div style={{fontSize:12.5, color:"var(--muted)", lineHeight:1.5, maxWidth:340, margin:"0 auto"}}>
              Suas cobranças aparecerão aqui quando você ativar o Pro.
            </div>
          </div>
        ) : (
          <div>
            <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr 1.2fr .9fr .8fr", gap:12, padding:"8px 4px", borderBottom:"1px solid var(--line-2)"}}>
              {["Fatura","Data","Descrição","Valor","Status"].map(h=>(
                <div key={h} className="mono" style={{fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase"}}>{h}</div>
              ))}
            </div>
            {invoices.map((inv,i)=>(
              <div key={inv.id} style={{display:"grid", gridTemplateColumns:"1.4fr 1fr 1.2fr .9fr .8fr", gap:12, alignItems:"center", padding:"12px 4px", borderTop: i===0?"none":"1px solid var(--line-2)"}}>
                <div className="mono" style={{fontSize:13, fontWeight:600}}>{inv.id}</div>
                <div className="mono" style={{fontSize:12, color:"var(--muted)"}}>{inv.date}</div>
                <div style={{fontSize:13}}>{inv.desc}</div>
                <div className="mono" style={{fontSize:13, fontWeight:600, fontVariantNumeric:"tabular-nums"}}>R$ {inv.amount.toFixed(2).replace(".",",")}</div>
                <div style={{display:"flex", alignItems:"center", gap:6}}>
                  <span className="chip" style={{background:"#e7f7ef", color:"#0a8a4a", padding:"2px 8px"}}>Pago</span>
                  <button style={{padding:"4px 6px", background:"transparent", border:0, color:"var(--muted)", cursor:"pointer"}} title="Baixar PDF"><Icon.Download size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

/* — 4. HISTÓRICO DE ANÁLISES — */

function HistorySection({ tweaks }){
  const [filter, setFilter] = React.useState("all"); // all | ai | mine
  const isFree = tweaks.plan === "free";

  const events = [
    { d:"hoje", time:"14:32", kind:"ai", icon:<Icon.Sparkle size={14}/>, c:"#7a5cff", t:"Reanálise por IA", sub:"vendas_exemplo.csv · 120 linhas analisadas", details:"3 insights novos · 1 risco identificado · confiança média 89%" },
    { d:"hoje", time:"14:18", kind:"mine", icon:<Icon.Wand size={14}/>, c:tweaks.accent, t:"Layout editado", sub:'Dashboard "Visão geral · vendas Q3"', details:"5 blocos reposicionados · 1 KPI adicionado" },
    { d:"hoje", time:"13:42", kind:"mine", icon:<Icon.Download size={14}/>, c:"#0a8a4a", t:"Export PDF gerado", sub:"vendas_q3.pdf · A4 retrato · 2480×3508 px", details:"Incluiu resumo, 4 KPIs, 4 gráficos e ranking" },
    { d:"ontem", time:"19:04", kind:"ai", icon:<Icon.Sparkle size={14}/>, c:"#7a5cff", t:"Análises da IA reexecutadas", sub:"vendas_exemplo.csv · contexto: regiões CO + NE", details:"Comparativo regional · 4 insights · 2 recomendações" },
    { d:"ontem", time:"15:21", kind:"system", icon:<Icon.Refresh size={14}/>, c:"var(--muted)", t:"Fonte de dados atualizada", sub:"vendas_exemplo.csv", details:"108 → 120 linhas (+12) · schema sem alterações" },
    { d:"qui, 16/mai", time:"10:08", kind:"mine", icon:<Icon.Upload size={14}/>, c:"#ff7849", t:"Novo arquivo enviado", sub:"vendas_exemplo.csv · CSV · 86 KB", details:"10 colunas detectadas · 120 linhas" },
    { d:"qua, 15/mai", time:"17:55", kind:"ai", icon:<Icon.Idea size={14}/>, c:"#7a5cff", t:"Sugestão da IA aceita", sub:"Adicionou bloco 'Cohort de retenção'", details:"Sugestão tinha 81% de confiança" },
    { d:"seg, 13/mai", time:"09:30", kind:"mine", icon:<Icon.Grid size={14}/>, c:tweaks.accent, t:"Novo dashboard criado", sub:'"Visão geral · vendas Q3"', details:"4 KPIs + 4 gráficos + ranking + insights da IA" },
  ];

  const filtered = events.filter(e => filter==="all" || (filter==="ai" && e.kind==="ai") || (filter==="mine" && e.kind==="mine"));

  // Defensive empty state — fires once the demo `events` array is replaced by
  // a real data source that may legitimately be empty (brand-new user, or all
  // events filtered out).
  if(events.length === 0){
    return (
      <div>
        <SectionHeader title="Histórico de análises" sub="Linha do tempo de tudo que a IA e sua equipe fizeram."/>
        <div style={{
          padding:"48px 24px", border:"1px dashed var(--line)", borderRadius:14,
          background:"#fafbfe", textAlign:"center"
        }}>
          <div style={{
            width:48, height:48, margin:"0 auto 14px", borderRadius:12,
            background:"var(--line-2)", color:"var(--muted)",
            display:"flex", alignItems:"center", justifyContent:"center"
          }}>
            <Icon.Refresh size={20}/>
          </div>
          <div style={{fontWeight:700, fontSize:15, marginBottom:6}}>Nada por aqui ainda</div>
          <div style={{fontSize:13, color:"var(--muted)", lineHeight:1.55, maxWidth:360, margin:"0 auto"}}>
            Suas atividades recentes aparecerão aqui assim que você usar a IA, editar um dashboard ou exportar um arquivo.
          </div>
        </div>
      </div>
    );
  }

  // Free users see only the most recent event clearly; everything else is blurred/locked.
  const visibleEvents = isFree ? filtered.slice(0, 1) : filtered;
  const hiddenEvents = isFree ? filtered.slice(1) : [];

  // Group by day
  const groups = {};
  visibleEvents.forEach(e => { (groups[e.d] = groups[e.d] || []).push(e); });
  const hiddenGroups = {};
  hiddenEvents.forEach(e => { (hiddenGroups[e.d] = hiddenGroups[e.d] || []).push(e); });

  return (
    <div>
      <SectionHeader title="Histórico de análises"
        sub="Linha do tempo de tudo que a IA e sua equipe fizeram."
        action={
          <button className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}} disabled={isFree} title={isFree?"Disponível no Pro":""}>
            {isFree && <Icon.Lock size={13}/>} <Icon.Download size={13}/> Exportar CSV
          </button>
        }/>

      {/* Stats */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14, marginBottom:18}}>
        {[
          {l:"Análises da IA · este mês", v:isFree?1:86, d:isFree?"Limite do Free":"+18 vs. mês anterior", c:"#7a5cff", dDir:"up"},
          {l:"Reanálises", v:isFree?0:32, d:isFree?"Recurso do Pro":"média 4× por dashboard", c:tweaks.accent, dDir:"flat"},
          {l:"Exports gerados", v:isFree?0:24, d:isFree?"Recurso do Pro":"PDF + PNG combinados", c:"#0a8a4a", dDir:"up"},
        ].map((s,i)=>(
          <div key={i} style={{padding:"16px 18px", background:"white", border:"1px solid var(--line)", borderRadius:14, opacity: isFree && i>0 ? 0.6 : 1}}>
            <div style={{fontSize:11, color:"var(--muted)", letterSpacing:".06em", textTransform:"uppercase", fontWeight:600, marginBottom:6, display:"flex", justifyContent:"space-between"}}>
              {s.l}
              {isFree && i>0 && <Icon.Lock size={11}/>}
            </div>
            <div style={{fontSize:28, fontWeight:800, letterSpacing:"-.02em", color: s.c}}>{s.v}</div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* Filters — disabled on Free since there's only 1 event */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:12, flexWrap:"wrap", opacity: isFree ? 0.55 : 1, pointerEvents: isFree ? "none" : "auto"}}>
        <div className="seg" style={{padding:3, background:"var(--line-2)"}}>
          {[["all","Todos"],["ai","IA"],["mine","Equipe"]].map(([k,n])=>(
            <button key={k} className={filter===k?"on":""} onClick={()=>setFilter(k)} style={{padding:"6px 12px", fontSize:13}}>
              {n} <span className="mono" style={{marginLeft:4, opacity:.6}}>· {k==="all"?events.length: events.filter(e=>e.kind===k).length}</span>
            </button>
          ))}
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <input placeholder="Buscar evento…" style={{
              padding:"8px 12px 8px 32px", border:"1px solid var(--line)", borderRadius:10,
              fontSize:13, outline:"none", width:240
            }}/>
            <span style={{position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--muted)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            </span>
          </div>
          <div className="seg" style={{padding:3, background:"var(--line-2)"}}>
            {[["7d","7d"],["30d","30d"],["all","Tudo"]].map(([k,n])=>(
              <button key={k} className={k==="30d"?"on":""} style={{padding:"6px 10px", fontSize:12}}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {isFree && (
        <div style={{
          marginBottom:14, padding:"10px 14px",
          background:"linear-gradient(90deg, var(--brand-soft), white)",
          border:"1px solid var(--brand-soft)", borderRadius:10,
          display:"flex", alignItems:"center", gap:10, fontSize:12.5, color:"var(--ink-2)"
        }}>
          <Icon.Sparkle size={14} color="var(--brand)"/>
          <span style={{flex:1}}>
            No plano Free você vê apenas a <b>última análise</b>. Faça upgrade para acessar todo o histórico, busca, filtros e export.
          </span>
          <button onClick={()=> window.__dashUpgrade && window.__dashUpgrade()} style={{padding:"5px 12px", background:"var(--brand)", color:"white", border:0, borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer"}}>
            <Icon.Crown size={11}/> Liberar histórico
          </button>
        </div>
      )}

      {/* Timeline (visible events) */}
      <div style={{background:"white", border:"1px solid var(--line)", borderRadius:16, padding:"8px 0", marginBottom: isFree ? 14 : 0}}>
        {Object.entries(groups).map(([day, items], gi)=>(
          <div key={day}>
            <div style={{padding:"12px 22px 8px", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em"}}>
              {day}
              {isFree && <span className="chip" style={{marginLeft:8, padding:"1px 6px", fontSize:9, background:"#e7f7ef", color:"#0a8a4a"}}>última análise</span>}
            </div>
            {items.map((e,i)=>(
              <div key={i} style={{
                display:"grid", gridTemplateColumns:"54px 36px 1fr auto", gap:12,
                padding:"12px 22px", alignItems:"flex-start",
                borderTop: i===0?"none":"1px dashed var(--line-2)"
              }}>
                <div className="mono" style={{fontSize:12, color:"var(--muted)", paddingTop:2, fontVariantNumeric:"tabular-nums"}}>{e.time}</div>
                <div style={{
                  width:32, height:32, borderRadius:10, flexShrink:0,
                  background:`color-mix(in oklch, ${e.c} 14%, white)`, color: e.c,
                  display:"inline-flex", alignItems:"center", justifyContent:"center"
                }}>{e.icon}</div>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                    <span style={{fontWeight:700, fontSize:14}}>{e.t}</span>
                    <span className="chip" style={{padding:"1px 8px", fontSize:10, background:`color-mix(in oklch, ${e.c} 12%, white)`, color: e.c}}>
                      {e.kind==="ai" ? "IA" : e.kind==="mine" ? "Você" : "Sistema"}
                    </span>
                  </div>
                  <div style={{fontSize:13, color:"var(--ink-2)", marginTop:3}}>{e.sub}</div>
                  <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>{e.details}</div>
                </div>
                <div style={{display:"flex", gap:4, alignItems:"center"}}>
                  <button style={{padding:"5px 10px", background:"white", border:"1px solid var(--line)", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer", color:"var(--ink-2)"}}>Abrir</button>
                  <button style={{padding:"5px 6px", background:"transparent", border:0, color:"var(--muted)", cursor:"pointer"}}><Icon.More size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        ))}
        {!isFree && (
          <div style={{padding:"16px 22px", textAlign:"center", borderTop:"1px solid var(--line-2)"}}>
            <button className="btn btn-ghost" style={{padding:"8px 14px", fontSize:13}}>Carregar mais</button>
          </div>
        )}
      </div>

      {/* Locked extra events for free users */}
      {isFree && hiddenEvents.length > 0 && (
        <div style={{position:"relative", marginTop: 10}}>
          <div className="paywall-blur" style={{position:"relative"}}>
            <div className="pw-content" style={{pointerEvents:"none", userSelect:"none"}}>
              <div style={{background:"white", border:"1px solid var(--line)", borderRadius:16, padding:"8px 0"}}>
                {Object.entries(hiddenGroups).slice(0,3).map(([day, items])=>(
                  <div key={day}>
                    <div style={{padding:"12px 22px 8px", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em"}}>{day}</div>
                    {items.slice(0,3).map((e,i)=>(
                      <div key={i} style={{display:"grid", gridTemplateColumns:"54px 36px 1fr auto", gap:12, padding:"12px 22px", alignItems:"flex-start", borderTop: i===0?"none":"1px dashed var(--line-2)"}}>
                        <div className="mono" style={{fontSize:12, color:"var(--muted)"}}>{e.time}</div>
                        <div style={{width:32, height:32, borderRadius:10, background:`color-mix(in oklch, ${e.c} 14%, white)`, color:e.c, display:"flex", alignItems:"center", justifyContent:"center"}}>{e.icon}</div>
                        <div>
                          <div style={{fontWeight:700, fontSize:14}}>{e.t}</div>
                          <div style={{fontSize:13, color:"var(--ink-2)"}}>{e.sub}</div>
                        </div>
                        <button style={{padding:"5px 10px", border:"1px solid var(--line)", borderRadius:8, fontSize:11, fontWeight:600}}>Abrir</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="pw-overlay" style={{borderRadius:16}}>
              <div className="pw-card">
                <div style={{width:44, height:44, margin:"0 auto 10px", borderRadius:11, background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`, color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Refresh size={20}/>
                </div>
                <div style={{fontWeight:800, fontSize:17, marginBottom:6}}>+{hiddenEvents.length} análises anteriores</div>
                <div style={{fontSize:12.5, color:"var(--muted)", lineHeight:1.55, marginBottom:14}}>
                  Histórico completo, busca por evento, filtros por período e tipo, e export em CSV são recursos do plano Pro.
                </div>
                <div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap"}}>
                  <button onClick={()=> window.__dashUpgrade && window.__dashUpgrade()} className="btn btn-primary" style={{padding:"9px 16px", fontSize:13}}>
                    <Icon.Crown size={13}/> Experimentar Pro
                  </button>
                  <button onClick={()=> window.__dashOpenPlans && window.__dashOpenPlans()} className="btn btn-ghost" style={{padding:"9px 14px", fontSize:13}}>Ver planos</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* — 5. INDIQUE E GANHE — */

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
        sub="Ganhe 30 dias de Pro grátis a cada amigo que assinar."/>

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
    </div>
  );
}

Object.assign(window, { AccountView });
