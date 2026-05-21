/* AuthModal — sign in / sign up form backed by Supabase Auth.
 * Reads from window.supabaseClient (initialized in Dash.html). The forms call
 * supa.auth.signInWithPassword / signUp / resetPasswordForEmail. Auth state
 * propagation happens in App via onAuthStateChange — this modal closes on
 * sign-in success and shows a "confirme seu e-mail" message on sign-up.
 *
 * Accessibility:
 * - ESC closes
 * - Backdrop click closes (inner card stops propagation)
 * - First input is auto-focused on open
 * - Body overflow locked while open so the page underneath doesn't scroll
 */

function AuthField({ label, htmlFor, children, hint }){
  return (
    <div style={{marginBottom:12}}>
      <label htmlFor={htmlFor} style={{
        display:"block", fontSize:12, fontWeight:600, color:"var(--ink-2)",
        marginBottom:6, letterSpacing:".01em"
      }}>{label}</label>
      {children}
      {hint && <div style={{fontSize:11, color:"var(--muted)", marginTop:4}}>{hint}</div>}
    </div>
  );
}

const authFieldStyle = {
  width:"100%", padding:"10px 12px", border:"1px solid var(--line)", borderRadius:10,
  fontSize:14, outline:"none", color:"var(--ink)", fontFamily:"inherit",
  boxSizing:"border-box",
};

const authLinkButton = {
  background:"transparent", border:0, color:"var(--brand)", cursor:"pointer",
  fontSize:12, fontWeight:600, padding:0,
};

