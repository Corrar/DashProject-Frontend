/* Plans / pricing view — shown to logged-in users who click "Experimentar Pro". */

function PlansView({ tweaks, onSelectPro, onClose }){
  const [cycle, setCycle] = React.useState("monthly"); // monthly | yearly

  const monthly = { free: 0, pro: 29 };
  const yearly  = { free: 0, pro: 23 }; // ~20% off
  const price = cycle === "monthly" ? monthly : yearly;
  const period = cycle === "monthly" ? "/mês" : "/mês · cobrado anualmente";

  const planList = [
    {
      k:"free",
      name:"Free",
      tagline:"Para experimentar.",
      cta: tweaks.plan==="free" ? "Plano atual" : "Permanecer no Free",
      ctaDisabled: tweaks.plan==="free",
      ctaStyle: "ghost",
      features: [
        { ok:true,  t:"Upload CSV / JSON / Excel" },
        { ok:true,  t:"Dashboard gerado por IA" },
        { ok:true,  t:"5 tipos de gráfico" },
        { ok:true,  t:"Filtros por período" },
        { ok:false, t:"Análises da IA com narrativa" },
        { ok:false, t:"Edição completa do layout" },
        { ok:false, t:"Exportar PDF/PNG" },
        { ok:false, t:"Dashboards avançados" },
      ]
    },
    {
      k:"pro",
      name:"Pro",
      tagline:"Para profissionais e equipes pequenas.",
      highlight: true,
      cta: tweaks.plan==="pro" ? "Plano atual" : "Começar teste grátis",
      ctaDisabled: tweaks.plan==="pro",
      ctaStyle: "primary",
      features: [
        { ok:true, t:"Tudo do Free, e mais:", bold:true },
        { ok:true, t:"Análises da IA: resumo, riscos, recomendações" },
        { ok:true, t:"Edição completa: drag-and-drop, ⅓/½/⅔/full" },
        { ok:true, t:"KPIs, gráficos e blocos ilimitados" },
        { ok:true, t:"Dashboards avançados (cohort, outliers, sazonalidade)" },
        { ok:true, t:"Exportar PDF/PNG com pré-visualização" },
        { ok:true, t:"Reanálise da IA sob demanda" },
        { ok:true, t:"Compartilhamento por link" },
      ]
    },
  ];

  const faqs = [
    { q:"Como funciona o teste grátis do Pro?", a:"7 dias completos do plano Pro, sem cartão de crédito. Após o período, sua conta volta ao Free automaticamente — você só é cobrado se confirmar a assinatura." },
    { q:"Meus dados ficam seguros?", a:"Sim. O processamento dos arquivos é feito no seu navegador. Apenas metadados (nomes de colunas e tipos) podem ser enviados para a IA com seu consentimento. Estamos em conformidade com LGPD e SOC 2." },
    { q:"Posso cancelar quando quiser?", a:"Sem fidelidade. Cancele no painel e mantenha acesso até o fim do ciclo já pago. Seus dashboards continuam disponíveis em modo de visualização." },
    { q:"Posso exportar em outro formato?", a:"Pro inclui PDF e PNG com layout customizado." },
  ];

  const compare = [
    { f:"Dashboards gerados por IA", free:true, pro:true },
    { f:"Bases de dados aceitas", free:"CSV, JSON, Excel", pro:"+ TSV, Parquet, Google Sheets" },
    { f:"Análises da IA", free:false, pro:true },
    { f:"Edição do layout", free:false, pro:true },
    { f:"Tipos de gráfico", free:"5", pro:"Ilimitados" },
    { f:"Histórico de versões", free:"7 dias", pro:"90 dias" },
    { f:"Exportar PDF/PNG", free:false, pro:true },
    { f:"Compartilhamento por link", free:false, pro:true },
    { f:"Suporte", free:"Comunidade", pro:"Email · 24h" },
  ];

  const Cell = ({ v })=> {
    if(v === true) return <span style={{color:"#0a8a4a", display:"inline-flex"}}><Icon.Check size={16} stroke={3}/></span>;
    if(v === false) return <span style={{color:"var(--muted)", opacity:.45}}>—</span>;
    return <span style={{fontSize:13, color:"var(--ink-2)"}}>{v}</span>;
  };

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      {/* Mini topbar */}
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
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            {tweaks.authed && (
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)"}}>
                Sessão ativa · plano {tweaks.plan === "pro" ? "Pro" : "Free"}
              </span>
            )}
            <button onClick={onClose} className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}}>
              <Icon.Arrow size={13} style={{transform:"rotate(180deg)"}}/> Voltar
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth: 1180, margin:"0 auto", padding:"56px 24px 80px"}}>
        {/* Hero */}
        <div className="rv" style={{textAlign:"center", marginBottom: 36}}>
          <div className="eyebrow" style={{marginBottom:18}}>
            <span className="dot"/> Planos
          </div>
          <h1 style={{margin:"0 0 12px", fontSize:48, fontWeight:800, letterSpacing:"-.03em", lineHeight:1.05}}>
            Escolha o plano ideal<br/>para você.
          </h1>
          <p style={{margin:"0 auto 28px", fontSize:16, color:"var(--muted)", maxWidth:520, lineHeight:1.55}}>
            Comece grátis. Faça upgrade quando precisar de análises da IA, edição completa e exportação.
          </p>

          {/* Cycle toggle */}
          <div style={{display:"inline-flex", alignItems:"center", gap:10}}>
            <div className="seg" style={{padding:4, background:"white", border:"1px solid var(--line)", borderRadius:12}}>
              <button className={cycle==="monthly"?"on":""} onClick={()=>setCycle("monthly")} style={{padding:"8px 16px", fontSize:13}}>Mensal</button>
              <button className={cycle==="yearly"?"on":""} onClick={()=>setCycle("yearly")} style={{padding:"8px 16px", fontSize:13}}>
                Anual
                <span className="chip" style={{marginLeft:8, padding:"1px 6px", fontSize:10, background:"#e7f7ef", color:"#0a8a4a"}}>−20%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="rv" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, marginBottom: 48, maxWidth: 760, marginLeft:"auto", marginRight:"auto"}}>
          {planList.map(p=>{
            const isCurrent = (p.k === tweaks.plan) || (p.k==="free" && tweaks.plan!=="pro");
            const hl = p.highlight;
            return (
              <div key={p.k} className={hl?"lift":""} style={{
                padding: 28, borderRadius: 18,
                background: hl ? "linear-gradient(180deg, #f5f8ff, white)" : "white",
                border: hl ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                boxShadow: hl ? "0 30px 60px -28px rgba(47,107,255,.35)" : "none",
                position:"relative", display:"flex", flexDirection:"column"
              }}>
                {hl && <span className="chip" style={{position:"absolute", top:20, right:20, background:"var(--ink)", color:"white"}}><Icon.Crown size={11}/> Mais popular</span>}
                {isCurrent && !hl && <span className="chip" style={{position:"absolute", top:20, right:20, background:"#e7f7ef", color:"#0a8a4a"}}>Atual</span>}
                {isCurrent && hl && <span className="chip" style={{position:"absolute", top:20, right:20, background:"var(--ink)", color:"white"}}>Seu plano</span>}

                <div style={{fontWeight:700, fontSize:18}}>{p.name}</div>
                <div style={{fontSize:13, color:"var(--muted)", marginTop:4, marginBottom:22}}>{p.tagline}</div>

                <div style={{marginBottom:18, minHeight: 68}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:4}}>
                    <span style={{fontSize:44, fontWeight:800, letterSpacing:"-.03em", color: hl ? "var(--brand)" : "var(--ink)"}}>R$ {price[p.k]}</span>
                    <span style={{fontSize:14, color:"var(--muted)"}}>{p.k === "free" ? "/sempre" : "/mês"}</span>
                  </div>
                  {p.k !== "free" && cycle === "yearly" && (
                    <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>cobrado anualmente · R$ {price[p.k]*12}/ano</div>
                  )}
                </div>

                <ul style={{listStyle:"none", padding:0, margin:"0 0 24px", display:"flex", flexDirection:"column", gap:10, flex:1}}>
                  {p.features.map((f,i)=>(
                    <li key={i} style={{display:"flex", gap:10, alignItems:"flex-start", fontSize:13.5}}>
                      <span style={{
                        width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1,
                        background: f.ok ? (hl?"var(--brand)":"var(--brand-soft)") : "var(--line-2)",
                        color: f.ok ? (hl?"white":"var(--brand)") : "var(--muted)",
                        display:"inline-flex", alignItems:"center", justifyContent:"center"
                      }}>
                        {f.ok ? <Icon.Check size={11} stroke={3}/> : <span style={{width:6, height:1, background:"currentColor"}}/>}
                      </span>
                      <span style={{
                        color: f.ok ? "var(--ink-2)" : "var(--muted)",
                        fontWeight: f.bold ? 700 : 500,
                        lineHeight: 1.4
                      }}>{f.t}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={p.ctaDisabled}
                  onClick={()=>{
                    if(p.ctaDisabled) return;
                    if(p.k === "pro") onSelectPro();
                  }}
                  className={`btn ${p.ctaStyle==="primary"?"btn-primary":"btn-ghost"}`}
                  style={{
                    width:"100%", justifyContent:"center", padding:"12px",
                    opacity: p.ctaDisabled ? 0.6 : 1,
                    cursor: p.ctaDisabled ? "default" : "pointer"
                  }}>
                  {p.k === "pro" && !p.ctaDisabled && <Icon.Crown size={14}/>}
                  {p.cta}
                </button>
                {p.k === "pro" && !p.ctaDisabled && (
                  <div style={{textAlign:"center", marginTop:8, fontSize:11, color:"var(--muted)"}}>
                    7 dias grátis · sem cartão · cancele quando quiser
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="rv" style={{
          background:"white", border:"1px solid var(--line)", borderRadius: 18, padding: 28, marginBottom: 48
        }}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom: 18}}>
            <div>
              <h2 style={{margin:"0 0 4px", fontSize:22, fontWeight:800, letterSpacing:"-.02em"}}>Comparativo completo</h2>
              <div style={{fontSize:13, color:"var(--muted)"}}>Veja tudo o que muda entre os planos.</div>
            </div>
            <span className="chip" style={{background:"var(--line-2)"}}>{compare.length} recursos</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse", minWidth: 700}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left", padding:"12px 16px", fontSize:11, color:"var(--muted)", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", borderBottom:"1px solid var(--line-2)"}}>Recurso</th>
                  {["Free","Pro"].map(n=>(
                    <th key={n} style={{textAlign:"center", padding:"12px 16px", fontSize:14, fontWeight:700, color:"var(--ink)", borderBottom:"1px solid var(--line-2)", background: n==="Pro"?"var(--brand-soft)":"transparent"}}>
                      {n}
                      {n==="Pro" && <span style={{marginLeft:6, color:"var(--brand)"}}>★</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.map((row, i)=>(
                  <tr key={i}>
                    <td style={{padding:"12px 16px", fontSize:13, color:"var(--ink-2)", fontWeight:500, borderBottom: i<compare.length-1?"1px solid var(--line-2)":"none"}}>{row.f}</td>
                    <td style={{padding:"12px 16px", textAlign:"center", borderBottom: i<compare.length-1?"1px solid var(--line-2)":"none"}}><Cell v={row.free}/></td>
                    <td style={{padding:"12px 16px", textAlign:"center", background:"var(--brand-soft)", borderBottom: i<compare.length-1?"1px solid var(--line-2)":"none"}}><Cell v={row.pro}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Logos / trust */}
        <div className="rv" style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16, marginBottom: 48}}>
          {[
            {i:<Icon.Lock size={16}/>, t:"100% no navegador", d:"Seus dados não saem do seu dispositivo durante a análise."},
            {i:<Icon.Check size={16} stroke={3}/>, t:"LGPD & SOC 2", d:"Conformidade e auditoria contínua."},
            {i:<Icon.Bolt size={16}/>, t:"Velocidade", d:"Tempo médio de primeiro insight: 12 segundos."},
            {i:<Icon.Refresh size={16}/>, t:"Sem fidelidade", d:"Cancele a qualquer momento, sem multas."},
          ].map((it,i)=>(
            <div key={i} style={{padding:"18px 20px", background:"white", border:"1px solid var(--line)", borderRadius:14, display:"flex", flexDirection:"column", gap:8}}>
              <span style={{
                width:36, height:36, borderRadius:10, background:"var(--brand-soft)", color:"var(--brand)",
                display:"inline-flex", alignItems:"center", justifyContent:"center"
              }}>{it.i}</span>
              <div style={{fontWeight:700, fontSize:14}}>{it.t}</div>
              <div style={{fontSize:12.5, color:"var(--muted)", lineHeight:1.5}}>{it.d}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="rv" style={{maxWidth: 760, margin:"0 auto"}}>
          <div style={{textAlign:"center", marginBottom: 24}}>
            <h2 style={{margin:"0 0 6px", fontSize:26, fontWeight:800, letterSpacing:"-.02em"}}>Perguntas frequentes</h2>
            <div style={{fontSize:13, color:"var(--muted)"}}>Não achou sua dúvida? <a style={{color:"var(--brand)", fontWeight:600, cursor:"pointer"}}>Fale com a gente</a></div>
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            {faqs.map((f,i)=> <FaqRow key={i} q={f.q} a={f.a}/>)}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="rv" style={{
          marginTop: 56,
          padding:"40px 32px", borderRadius:20,
          background:`radial-gradient(ellipse at 20% 0%, rgba(255,255,255,.18), transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(122,92,255,.5), transparent 50%), linear-gradient(135deg, ${tweaks.accent}, var(--violet))`,
          color:"white",
          display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:20
        }}>
          <div>
            <span className="chip" style={{background:"rgba(255,255,255,.18)", color:"white", marginBottom:10}}><Icon.Sparkle size={12}/> Comece agora</span>
            <h3 style={{margin:"10px 0 4px", fontSize:24, fontWeight:800, letterSpacing:"-.02em"}}>
              {tweaks.plan === "pro" ? "Você já está no Pro." : "Pronto para ver tudo que o Pro libera?"}
            </h3>
            <p style={{margin:0, fontSize:14, color:"rgba(255,255,255,.85)"}}>
              {tweaks.plan === "pro" ? "Explore os dashboards avançados e a IA." : "7 dias grátis · sem cartão · cancele quando quiser"}
            </p>
          </div>
          <div style={{display:"flex", gap:8}}>
            {tweaks.plan !== "pro" && (
              <button className="btn" style={{background:"white", color:"var(--ink)"}} onClick={onSelectPro}>
                <Icon.Crown size={14}/> Começar teste grátis
              </button>
            )}
            <button className="btn" style={{background:"rgba(255,255,255,.12)", color:"white", border:"1px solid rgba(255,255,255,.3)"}} onClick={onClose}>
              {tweaks.plan === "pro" ? "Ir ao dashboard" : "Continuar no Free"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqRow({ q, a }){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{
      border:"1px solid var(--line)", borderRadius:12, background:"white",
      overflow:"hidden", transition:"box-shadow .2s ease",
      boxShadow: open ? "0 16px 32px -20px rgba(15,23,42,.15)" : "none"
    }}>
      <button onClick={()=>setOpen(!open)} style={{
        width:"100%", padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"transparent", border:0, cursor:"pointer", textAlign:"left", color:"var(--ink)"
      }}>
        <span style={{fontWeight:600, fontSize:14}}>{q}</span>
        <span style={{
          width:24, height:24, borderRadius:6, background:"var(--line-2)", color:"var(--muted)",
          display:"inline-flex", alignItems:"center", justifyContent:"center",
          transform: open ? "rotate(180deg)" : "none", transition:"transform .2s ease"
        }}>
          <Icon.Caret size={12}/>
        </span>
      </button>
      {open && (
        <div style={{padding:"0 18px 16px", fontSize:13.5, color:"var(--muted)", lineHeight:1.6, animation:"faqIn .25s ease"}}>
          <style>{`@keyframes faqIn{ from{ opacity:0; transform: translateY(-4px); } }`}</style>
          {a}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PlansView, FaqRow });
