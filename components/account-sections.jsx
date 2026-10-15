/* Seções reais da Conta, ligadas ao backend (antes eram telas "Em breve" com
 * dados de exemplo): perfil, segurança, sessões, seus dados (LGPD), faturas do
 * Asaas e histórico de análises por IA. Os blocos visuais (SettingsCard,
 * SectionHeader, TextField) vêm de account-view.jsx.
 */

// "Mozilla/5.0 (Macintosh…) Chrome/131" → "Chrome · macOS".
function dashDeviceLabel(ua){
  const s = String(ua || "");
  if(!s) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Firefox\//.test(s) ? "Firefox"
    : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "Navegador";
  const os = /iPhone|iPad/.test(s) ? "iOS" : /Android/.test(s) ? "Android" : /Mac OS X|Macintosh/.test(s) ? "macOS"
    : /Windows/.test(s) ? "Windows" : /Linux/.test(s) ? "Linux" : "";
  return os ? browser + " · " + os : browser;
}

function dashRelTime(ts){
  if(!ts) return "—";
  const d = new Date(ts); const diff = Date.now() - d.getTime();
  if(isNaN(d)) return "—";
  if(diff < 60e3) return "agora";
  if(diff < 3600e3) return "há " + Math.round(diff/60e3) + " min";
  if(diff < 86400e3) return "há " + Math.round(diff/3600e3) + " h";
  if(diff < 2*86400e3) return "ontem";
  return d.toLocaleDateString("pt-BR");
}

function dashErr(err, fallback){
  return (window.authErrorMessage && err && err.status) ? window.authErrorMessage(err) : (fallback || "Não foi possível concluir agora. Tente de novo em instantes.");
}

// Carrega uma chamada do DashAPI com estados de carregando/erro.
function useDashLoad(fn, deps){
  const [st, setSt] = React.useState({ loading:true, error:null, data:null });
  const load = React.useCallback(()=>{
    setSt(s => ({ ...s, loading:true, error:null }));
    return fn().then(data => setSt({ loading:false, error:null, data }))
      .catch(err => setSt({ loading:false, error: err || true, data:null }));
  }, deps); // eslint-disable-line
  React.useEffect(()=>{ load(); }, [load]);
  return [st, load];
}

function InlineNote({ kind="ok", children }){
  const ok = kind === "ok";
  return (
    <div role={ok ? "status" : "alert"} style={{marginTop:12, padding:"9px 12px", borderRadius:10, fontSize:12.5, lineHeight:1.45,
      background: ok ? "#e7f7ef" : "#fff7f9", border: ok ? "1px solid #bfe8d2" : "1px solid #ffd2dd", color: ok ? "#0a5a30" : "#c9234a"}}>
      {children}
    </div>
  );
}

function AccountSection({ tweaks, currentUser, onClose }){
  const accent = tweaks.accent;
  const initialName = currentUser.fullName || "";
  const [name, setName] = React.useState(initialName);
  const [nameState, setNameState] = React.useState(null); // null | saving | ok | {error}
  const [verifyState, setVerifyState] = React.useState(null);
  const created = currentUser.createdAt ? new Date(currentUser.createdAt) : null;
  const initials = String(currentUser.fullName || currentUser.email || "?").split(/[\s@.]+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase();

  const saveName = async ()=>{
    setNameState("saving");
    try { await window.DashAPI.updateProfile(name.trim()); await window.DashAPI.me().catch(()=>{}); setNameState("ok"); }
    catch(err){ setNameState({ error: dashErr(err) }); }
  };
  const resend = async ()=>{
    setVerifyState("sending");
    try { await window.DashAPI.resendVerification(); setVerifyState("ok"); }
    catch(err){ setVerifyState({ error: dashErr(err) }); }
  };

  return (
    <div>
      <SectionHeader title="Conta" sub="Perfil, segurança e seus dados."/>

      <SettingsCard title="Perfil" sub="Como seu nome aparece no Dash.">
        <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"72px minmax(0, 1fr)", gap:20, alignItems:"start"}}>
          <div aria-hidden="true" style={{width:72, height:72, borderRadius:"50%", background:`linear-gradient(135deg, ${accent}, var(--violet))`, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:24}}>{initials}</div>
          <div>
            <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"minmax(0, 1fr) minmax(0, 1fr)", gap:14}}>
              <TextField label="Nome completo" value={name} onChange={v=>{ setName(v); setNameState(null); }} placeholder="Seu nome"/>
              <TextField label="E-mail" value={currentUser.email || ""} readOnly hint="Usado para entrar e receber avisos da conta."/>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:10, marginTop:14, flexWrap:"wrap"}}>
              <button className="btn btn-primary" style={{padding:"9px 14px"}} disabled={name.trim() === initialName.trim() || nameState === "saving"} onClick={saveName}>
                {nameState === "saving" ? "Salvando…" : "Salvar nome"}
              </button>
              {currentUser.emailVerified
                ? <span className="chip" style={{background:"#e7f7ef", color:"#0a5a30", fontWeight:600}}><Icon.Check size={11} stroke={3}/> E-mail confirmado</span>
                : <>
                    <span className="chip" style={{background:"#fff4e5", color:"#9a5b00", fontWeight:600}}>E-mail não confirmado</span>
                    <button className="link-btn" onClick={resend} disabled={verifyState === "sending" || verifyState === "ok"}>
                      {verifyState === "ok" ? "Link enviado" : verifyState === "sending" ? "Enviando…" : "Reenviar e-mail de confirmação"}
                    </button>
                  </>}
              {created && !isNaN(created) && <span style={{fontSize:12, color:"var(--muted)", marginLeft:"auto"}}>Conta criada em {created.toLocaleDateString("pt-BR")}</span>}
            </div>
            {nameState === "ok" && <InlineNote>Nome atualizado.</InlineNote>}
            {nameState && nameState.error && <InlineNote kind="err">{nameState.error}</InlineNote>}
            {verifyState === "ok" && <InlineNote>Enviamos um novo link para {currentUser.email}. Ele vale por 24 horas.</InlineNote>}
            {verifyState && verifyState.error && <InlineNote kind="err">{verifyState.error}</InlineNote>}
          </div>
        </div>
      </SettingsCard>

      <PasswordCard/>
      <SessionsCard/>
      <DataCard currentUser={currentUser} onClose={onClose}/>
    </div>
  );
}

function PasswordCard(){
  const [open, setOpen] = React.useState(false);
  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");
  const [conf, setConf] = React.useState("");
  const [st, setSt] = React.useState(null); // null | saving | {ok:n} | {error}
  const mismatch = conf && next !== conf;
  const canSave = cur && next.length >= 8 && next === conf && st !== "saving";
  const submit = async (e)=>{
    e.preventDefault();
    if(!canSave) return;
    setSt("saving");
    try {
      const r = await window.DashAPI.changePassword(cur, next);
      setSt({ ok: (r && r.revoked) || 0 }); setCur(""); setNext(""); setConf(""); setOpen(false);
    } catch(err){ setSt({ error: dashErr(err) }); }
  };
  return (
    <SettingsCard title="Senha" sub="Ao trocar, as outras sessões são encerradas e você recebe um aviso por e-mail."
      action={!open && <button className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}} onClick={()=>{ setOpen(true); setSt(null); }}>Alterar senha</button>}>
      {!open && !(st && st.ok != null) && <div style={{fontSize:13, color:"var(--muted)"}}>Use uma senha com 8 caracteres ou mais que você não usa em outro site.</div>}
      {st && st.ok != null && <InlineNote>Senha alterada. {st.ok ? (st.ok === 1 ? "1 outra sessão foi encerrada." : st.ok + " outras sessões foram encerradas.") : "Nenhuma outra sessão estava aberta."}</InlineNote>}
      {open && (
        <form onSubmit={submit}>
          <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:14}}>
            <TextField label="Senha atual" type="password" value={cur} onChange={setCur}/>
            <TextField label="Nova senha" type="password" value={next} onChange={setNext} hint="Mínimo de 8 caracteres."/>
            <TextField label="Repita a nova senha" type="password" value={conf} onChange={setConf} hint={mismatch ? "As senhas não são iguais." : undefined}/>
          </div>
          {next && window.PasswordStrength && <div style={{marginTop:10, maxWidth:360}}><PasswordStrength value={next}/></div>}
          <div style={{display:"flex", gap:8, marginTop:14}}>
            <button type="submit" className="btn btn-primary" style={{padding:"9px 14px"}} disabled={!canSave}>{st === "saving" ? "Salvando…" : "Salvar nova senha"}</button>
            <button type="button" className="btn btn-ghost" style={{padding:"9px 14px"}} onClick={()=>{ setOpen(false); setSt(null); }}>Cancelar</button>
          </div>
          {st && st.error && <InlineNote kind="err">{st.error}</InlineNote>}
        </form>
      )}
    </SettingsCard>
  );
}