function AuthModal({ open, initialTab = "signin", onClose, tweaks }){
  const [tab, setTab] = React.useState(initialTab);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [info, setInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const firstInputRef = React.useRef(null);

  // Reset transient state when the modal opens (or when caller flips initialTab).
  React.useEffect(()=>{
    if(!open) return;
    setTab(initialTab);
    setError(null);
    setInfo(null);
  }, [open, initialTab]);

  // ESC closes, body scroll locks, first input gets focus.
  React.useEffect(()=>{
    if(!open) return undefined;
    const onKey = (e)=>{ if(e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(()=> firstInputRef.current && firstInputRef.current.focus(), 50);
    return ()=>{
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if(!open) return null;

  const supa = window.supabaseClient;
  const accent = (tweaks && tweaks.accent) || "var(--brand)";

  const guardSupa = ()=>{
    if(!supa || !supa.auth){
      setError("Cliente Supabase indisponível. Verifique a anon key em Dash.html.");
      return false;
    }
    return true;
  };

  const handleSignIn = async (e)=>{
    e.preventDefault();
    setError(null); setInfo(null);
    if(!guardSupa()) return;
    setLoading(true);
    try {
      const { error: err } = await supa.auth.signInWithPassword({ email, password });
      if(err){ setError(err.message || "Falha ao entrar."); return; }
      // Success — onAuthStateChange (App) fires loadUserProfile and closes
      // the modal indirectly via the controlled `open` prop. We also close
      // here optimistically so the modal disappears right away.
      onClose();
    } catch(err){
      setError((err && err.message) || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e)=>{
    e.preventDefault();
    setError(null); setInfo(null);
    if(password.length < 8){ setError("Senha deve ter pelo menos 8 caracteres."); return; }
    if(password !== confirmPassword){ setError("As senhas não coincidem."); return; }
    if(!acceptedTerms){ setError("Aceite os termos de uso para continuar."); return; }
    if(!guardSupa()) return;
    setLoading(true);
    try {
      const { error: err } = await supa.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || null } },
      });
      if(err){ setError(err.message || "Falha ao criar conta."); return; }
      // Don't close — the user needs to confirm their e-mail before login.
      setInfo("Conta criada. Confirme seu e-mail antes de fazer login.");
      setPassword(""); setConfirmPassword("");
    } catch(err){
      setError((err && err.message) || "Falha ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async ()=>{
    setError(null); setInfo(null);
    if(!email){ setError("Informe seu e-mail antes de pedir a redefinição."); return; }
    if(!guardSupa()) return;
    setLoading(true);
    try {
      const { error: err } = await supa.auth.resetPasswordForEmail(email);
      if(err){ setError(err.message || "Falha ao enviar link."); return; }
      setInfo("Enviamos um link de redefinição para o e-mail informado.");
    } catch(err){
      setError((err && err.message) || "Falha ao enviar link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:130,
      background:"rgba(11,16,32,.55)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
      animation:"fade .2s ease",
    }}>
      <style>{`@keyframes fade{ from{ opacity:0 } } @keyframes pop{ from{ opacity:0; transform: translateY(8px) scale(.98); } }`}</style>
      <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true"
        aria-labelledby="auth-modal-title"
        style={{
          width:"min(460px, 100%)", maxHeight:"90vh", overflow:"auto",
          background:"white", borderRadius:18,
          boxShadow:"0 40px 80px -20px rgba(11,16,32,.5)",
          animation:"pop .3s cubic-bezier(.2,.7,.2,1)",
        }}>
        <div style={{padding:"24px 28px 0", position:"relative"}}>
          <button onClick={onClose} aria-label="Fechar" style={{
            position:"absolute", top:14, right:14, width:30, height:30, borderRadius:8,
            background:"transparent", color:"var(--muted)", border:0, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center"
          }}><Icon.X size={16}/></button>
          <h2 id="auth-modal-title" style={{margin:"0 0 6px", fontSize:22, fontWeight:800, letterSpacing:"-.02em"}}>
            {tab === "signin" ? "Entrar no Dash" : "Criar conta"}
          </h2>
          <p style={{margin:0, fontSize:13, color:"var(--muted)"}}>
            {tab === "signin" ? "Acesse seus dashboards salvos." : "Comece grátis em segundos. Sem cartão."}
          </p>
        </div>

        <div style={{display:"flex", gap:0, padding:"18px 28px 0", borderBottom:"1px solid var(--line-2)"}}>
          {[
            {k:"signin", n:"Entrar"},
            {k:"signup", n:"Criar conta"},
          ].map(t => (
            <button key={t.k} onClick={()=>{ setTab(t.k); setError(null); setInfo(null); }} style={{
              padding:"10px 16px", border:0, background:"transparent", cursor:"pointer",
              borderBottom: tab===t.k ? `2px solid ${accent}` : "2px solid transparent",
              color: tab===t.k ? "var(--ink)" : "var(--muted)",
              fontWeight: tab===t.k ? 700 : 500, fontSize:13, marginBottom:-1,
            }}>{t.n}</button>
          ))}
        </div>

        <div style={{padding:"20px 28px 28px"}}>
          {error && (
            <div role="alert" style={{
              padding:"10px 14px", borderRadius:10, background:"#fff7f9",
              border:"1px solid #ffd2dd", color:"#c9234a",
              fontSize:13, marginBottom:14, display:"flex", alignItems:"flex-start", gap:8
            }}>
              <Icon.Bolt size={14}/> <span>{error}</span>
            </div>
          )}
          {info && (
            <div role="status" style={{
              padding:"10px 14px", borderRadius:10, background:"#e7f7ef",
              border:"1px solid #b7e0c8", color:"#0a5a30",
              fontSize:13, marginBottom:14, display:"flex", alignItems:"flex-start", gap:8
            }}>
              <Icon.Check size={14} stroke={2.6}/> <span>{info}</span>
            </div>
          )}

          {tab === "signin" ? (
            <form onSubmit={handleSignIn}>
              <AuthField label="E-mail" htmlFor="auth-email">
                <input ref={firstInputRef} id="auth-email" type="email" required autoComplete="email"
                  value={email} onChange={e=>setEmail(e.target.value)} style={authFieldStyle}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor="var(--line)"}/>
              </AuthField>
              <AuthField label="Senha" htmlFor="auth-password">
                <input id="auth-password" type="password" required autoComplete="current-password"
                  value={password} onChange={e=>setPassword(e.target.value)} style={authFieldStyle}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor="var(--line)"}/>
              </AuthField>
              <div style={{display:"flex", justifyContent:"flex-end", marginTop:-4, marginBottom:14}}>
                <button type="button" onClick={handleResetPassword} disabled={loading} style={authLinkButton}>
                  Esqueci minha senha
                </button>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{width:"100%", justifyContent:"center", padding:"12px"}}>
                {loading ? "Entrando..." : <>Entrar <Icon.Arrow size={14}/></>}
              </button>
              <div style={{textAlign:"center", marginTop:14, fontSize:13, color:"var(--muted)"}}>
                Não tem conta?{" "}
                <button type="button" onClick={()=>{ setTab("signup"); setError(null); setInfo(null); }} style={authLinkButton}>
                  Criar conta
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignUp}>
              <AuthField label="E-mail" htmlFor="auth-email">
                <input ref={firstInputRef} id="auth-email" type="email" required autoComplete="email"
                  value={email} onChange={e=>setEmail(e.target.value)} style={authFieldStyle}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor="var(--line)"}/>
              </AuthField>
              <AuthField label="Nome completo (opcional)" htmlFor="auth-name">
                <input id="auth-name" type="text" autoComplete="name"
                  value={fullName} onChange={e=>setFullName(e.target.value)} style={authFieldStyle}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor="var(--line)"}/>
              </AuthField>
              <AuthField label="Senha" htmlFor="auth-password" hint="Mínimo 8 caracteres.">
                <input id="auth-password" type="password" required minLength={8} autoComplete="new-password"
                  value={password} onChange={e=>setPassword(e.target.value)} style={authFieldStyle}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor="var(--line)"}/>
              </AuthField>
              <AuthField label="Confirmar senha" htmlFor="auth-confirm">
                <input id="auth-confirm" type="password" required minLength={8} autoComplete="new-password"
                  value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} style={authFieldStyle}
                  onFocus={e=>e.target.style.borderColor=accent}
                  onBlur={e=>e.target.style.borderColor="var(--line)"}/>
              </AuthField>
              <label style={{display:"flex", alignItems:"flex-start", gap:8, margin:"4px 0 16px", cursor:"pointer", fontSize:13, color:"var(--ink-2)"}}>
                <input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}
                  style={{marginTop:3, accentColor:"var(--brand)"}}/>
                <span>Aceito os termos de uso e a política de privacidade.</span>
              </label>
              <button type="submit" className="btn btn-primary" disabled={loading || !acceptedTerms}
                style={{width:"100%", justifyContent:"center", padding:"12px", opacity: acceptedTerms ? 1 : .6}}>
                {loading ? "Criando conta..." : <>Criar conta <Icon.Arrow size={14}/></>}
              </button>
              <div style={{textAlign:"center", marginTop:14, fontSize:13, color:"var(--muted)"}}>
                Já tem conta?{" "}
                <button type="button" onClick={()=>{ setTab("signin"); setError(null); setInfo(null); }} style={authLinkButton}>
                  Entrar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthModal });
