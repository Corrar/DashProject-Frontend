/* Plans / pricing view — shown to logged-in users who click "Experimentar Pro". */

function PlansView({ tweaks, currentUser, onSelectPlan, onClose }){
  // Backend só tem cobrança mensal; sem ciclo anual (não inventar preço).
  const planLabel = (k)=> k === "pro" ? "Pro" : k === "essencial" ? "Essencial" : "Free";
  const fmtPrice = (v)=> v === 0 ? "0" : v.toFixed(2).replace(".", ","); // 29.9 → "29,90"

  const PLAN_DATA = {
    free:      { price:0 },
    essencial: { price:29.90 },
    pro:       { price:49.90 },
  };

  const planList = [
    {
      k:"free", name:"Free", tagline:"Para experimentar.",
      features: [
        { ok:true,  t:"Upload CSV" },
        { ok:true,  t:"Dashboard gerado por IA" },
        { ok:true,  t:"3 análises da IA por mês" },
        { ok:true,  t:"Até 5 mil linhas por base" },
        { ok:false, t:"Exportar PDF/PNG" },
        { ok:false, t:"Compartilhamento por link" },
        { ok:false, t:"Remover marca “Dash”" },
      ]
    },
    {
      k:"essencial", name:"Essencial", tagline:"Para uso individual recorrente.",
      features: [
        { ok:true,  t:"Tudo do Free, e mais:", bold:true },
        { ok:true,  t:"CSV, Excel e JSON" },
        { ok:true,  t:"50 análises da IA por mês" },
        { ok:true,  t:"Até 100 mil linhas por base" },
        { ok:true,  t:"Exportar PDF/PNG" },
        { ok:true,  t:"Suporte por e-mail" },
        { ok:false, t:"Compartilhamento por link" },
        { ok:false, t:"Remover marca “Dash”" },
      ]
    },
    {
      k:"pro", name:"Pro", tagline:"Para profissionais e equipes pequenas.", highlight: true,
      features: [
        { ok:true, t:"Tudo do Essencial, e mais:", bold:true },
        { ok:true, t:"300 análises da IA por mês" },
        { ok:true, t:"Até 1 milhão de linhas por base" },
        { ok:true, t:"Compartilhamento por link" },
        { ok:true, t:"Remover marca “Dash”" },
        { ok:true, t:"Suporte prioritário" },
      ]
    },
  ];

  const faqs = [
    { q:"Como funciona a cobrança?", a:"No cartão, a assinatura é mensal e renova automaticamente — cancele quando quiser e mantenha acesso até o fim do ciclo já pago. No Pix, a cobrança é mensal e avulsa: perto do vencimento o sistema envia o link da próxima cobrança e, após o pagamento, seu acesso é estendido por mais 30 dias." },
    { q:"Meus dados ficam seguros?", a:"Sim. O processamento dos arquivos é feito no seu navegador. Apenas metadados (nomes de colunas e tipos) podem ser enviados para a IA com seu consentimento. Estamos em conformidade com LGPD e SOC 2." },
    { q:"Posso cancelar quando quiser?", a:"Sem fidelidade. Cancele no painel e mantenha acesso até o fim do ciclo já pago. Seus dashboards continuam disponíveis em modo de visualização." },
    { q:"Posso exportar em outro formato?", a:"Os planos Essencial e Pro incluem exportação em PDF e PNG com layout customizado." },
  ];

  const compare = [
    { f:"Dashboards gerados por IA", free:true,        essencial:true,               pro:true },
    { f:"Bases de dados aceitas",    free:"CSV",        essencial:"CSV, Excel, JSON", pro:"CSV, Excel, JSON" },
    { f:"Análises da IA por mês",    free:"3",          essencial:"50",               pro:"300" },
    { f:"Linhas por base",           free:"5 mil",      essencial:"100 mil",          pro:"1 milhão" },
    { f:"Exportar PDF/PNG",          free:false,        essencial:true,               pro:true },
    { f:"Compartilhamento por link", free:false,        essencial:false,              pro:true },
    { f:"Remover marca “Dash”",      free:false,        essencial:false,              pro:true },
    { f:"Suporte",                   free:"Comunidade", essencial:"E-mail",           pro:"Prioritário" },
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
            {!!currentUser && (
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)"}}>
                Sessão ativa · plano {planLabel(tweaks.plan)}
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
        </div>

        {/* Reativação / upgrade — visível p/ usuário logado no Free. Sem sinal de
            "plano anterior" no /me, então não auto-detecta vencimento: destaca o
            caminho do cartão (renovação automática) e deixa a escolha de método
            nos botões Cartão/Pix de cada plano abaixo. */}
        {currentUser && tweaks.plan === "free" && (
          <div className="rv" style={{
            maxWidth: 1080, margin:"0 auto 28px", padding:"16px 20px", borderRadius:14,
            background:"var(--brand-soft)", border:"1px solid var(--line)",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10, flexWrap:"wrap", textAlign:"center"
          }}>
            <Icon.Sparkle size={16}/>
            <span style={{fontSize:13.5, color:"var(--ink-2)", lineHeight:1.5}}>
              <b>Reative ou faça upgrade abaixo.</b> No <b>cartão</b>, a renovação é automática — nunca mais se preocupe com o vencimento. No <b>Pix</b>, você paga a cada mês.
            </span>
          </div>
        )}

        {/* Plan cards */}
        <div className="rv resp-collapse" style={{display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:18, marginBottom: 48, maxWidth: 1080, marginLeft:"auto", marginRight:"auto"}}>
          {planList.map(p=>{
            const isCurrent = p.k === tweaks.plan; // free | essencial | pro
            const hl = p.highlight;
            return (
              <div key={p.k} className={hl?"lift":""} style={{
                padding: 28, borderRadius: 18,
                background: hl ? "linear-gradient(180deg, #f5f8ff, white)" : "white",
                border: hl ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                boxShadow: hl ? "0 30px 60px -28px rgba(47,107,255,.35)" : "none",
                position:"relative", display:"flex", flexDirection:"column"
              }}>
                {isCurrent ? (
                  <span className="chip" style={{position:"absolute", top:20, right:20, background: hl?"var(--ink)":"#e7f7ef", color: hl?"white":"#0a8a4a"}}>{hl?"Seu plano":"Atual"}</span>
                ) : hl ? (
                  <span className="chip" style={{position:"absolute", top:20, right:20, background:"var(--ink)", color:"white"}}><Icon.Crown size={11}/> Mais popular</span>
                ) : null}

                <div style={{fontWeight:700, fontSize:18}}>{p.name}</div>
                <div style={{fontSize:13, color:"var(--muted)", marginTop:4, marginBottom:22}}>{p.tagline}</div>

                <div style={{marginBottom:18, minHeight: 68}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:4}}>
                    <span style={{fontSize:44, fontWeight:800, letterSpacing:"-.03em", color: hl ? "var(--brand)" : "var(--ink)"}}>R$ {fmtPrice(PLAN_DATA[p.k].price)}</span>
                    <span style={{fontSize:14, color:"var(--muted)"}}>{p.k === "free" ? "/sempre" : "/mês"}</span>
                  </div>
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

                {isCurrent ? (
                  <button disabled className={`btn ${hl?"btn-primary":"btn-ghost"}`}
                    style={{width:"100%", justifyContent:"center", padding:"12px", opacity:0.6, cursor:"default"}}>
                    Plano atual
                  </button>
                ) : p.k !== "free" ? (
                  <div style={{display:"flex", flexDirection:"column", gap:8}}>
                    <button className="btn btn-primary" style={{width:"100%", justifyContent:"center", padding:"12px"}}
                      onClick={()=> onSelectPlan(p.k, "card")}>
                      <Icon.Crown size={14}/> Assinar no cartão
                    </button>
                    <button className="btn btn-ghost" style={{width:"100%", justifyContent:"center", padding:"12px"}}
                      onClick={()=> onSelectPlan(p.k, "pix")}>
                      Pagar no Pix
                    </button>
                    <div style={{textAlign:"center", marginTop:2, fontSize:11, color:"var(--muted)", lineHeight:1.45}}>
                      Renovação automática só no cartão. No Pix, a cobrança do próximo mês é enviada perto do vencimento.
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-ghost" style={{width:"100%", justifyContent:"center", padding:"12px"}}
                    onClick={onClose}>
                    Permanecer no Free
                  </button>
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
                  {["Free","Essencial","Pro"].map(n=>(
                    <th key={n} style={{textAlign:"center", padding:"12px 16px", fontSize:14, fontWeight:700, color:"var(--ink)", borderBottom:"1px solid var(--line-2)", background: n==="Pro"?"var(--brand-soft)":"transparent"}}>
                      {n}
                      {n==="Pro" && <span style={{marginLeft:6, color:"var(--brand)"}}>★</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.map((row, i)=>{
                  const bb = i<compare.length-1 ? "1px solid var(--line-2)" : "none";
                  return (
                    <tr key={i}>
                      <td style={{padding:"12px 16px", fontSize:13, color:"var(--ink-2)", fontWeight:500, borderBottom:bb}}>{row.f}</td>
                      <td style={{padding:"12px 16px", textAlign:"center", borderBottom:bb}}><Cell v={row.free}/></td>
                      <td style={{padding:"12px 16px", textAlign:"center", borderBottom:bb}}><Cell v={row.essencial}/></td>
                      <td style={{padding:"12px 16px", textAlign:"center", background:"var(--brand-soft)", borderBottom:bb}}><Cell v={row.pro}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Logos / trust */}
        <div className="rv resp-collapse" style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16, marginBottom: 48}}>
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
              {tweaks.plan === "pro" ? "Explore os dashboards avançados e a IA." : "Assine no cartão ou Pix · cancele quando quiser"}
            </p>
          </div>
          <div style={{display:"flex", gap:8}}>
            {tweaks.plan !== "pro" && (
              <button className="btn" style={{background:"white", color:"var(--ink)"}} onClick={()=> onSelectPlan("pro", "card")}>
                <Icon.Crown size={14}/> Assinar o Pro no cartão
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