function SessionsCard(){
  const [st, reload] = useDashLoad(()=> window.DashAPI.listSessions(), []);
  const [busy, setBusy] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const sessions = (st.data && st.data.sessions) || [];
  const others = sessions.filter(s => !s.current).length;
  const end = async (id)=>{
    setBusy(id); setMsg(null);
    try { await window.DashAPI.revokeSession(id); await reload(); setMsg({ ok:"Sessão encerrada. O dispositivo precisa entrar de novo." }); }
    catch(err){ setMsg({ error: dashErr(err) }); }
    setBusy(null);
  };
  const endOthers = async ()=>{
    setBusy("all"); setMsg(null);
    try { const r = await window.DashAPI.revokeOtherSessions(); await reload(); const n = (r && r.revoked) || 0; setMsg({ ok: n === 1 ? "1 sessão encerrada." : n + " sessões encerradas." }); }
    catch(err){ setMsg({ error: dashErr(err) }); }
    setBusy(null);
  };
  return (
    <SettingsCard title="Sessões ativas" sub="Dispositivos conectados à sua conta."
      action={others > 0 && <button className="btn btn-ghost" style={{padding:"7px 12px", fontSize:12, color:"#c9234a"}} disabled={!!busy} onClick={endOthers}>{busy === "all" ? "Encerrando…" : "Encerrar as outras"}</button>}>
      {st.loading && !st.data && <div style={{fontSize:13, color:"var(--muted)"}}>Carregando…</div>}
      {st.error && <InlineNote kind="err">Não foi possível carregar as sessões. <button className="link-btn" onClick={reload}>Tentar de novo</button></InlineNote>}
      {sessions.map((s, i)=>(
        <div key={s.id} style={{display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-2)", flexWrap:"wrap"}}>
          <span style={{width:34, height:34, borderRadius:9, flexShrink:0, background: s.current ? "#e7f7ef" : "var(--line-2)", color: s.current ? "#0a8a4a" : "var(--muted)", display:"inline-flex", alignItems:"center", justifyContent:"center"}}>
            <Icon.Lock size={14}/>
          </span>
          <div style={{flex:"1 1 200px", minWidth:0}}>
            <div style={{fontWeight:600, fontSize:13.5, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              {dashDeviceLabel(s.userAgent)}
              {s.current && <span className="chip" style={{padding:"1px 8px", fontSize:10.5, background:"#e7f7ef", color:"#0a8a4a"}}>esta sessão</span>}
            </div>
            <div style={{fontSize:12, color:"var(--muted)"}}>
              {s.ip ? <span className="mono">{s.ip}</span> : "IP desconhecido"} · último uso {dashRelTime(s.lastUsedAt)}{s.startedAt ? " · entrou em " + new Date(s.startedAt).toLocaleDateString("pt-BR") : ""}
            </div>
          </div>
          {!s.current && (
            <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12}} disabled={!!busy} onClick={()=>end(s.id)}>
              {busy === s.id ? "Encerrando…" : "Encerrar"}
            </button>
          )}
        </div>
      ))}
      {!st.loading && !st.error && sessions.length === 0 && <div style={{fontSize:13, color:"var(--muted)"}}>Nenhuma sessão ativa.</div>}
      {msg && msg.ok && <InlineNote>{msg.ok}</InlineNote>}
      {msg && msg.error && <InlineNote kind="err">{msg.error}</InlineNote>}
    </SettingsCard>
  );
}

function DataCard({ currentUser, onClose }){
  const [exp, setExp] = React.useState(null);
  const [localCount, setLocalCount] = React.useState(null);
  const [confirm, setConfirm] = React.useState(false);
  const [pw, setPw] = React.useState("");
  const [word, setWord] = React.useState("");
  const [wipeLocal, setWipeLocal] = React.useState(true);
  const [del, setDel] = React.useState(null); // null | deleting | {error}
  const isPaid = currentUser.plan && currentUser.plan !== "free";

  React.useEffect(()=>{
    if(!window.DashSaved) return undefined;
    let alive = true;
    const refresh = ()=> window.DashSaved.list(currentUser.id).then(l => { if(alive) setLocalCount(l.length); });
    refresh();
    const off = window.DashSaved.subscribe(refresh);
    return ()=>{ alive = false; off(); };
  }, [currentUser.id]);

  const download = async ()=>{
    setExp("loading");
    try {
      const data = await window.DashAPI.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "dash-meus-dados.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
      setExp("ok");
    } catch(err){ setExp({ error: dashErr(err) }); }
  };
  const wipeSaved = async ()=>{
    if(!window.confirm("Apagar os dashboards salvos neste navegador? Seus arquivos originais não são afetados.")) return;
    const list = await window.DashSaved.list(currentUser.id);
    await Promise.all(list.map(it => window.DashSaved.remove(it.id)));
  };
  const doDelete = async (e)=>{
    e.preventDefault();
    if(word !== "EXCLUIR" || !pw) return;
    setDel("deleting");
    try {
      if(wipeLocal && window.DashSaved){
        const list = await window.DashSaved.list(currentUser.id);
        await Promise.all(list.map(it => window.DashSaved.remove(it.id)));
      }
      await window.DashAPI.deleteAccount(pw);
      window.dashTrack && window.dashTrack("conta_excluida");
      window.alert("Sua conta foi excluída. Enviamos uma confirmação por e-mail.");
      window.__dashOpenLanding && window.__dashOpenLanding();
    } catch(err){
      const code = err && err.data && err.data.error;
      setDel({ error: code === "asaas_erro"
        ? "Não conseguimos cancelar sua assinatura no Asaas agora, então nada foi apagado. Tente de novo em alguns minutos."
        : dashErr(err) });
    }
  };

  return (
    <>
      <SettingsCard title="Seus dados" sub="Seus arquivos e dashboards ficam no navegador; aqui está o que o servidor guarda.">
        <div style={{display:"flex", flexDirection:"column", gap:14}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
            <div>
              <div style={{fontWeight:600, fontSize:13.5}}>Baixar meus dados</div>
              <div style={{fontSize:12, color:"var(--muted)"}}>Conta, plano, uso da IA, links públicos e cobranças, em JSON.</div>
            </div>
            <button className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}} onClick={download} disabled={exp === "loading"}>
              <Icon.Download size={13}/> {exp === "loading" ? "Preparando…" : "Baixar JSON"}
            </button>
          </div>
          {exp && exp.error && <InlineNote kind="err">{exp.error}</InlineNote>}
          {localCount != null && (
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", paddingTop:14, borderTop:"1px solid var(--line-2)"}}>
              <div>
                <div style={{fontWeight:600, fontSize:13.5}}>Dashboards salvos neste navegador</div>
                <div style={{fontSize:12, color:"var(--muted)"}}>{localCount === 0 ? "Nenhum dashboard salvo aqui." : localCount + (localCount === 1 ? " dashboard guardado" : " dashboards guardados") + " só neste aparelho."}</div>
              </div>
              {localCount > 0 && <button className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}} onClick={wipeSaved}>Apagar deste navegador</button>}
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Excluir conta" sub="Remove sua conta e os dados ligados a ela. Não dá para desfazer.">
        {!confirm ? (
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap"}}>
            <div style={{fontSize:12.5, color:"var(--ink-2)", lineHeight:1.55, maxWidth:560}}>
              {isPaid ? "Sua assinatura é cancelada na hora, sem novas cobranças. " : ""}Links públicos deixam de abrir e o histórico de uso é apagado. Registros de cobrança ficam guardados sem vínculo com você pelo prazo da lei fiscal.
            </div>
            <button className="btn" style={{padding:"9px 14px", background:"white", border:"1px solid #c9234a", color:"#c9234a"}} onClick={()=>setConfirm(true)}>Excluir conta…</button>
          </div>
        ) : (
          <form onSubmit={doDelete} style={{padding:16, border:"1px solid #ffd2dd", background:"#fff7f9", borderRadius:12}}>
            <div style={{fontWeight:700, fontSize:13.5, color:"#c9234a", marginBottom:10}}>Confirme a exclusão</div>
            <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"minmax(0, 1fr) minmax(0, 1fr)", gap:14}}>
              <TextField label="Sua senha" type="password" value={pw} onChange={setPw}/>
              <TextField label="Digite EXCLUIR para confirmar" value={word} onChange={v=>setWord(v.toUpperCase())} placeholder="EXCLUIR"/>
            </div>
            {localCount > 0 && (
              <label style={{display:"flex", gap:8, alignItems:"center", fontSize:12.5, marginTop:12, cursor:"pointer"}}>
                <input type="checkbox" checked={wipeLocal} onChange={e=>setWipeLocal(e.target.checked)} style={{accentColor:"#c9234a"}}/>
                Apagar também os {localCount} dashboards salvos neste navegador
              </label>
            )}
            <div style={{display:"flex", gap:8, marginTop:14}}>
              <button type="submit" className="btn" disabled={word !== "EXCLUIR" || !pw || del === "deleting"}
                style={{padding:"9px 14px", background:"#c9234a", color:"white", opacity: (word !== "EXCLUIR" || !pw) ? .5 : 1}}>
                {del === "deleting" ? "Excluindo…" : "Excluir minha conta"}
              </button>
              <button type="button" className="btn btn-ghost" style={{padding:"9px 14px"}} onClick={()=>{ setConfirm(false); setDel(null); setPw(""); setWord(""); }}>Cancelar</button>
            </div>
            {del && del.error && <InlineNote kind="err">{del.error}</InlineNote>}
          </form>
        )}
      </SettingsCard>
    </>
  );
}

