/* Plans / pricing view — shown to logged-in users who click "Experimentar Pro". */

function PlansView({ tweaks, currentUser, onSelectPlan, onChangePlan, onClose, initialCycle }){
  const planLabel = (k)=> k === "pro" ? "Pro" : k === "essencial" ? "Essencial" : "Free";
  const fmtPrice = (v)=> v === 0 ? "0" : Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","); // 29.9 → "29,90" · 299 → "299"

  // Preços em DASH_PRICES (landing.jsx), espelho de src/plans.ts. Anual = 10× o mensal.
  const PLAN_DATA = {
    free:      { rank:0, price:{ monthly:0, yearly:0 } },
    essencial: { rank:1, price: DASH_PRICES.essencial },
    pro:       { rank:2, price: DASH_PRICES.pro },
  };
  const currentRank = (PLAN_DATA[tweaks.plan] || PLAN_DATA.free).rank;
  const isPaid = tweaks.plan !== "free";
  const currentCycle = (currentUser && currentUser.billingCycle) || "monthly";
  // Cartão cancelado ainda no período pago: pode reassinar qualquer plano (o backend libera).
  const cancelled = isPaid && !!currentUser && currentUser.autoRenew === false;
  const [cycle, setCycle] = React.useState(()=> initialCycle || (isPaid ? currentCycle : "monthly"));
  const cycleWord = (c)=> c === "yearly" ? "anual" : "mensal";

  // Um clique = um checkout no Asaas. Trava os botões enquanto a URL não volta
  // (duplo clique criava duas sessões de checkout). onSelectPlan devolve false
  // em erro (o App já mostrou a mensagem) para destravar.
  const [busy, setBusy] = React.useState(null);
  const pick = async (plan, method)=>{
    if(busy) return;
    setBusy(plan + ":" + method);
    const ok = await onSelectPlan(plan, method, cycle);
    if(!ok) setBusy(null);
  };
  // Assinante no cartão troca de tier/ciclo na própria assinatura (sem 2º checkout).
  const cardSubscriber = !!currentUser && currentUser.billingMethod === "card" && isPaid && !cancelled;
  const change = async (plan)=>{
    if(busy) return;
    setBusy(plan + ":change");
    await onChangePlan(plan, cycle);
    setBusy(null);
  };

  const planList = [
    {
      k:"free", name:"Free", tagline:"Para experimentar.",
      features: [
        { ok:true,  t:"Upload CSV, Excel e JSON" },
        { ok:true,  t:"Dashboard montado automaticamente" },
        { ok:true,  t:"Até 5 mil linhas por base" },
        { ok:true,  t:"1 análise da IA por mês" },
        { ok:false, t:"Editar e adicionar blocos" },
        { ok:false, t:"Exportar PDF/PNG" },
        { ok:false, t:"Compartilhamento por link" },
        { ok:false, t:"Remover marca “Dash”" },
      ]
    },
    {
      k:"essencial", name:"Essencial", tagline:"Para uso individual recorrente.",
      features: [
        { ok:true,  t:"Tudo do Free, e mais:", bold:true },
        { ok:true,  t:"50 análises da IA por mês" },
        { ok:true,  t:"Editar e adicionar blocos" },
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
    { q:"Como funciona a cobrança?", a:"Você escolhe mensal ou anual. No cartão, a assinatura renova automaticamente no mesmo ciclo. No Pix, a cobrança é avulsa: perto do vencimento enviamos o link da próxima e, após o pagamento, seu acesso é estendido por mais um mês (ou um ano, no anual)." },
    { q:"Quanto economizo no plano anual?", a:"O anual custa 10 mensalidades: R$ 299 no Essencial e R$ 499 no Pro, ou seja, 2 meses grátis por ano. Quem assina no cartão pode trocar entre mensal e anual na página de planos; a mudança vale a partir da próxima cobrança." },
    { q:"O plano Free usa a IA?", a:"Sim. Com uma conta grátis você gera 1 análise por mês. No Essencial são 50 por mês e no Pro, 300. A cota renova todo dia 1º." },
    { q:"Meus dados ficam seguros?", a:"Seus arquivos são lidos e processados no próprio navegador — não ficam guardados nos nossos servidores. Quando você pede uma análise da IA, enviamos os nomes das colunas, os indicadores calculados e uma amostra de até 20 linhas para o Google Gemini gerar o texto." },
    { q:"Posso cancelar quando quiser?", a:"Sim, sem fidelidade. No cartão, cancele em Conta → Faturamento: a renovação para e você continua com o plano até o fim do período já pago. Depois disso a conta volta para o Free. No Pix não há renovação automática — basta não pagar a próxima cobrança." },
    { q:"Posso exportar em outro formato?", a:"Os planos Essencial e Pro incluem exportação em PDF e PNG com layout customizado." },
  ];

  const compare = [
    { f:"Dashboard montado automaticamente", free:true, essencial:true,           pro:true },
    { f:"Bases de dados aceitas",    free:"CSV, Excel, JSON", essencial:"CSV, Excel, JSON", pro:"CSV, Excel, JSON" },
    { f:"Análises da IA por mês",    free:"1",          essencial:"50",               pro:"300" },
    { f:"Editar e adicionar blocos", free:false,        essencial:true,               pro:true },
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
          <p style={{margin:"0 auto 24px", fontSize:16, color:"var(--muted)", maxWidth:520, lineHeight:1.55}}>
            Comece grátis. Faça upgrade quando precisar de mais análises da IA, edição completa e exportação.
          </p>
          <div style={{display:"flex", justifyContent:"center"}}><CycleToggle cycle={cycle} onChange={setCycle}/></div>
        </div>

        {/* Cartão cancelado: acesso até o fim do período; pode reassinar. */}
        {cancelled && (
          <div className="rv" style={{
            maxWidth: 1080, margin:"0 auto 28px", padding:"16px 20px", borderRadius:14,
            background:"#fff8ec", border:"1px solid #ffe2b8",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10, flexWrap:"wrap", textAlign:"center"
          }}>
            <span style={{fontSize:13.5, color:"var(--ink-2)", lineHeight:1.5}}>
              <b>Sua assinatura foi cancelada.</b> Você continua no {planLabel(tweaks.plan)}{currentUser.currentPeriodEnd ? " até " + new Date(currentUser.currentPeriodEnd).toLocaleDateString("pt-BR") : " até o fim do período pago"}. Para não perder o acesso, assine de novo abaixo — o novo período começa quando o atual terminar.
            </span>
          </div>
        )}

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
              <b>Reative ou faça upgrade abaixo.</b> No <b>cartão</b>, a renovação é automática — nunca mais se preocupe com o vencimento. No <b>Pix</b>, você paga a cada período.
            </span>
          </div>
        )}

        {/* Plan cards */}
        <div className="rv resp-collapse" style={{display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:18, marginBottom: 48, maxWidth: 1080, marginLeft:"auto", marginRight:"auto"}}>
          {planList.map(p=>{
            // Plano atual = mesmo tier E mesmo ciclo (Pro mensal → "Pro anual" é uma troca).
            const isCurrent = p.k === tweaks.plan && (p.k === "free" || (cycle === currentCycle && !cancelled));
            // Tier abaixo do atual: o plano já cobre — sem botão de compra (o
            // backend também recusa com 409 plano_ja_ativo). Quem cancelou pode escolher qualquer um.
            const isIncluded = !isCurrent && PLAN_DATA[p.k].rank < currentRank && (p.k === "free" || (!cardSubscriber && !cancelled));
            const sameTier = p.k === tweaks.plan;
            const price = PLAN_DATA[p.k].price[cycle];
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
                    <span className="ticker" style={{fontSize:44, fontWeight:800, letterSpacing:"-.03em", color: hl ? "var(--brand)" : "var(--ink)"}}>R$ {fmtPrice(price)}</span>
                    <span style={{fontSize:14, color:"var(--muted)"}}>{p.k === "free" ? "/sempre" : cycle === "yearly" ? "/ano" : "/mês"}</span>
                  </div>
                  {p.k !== "free" && cycle === "yearly" && (
                    <div style={{fontSize:12.5, color:"#0a8a4a", fontWeight:600, marginTop:2}}>
                      equivale a {dashFmtBRL(price / 12)}/mês · 2 meses grátis
                    </div>
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

                {isCurrent || isIncluded ? (
                  <button disabled className={`btn ${hl?"btn-primary":"btn-ghost"}`}
                    style={{width:"100%", justifyContent:"center", padding:"12px", opacity:0.6, cursor:"default"}}>
                    {isCurrent ? "Plano atual" : "Incluído no seu plano"}
                  </button>
                ) : (cardSubscriber && p.k !== "free") ? (
                  <div style={{display:"flex", flexDirection:"column", gap:8}}>
                    <button className={`btn ${hl?"btn-primary":"btn-ghost"}`} style={{width:"100%", justifyContent:"center", padding:"12px", opacity: busy ? 0.7 : 1}}
                      disabled={!!busy} onClick={()=> change(p.k)}>
                      <Icon.Crown size={14}/> {busy === p.k + ":change" ? "Trocando…" : sameTier ? "Mudar para o " + cycleWord(cycle) : "Mudar para o " + p.name}
                    </button>
                    <div style={{textAlign:"center", marginTop:2, fontSize:11, color:"var(--muted)", lineHeight:1.45}}>
                      {PLAN_DATA[p.k].rank > currentRank
                        ? "Na mesma assinatura do cartão. Libera na hora; a próxima cobrança já vem no valor novo."
                        : "Na mesma assinatura do cartão. Vale a partir da próxima cobrança."}
                    </div>
                  </div>
                ) : p.k !== "free" ? (
                  <div style={{display:"flex", flexDirection:"column", gap:8}}>
                    <button className="btn btn-primary" style={{width:"100%", justifyContent:"center", padding:"12px", opacity: busy ? 0.7 : 1}}
                      disabled={!!busy} onClick={()=> pick(p.k, "card")}>
                      <Icon.Crown size={14}/> {busy === p.k + ":card" ? "Abrindo checkout…" : (cancelled && sameTier ? "Reativar no cartão" : "Assinar no cartão")}
                    </button>
                    <button className="btn btn-ghost" style={{width:"100%", justifyContent:"center", padding:"12px", opacity: busy ? 0.7 : 1}}
                      disabled={!!busy} onClick={()=> pick(p.k, "pix")}>
                      {busy === p.k + ":pix" ? "Abrindo checkout…" : "Pagar no Pix"}
                    </button>
                    <div style={{textAlign:"center", marginTop:2, fontSize:11, color:"var(--muted)", lineHeight:1.45}}>
                      Renovação automática só no cartão. No Pix, a cobrança do próximo {cycle === "yearly" ? "ano" : "mês"} é enviada perto do vencimento.
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
            {i:<Icon.Lock size={16}/>, t:"Processamento local", d:"Seus arquivos são lidos no navegador. Só a análise da IA, quando você pede, envia uma amostra."},
            {i:<Icon.Check size={16} stroke={3}/>, t:"Pagamento seguro", d:"Cartão e Pix processados pelo Asaas. Não guardamos dados de cartão."},
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
            {window.__CONTACT_EMAIL && (
              <div style={{fontSize:13, color:"var(--muted)"}}>Não achou sua dúvida? <a href={"mailto:" + window.__CONTACT_EMAIL} style={{color:"var(--brand)", fontWeight:600}}>Fale com a gente</a></div>
            )}
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
              {tweaks.plan === "pro" ? "Todos os recursos e a maior cota de IA já estão liberados." : "Assine no cartão ou Pix · cancele quando quiser"}
            </p>
          </div>
          <div style={{display:"flex", gap:8}}>
            {tweaks.plan !== "pro" && (
              <button className="btn" style={{background:"white", color:"var(--ink)"}} disabled={!!busy} onClick={()=> cardSubscriber ? change("pro") : pick("pro", "card")}>
                <Icon.Crown size={14}/> Assinar o Pro no cartão
              </button>
            )}
            <button className="btn" style={{background:"rgba(255,255,255,.12)", color:"white", border:"1px solid rgba(255,255,255,.3)"}} onClick={onClose}>
              {tweaks.plan === "pro" ? "Voltar" : tweaks.plan === "essencial" ? "Continuar no Essencial" : "Continuar no Free"}
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