// Faturas reais (Asaas) dentro de Faturamento.
const DASH_PAY_STATUS = {
  CONFIRMED:["Pago","#0a8a4a","#e7f7ef"], RECEIVED:["Pago","#0a8a4a","#e7f7ef"], RECEIVED_IN_CASH:["Pago","#0a8a4a","#e7f7ef"], PAID:["Pago","#0a8a4a","#e7f7ef"],
  PENDING:["Em aberto","#9a5b00","#fff4e5"], AWAITING_RISK_ANALYSIS:["Em análise","#9a5b00","#fff4e5"],
  OVERDUE:["Vencida","#c9234a","#fde7ee"], REFUNDED:["Estornada","#5b6478","var(--line-2)"], REFUND_REQUESTED:["Estorno pedido","#5b6478","var(--line-2)"],
  CANCELED:["Cancelada","#5b6478","var(--line-2)"], DELETED:["Cancelada","#5b6478","var(--line-2)"],
};
const DASH_PAY_METHOD = { CREDIT_CARD:"Cartão", PIX:"Pix", BOLETO:"Boleto", UNDEFINED:"—" };

function InvoiceHistory({ isPaid }){
  const [st, reload] = useDashLoad(()=> window.DashAPI.billingHistory(), []);
  const items = (st.data && st.data.items) || [];
  const fmtDate = (d)=>{ if(!d) return "—"; const x = new Date(String(d).length === 10 ? d + "T12:00:00" : d); return isNaN(x) ? "—" : x.toLocaleDateString("pt-BR"); };
  return (
    <SettingsCard title="Faturas" sub="Cobranças do Asaas, com o comprovante de cada uma.">
      {st.loading && !st.data && <div style={{fontSize:13, color:"var(--muted)"}}>Carregando…</div>}
      {st.error && <InlineNote kind="err">Não foi possível carregar as faturas. <button className="link-btn" onClick={reload}>Tentar de novo</button></InlineNote>}
      {!st.loading && !st.error && items.length === 0 && (
        <div style={{padding:"26px 20px", border:"1px dashed var(--line)", borderRadius:12, background:"#fafbfe", textAlign:"center", fontSize:13, color:"var(--muted)"}}>
          {isPaid ? "Nenhuma fatura ainda. A primeira aparece aqui assim que o Asaas registrar o pagamento." : "Suas faturas aparecem aqui quando você assinar um plano."}
        </div>
      )}
      {items.length > 0 && (
        <div style={{overflowX:"auto"}}>
          <div style={{minWidth:560}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1.6fr .8fr .9fr .9fr auto", gap:12, padding:"0 2px 8px", borderBottom:"1px solid var(--line-2)"}}>
              {["Data","Descrição","Método","Valor","Status",""].map((h,i)=>(
                <div key={i} className="mono" style={{fontSize:10.5, color:"var(--muted)", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase"}}>{h}</div>
              ))}
            </div>
            {items.map((it, i)=>{
              const s = DASH_PAY_STATUS[it.status] || [it.status || "—", "#5b6478", "var(--line-2)"];
              return (
                <div key={(it.id || "") + i} style={{display:"grid", gridTemplateColumns:"1fr 1.6fr .8fr .9fr .9fr auto", gap:12, alignItems:"center", padding:"11px 2px", borderTop: i === 0 ? "none" : "1px solid var(--line-2)"}}>
                  <div className="mono" style={{fontSize:12.5}}>{fmtDate(it.paidAt || it.dueDate)}</div>
                  <div style={{fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.description || "Assinatura Dash"}</div>
                  <div style={{fontSize:12.5, color:"var(--ink-2)"}}>{DASH_PAY_METHOD[it.method] || it.method || "—"}</div>
                  <div className="ticker" style={{fontSize:13, fontWeight:700}}>{window.dashFmtBRL ? window.dashFmtBRL(it.value || 0) : "R$ " + it.value}</div>
                  <div><span className="chip" style={{padding:"2px 9px", fontSize:11, fontWeight:700, color:s[1], background:s[2]}}>{s[0]}</span></div>
                  <div>{it.invoiceUrl
                    ? <a href={it.invoiceUrl} target="_blank" rel="noopener noreferrer" className="link-btn" style={{textDecoration:"none"}}>{it.status === "PENDING" || it.status === "OVERDUE" ? "Pagar" : "Ver fatura"}</a>
                    : null}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

// Histórico de análises por IA (contagens reais; o conteúdo das análises não
// fica no servidor — ele vive nos dashboards salvos do navegador).
function HistorySection({ tweaks, currentUser }){
  const [st, reload] = useDashLoad(()=> window.DashAPI.aiUsage(), []);
  const limits = (currentUser && currentUser.limits) || {};
  const accent = tweaks.accent;
  const now = new Date();
  const months = [];
  for(let i = 11; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const found = st.data && st.data.months ? st.data.months.find(m => m.month === key) : null;
    months.push({ key, label: d.toLocaleDateString("pt-BR", { month:"short" }).replace(".", ""), v: found ? found.count : 0 });
  }
  const max = Math.max(1, ...months.map(m => m.v));
  const total = months.reduce((s, m) => s + m.v, 0);
  const recent = (st.data && st.data.recent) || [];
  return (
    <div>
      <SectionHeader title="Histórico de análises" sub="Quantas análises por IA você gerou e quando."/>
      <div className="resp-collapse" style={{display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:14, marginBottom:18}}>
        {[
          { l:"Neste mês", v: limits.aiUsed != null ? limits.aiUsed : "—", s: limits.aiMonthly != null ? "de " + limits.aiMonthly + " no seu plano" : "" },
          { l:"Últimos 12 meses", v: st.data ? total : "—", s: "análises geradas" },
          { l:"A cota renova", v: new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" }), s:"todo dia 1º" },
        ].map(k=>(
          <div key={k.l} className="card" style={{padding:"16px 18px"}}>
            <div style={{fontSize:12, color:"var(--muted)", fontWeight:600}}>{k.l}</div>
            <div className="ticker" style={{fontSize:26, fontWeight:800, letterSpacing:"-.02em", margin:"4px 0 2px"}}>{k.v}</div>
            <div style={{fontSize:12, color:"var(--muted)"}}>{k.s}</div>
          </div>
        ))}
      </div>
      <SettingsCard title="Por mês" sub="Análises por IA nos últimos 12 meses.">
        {st.error && <InlineNote kind="err">Não foi possível carregar o histórico. <button className="link-btn" onClick={reload}>Tentar de novo</button></InlineNote>}
        <div style={{display:"grid", gridTemplateColumns:"repeat(12, minmax(0, 1fr))", gap:8, alignItems:"end", height:150}}>
          {months.map(m=>(
            <div key={m.key} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%", justifyContent:"flex-end"}} title={m.v + (m.v === 1 ? " análise" : " análises")}>
              <span className="mono" style={{fontSize:10.5, color: m.v ? "var(--ink-2)" : "var(--muted)"}}>{m.v || ""}</span>
              <div style={{width:"100%", maxWidth:34, height: Math.max(3, Math.round((m.v / max) * 100)) + "px", borderRadius:6, background: m.v ? `linear-gradient(180deg, ${accent}, var(--violet))` : "var(--line-2)"}}/>
              <span style={{fontSize:10.5, color:"var(--muted)"}}>{m.label}</span>
            </div>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title="Mais recentes" sub="Data e hora de cada análise gerada.">
        {st.loading && !st.data && <div style={{fontSize:13, color:"var(--muted)"}}>Carregando…</div>}
        {!st.loading && recent.length === 0 && !st.error && (
          <div style={{padding:"22px 18px", border:"1px dashed var(--line)", borderRadius:12, background:"#fafbfe", textAlign:"center", fontSize:13, color:"var(--muted)"}}>
            Você ainda não gerou nenhuma análise. Abra um dashboard e clique em “Gerar análise”.
          </div>
        )}
        {recent.map((ts, i)=>{
          const d = new Date(ts);
          return (
            <div key={i} style={{display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-2)"}}>
              <span style={{width:28, height:28, borderRadius:8, background:"color-mix(in oklch, #7a5cff 14%, white)", color:"#7a5cff", display:"inline-flex", alignItems:"center", justifyContent:"center"}}><Icon.Sparkle size={13}/></span>
              <span style={{fontSize:13, flex:1}}>Análise por IA gerada</span>
              <span className="mono" style={{fontSize:12, color:"var(--muted)"}}>{d.toLocaleDateString("pt-BR")} · {d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}</span>
            </div>
          );
        })}
      </SettingsCard>
    </div>
  );
}

Object.assign(window, { AccountSection, InvoiceHistory, HistorySection, dashDeviceLabel });
