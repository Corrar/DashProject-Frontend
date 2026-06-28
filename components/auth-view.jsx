/* AuthView — full-screen sign-in / sign-up page (backend próprio via DashAPI).
 *
 * Mirrors the logic of components/auth-modal.jsx (which stays as a fallback
 * surface, e.g. paywall flows) but exposes it as a routed view so that
 * landing/topbar buttons can navigate here instead of opening a modal.
 *
 * Submit handlers call:
 *   - DashAPI.login(email, password)  → on success, onAuthChange (App) hydrates
 *     currentUser; we call onSuccess() so App navigates back to returnView.
 *   - DashAPI.signup(email, password, fullName)  → conta criada e sessão já
 *     ativa, mas e-mail ainda não verificado: render SuccessCard com a copy
 *     "confirme seu e-mail" e fica na página.
 *
 * authErrorMessage() é definido em auth-modal.jsx (carrega antes) e reusado aqui.
 *
 * Microsoft login removed; Google left as a placeholder (alert "Em breve").
 */

function PasswordStrength({ value }){
  const checks = [
    { k:"len", t:"8+ caracteres", ok: value.length >= 8 },
    { k:"num", t:"1 número", ok: /\d/.test(value) },
    { k:"case", t:"Maiúscula", ok: /[A-Z]/.test(value) },
    { k:"sym", t:"Símbolo", ok: /[^A-Za-z0-9]/.test(value) },
  ];
  const score = checks.filter(c=>c.ok).length;
  const colors = ["#c9234a", "#ff7849", "#ffbe2e", "#0a8a4a", "#0a8a4a"];
  const labels = ["Fraca", "Fraca", "Média", "Boa", "Forte"];
  return (
    <div style={{marginTop:6}}>
      <div style={{display:"flex", gap:3, marginBottom:6}}>
        {[0,1,2,3].map(i=>(
          <span key={i} style={{
            flex:1, height:3, borderRadius:99,
            background: i < score ? colors[score] : "var(--line-2)",
            transition:"background .2s"
          }}/>
        ))}
      </div>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)"}}>
        <span>Segurança: <b style={{color: value ? colors[score] : "var(--muted)"}}>{value ? labels[score] : "—"}</b></span>
        <span className="mono">{score}/4</span>
      </div>
      <div style={{display:"flex", flexWrap:"wrap", gap:4, marginTop:6}}>
        {checks.map(c=>(
          <span key={c.k} style={{
            display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px",
            background: c.ok ? "#e7f7ef" : "var(--line-2)",
            color: c.ok ? "#0a8a4a" : "var(--muted)",
            borderRadius:99, fontSize:11, fontWeight:500
          }}>
            {c.ok ? <Icon.Check size={10} stroke={3}/> : <span style={{width:6, height:6, borderRadius:"50%", background:"var(--muted)"}}/>}
            {c.t}
          </span>
        ))}
      </div>
    </div>
  );
}

function AuthField({ label, error, hint, children }){
  return (
    <label style={{display:"block"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
        <span style={{fontSize:12, fontWeight:600, color:"var(--ink-2)"}}>{label}</span>
        {hint && <span style={{fontSize:11, color:"var(--muted)"}}>{hint}</span>}
      </div>
      {children}
      {error && <div style={{marginTop:6, fontSize:11, color:"#c9234a", display:"flex", alignItems:"center", gap:5}}>
        <Icon.Bolt size={11}/> {error}
      </div>}
    </label>
  );
}

function AuthView({ mode, onMode, tweaks, onSuccess, onClose }){
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [apiError, setApiError] = React.useState(null);
  const [state, setState] = React.useState("idle"); // idle | submitting | success

  const isSignup = mode === "signup";

  // Reset transient API error when switching modes so a stale signin error
  // doesn't bleed into the signup form (and vice versa).
  React.useEffect(()=>{
    setApiError(null);
    setErrors({});
    setState("idle");
  }, [mode]);

  const validate = ()=>{
    const e = {};
    if(isSignup && !name.trim()) e.name = "Informe seu nome completo.";
    if(!email.trim()) e.email = "Email é obrigatório.";
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email inválido.";
    if(!password) e.password = "Senha é obrigatória.";
    else if(isSignup && password.length < 8) e.password = "A senha precisa ter pelo menos 8 caracteres.";
    if(isSignup && !terms) e.terms = "Aceite os termos para continuar.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev)=>{
    ev.preventDefault();
    if(state === "submitting") return;
    setApiError(null);
    if(!validate()) return;
    setState("submitting");
    try {
      if(isSignup){
        await window.DashAPI.signup(email, password, name || null);
        // Conta criada; sessão já ativa, mas e-mail ainda não verificado.
        // Mantém o SuccessCard "confirme seu e-mail".
        setState("success");
      } else {
        await window.DashAPI.login(email, password);
        // onAuthChange (App) hidrata currentUser; devolve controle ao App.
        onSuccess && onSuccess({ mode: "signin" });
      }
    } catch(err){
      setApiError(authErrorMessage(err));
      setState("idle");
    }
  };

  const onGoogle = ()=> window.alert("Login com Google: em breve.");

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column"}}>
      {/* Mini topbar */}
      <div style={{padding:"18px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth: 1400, margin:"0 auto", width:"100%"}}>
        <button onClick={onClose} style={{display:"flex", alignItems:"center", gap:10, background:"transparent", border:0, cursor:"pointer"}}>
          <Icon.Logo size={30}/>
          <div style={{display:"flex", flexDirection:"column", lineHeight:1, textAlign:"left"}}>
            <span style={{fontWeight:700, fontSize:15}}>{tweaks.brandName}</span>
            <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>DASHBOARDS · IA</span>
          </div>
        </button>
        <button onClick={onClose} className="btn btn-ghost" style={{padding:"8px 12px", fontSize:13}}>
          <Icon.Arrow size={13} style={{transform:"rotate(180deg)"}}/> Voltar
        </button>
      </div>

      <div style={{flex:1, display:"grid", gridTemplateColumns:"1fr 1.05fr", maxWidth:1400, margin:"0 auto", width:"100%", padding:"0 24px 24px", gap:48, alignItems:"center"}}>
        {/* LEFT — form */}
        <div style={{maxWidth: 460, width:"100%", margin:"0 auto", padding:"40px 0"}}>
          {state === "success" ? (
            <SuccessCard mode={mode} tweaks={tweaks} name={name} onBack={()=>{ setState("idle"); onMode("login"); }}/>
          ) : (
            <>
              <div style={{marginBottom: 28}}>
                <div className="eyebrow" style={{marginBottom:14}}>
                  <span className="dot"/>
                  {isSignup ? "Criar conta" : "Entrar na sua conta"}
                </div>
                <h1 style={{margin:"0 0 8px", fontSize:32, fontWeight:800, letterSpacing:"-.025em"}}>
                  {isSignup ? "Comece grátis." : "Bem-vindo de volta."}
                  <br/>
                  <span style={{
                    background: `linear-gradient(120deg, ${tweaks.accent}, var(--violet))`,
                    WebkitBackgroundClip:"text", color:"transparent"
                  }}>
                    {isSignup ? "Faça upgrade quando quiser." : "Continue de onde parou."}
                  </span>
                </h1>
                <p style={{margin:0, fontSize:14, color:"var(--muted)", lineHeight:1.55}}>
                  {isSignup
                    ? "Crie sua conta em segundos. Sem cartão. Faça upgrade quando quiser."
                    : "Acesse seus dashboards salvos e a exportação dos seus arquivos."}
                </p>
              </div>

              {apiError && (
                <div role="alert" style={{
                  padding:"10px 14px", borderRadius:10, background:"#fff7f9",
                  border:"1px solid #ffd2dd", color:"#c9234a",
                  fontSize:13, marginBottom:14, display:"flex", alignItems:"flex-start", gap:8
                }}>
                  <Icon.Bolt size={14}/> <span>{apiError}</span>
                </div>
              )}

              {/* Social */}
              <div style={{marginBottom:18}}>
                <button type="button" onClick={onGoogle} className="btn btn-ghost"
                  style={{width:"100%", padding:"11px 12px", justifyContent:"center"}}>
                  <GoogleLogo/> Continuar com Google
                </button>
              </div>

              <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:18, color:"var(--muted)", fontSize:11}}>
                <div style={{flex:1, height:1, background:"var(--line)"}}/>
                <span style={{textTransform:"uppercase", letterSpacing:".08em", fontWeight:600}}>ou com email</span>
                <div style={{flex:1, height:1, background:"var(--line)"}}/>
              </div>

              <form onSubmit={onSubmit} style={{display:"flex", flexDirection:"column", gap:14}}>
                {isSignup && (
                  <AuthField label="Nome completo" error={errors.name}>
                    <input type="text" placeholder="Maria Andrade" value={name}
                      onChange={e=>{ setName(e.target.value); setErrors(x=>({...x, name:""})); }}
                      style={inputStyle(errors.name)}/>
                  </AuthField>
                )}
                <AuthField label="Email" error={errors.email}>
                  <input type="email" placeholder="voce@empresa.com" value={email}
                    onChange={e=>{ setEmail(e.target.value); setErrors(x=>({...x, email:""})); }}
                    autoComplete="email"
                    style={inputStyle(errors.email)}/>
                </AuthField>
                <AuthField label="Senha" error={errors.password}
                  hint={!isSignup ? <span style={{color:"var(--muted)"}}>Recuperação em breve</span> : null}>
                  <div style={{position:"relative"}}>
                    <input type={showPw?"text":"password"} placeholder={isSignup?"Mínimo 8 caracteres":"••••••••"}
                      value={password}
                      onChange={e=>{ setPassword(e.target.value); setErrors(x=>({...x, password:""})); }}
                      autoComplete={isSignup?"new-password":"current-password"}
                      style={{...inputStyle(errors.password), paddingRight:42}}/>
                    <button type="button" onClick={()=>setShowPw(!showPw)} aria-label={showPw?"Ocultar senha":"Mostrar senha"} style={{
                      position:"absolute", top:"50%", right:10, transform:"translateY(-50%)",
                      background:"transparent", border:0, cursor:"pointer", color:"var(--muted)",
                      padding:6, borderRadius:6
                    }}>
                      <Icon.Eye size={14}/>
                    </button>
                  </div>
                  {isSignup && password && <PasswordStrength value={password}/>}
                </AuthField>
                {isSignup && (
                  <AuthField label="Empresa (opcional)">
                    <input type="text" placeholder="Acme Co." value={company}
                      onChange={e=>setCompany(e.target.value)}
                      style={inputStyle()}/>
                  </AuthField>
                )}
                {isSignup && (
                  <label style={{
                    display:"flex", alignItems:"flex-start", gap:10, padding:"4px 0",
                    fontSize:12, color: errors.terms ? "#c9234a" : "var(--ink-2)", cursor:"pointer"
                  }}>
                    <input type="checkbox" checked={terms} onChange={e=>{ setTerms(e.target.checked); setErrors(x=>({...x, terms:""})); }}
                      style={{accentColor:"var(--brand)", marginTop:2}}/>
                    <span style={{lineHeight:1.5}}>
                      Concordo com os <a style={{color:"var(--brand)", fontWeight:600}}>Termos</a> e a <a style={{color:"var(--brand)", fontWeight:600}}>Política de Privacidade</a>. Meus dados nunca saem do navegador sem meu consentimento.
                    </span>
                  </label>
                )}
                <button type="submit" className="btn btn-primary" disabled={state==="submitting"}
                  style={{justifyContent:"center", padding:"14px", fontSize:14, marginTop:6, opacity: state==="submitting"?0.8:1}}>
                  {state==="submitting" ? <><Spinner/> {isSignup?"Criando conta…":"Entrando…"}</> :
                    (isSignup ? <>Criar conta <Icon.Arrow size={14}/></> :
                                <>Entrar <Icon.Arrow size={14}/></>)}
                </button>
              </form>

              <div style={{marginTop:22, textAlign:"center", fontSize:13, color:"var(--muted)"}}>
                {isSignup ? (
                  <>Já tem conta? <a onClick={()=>{ setErrors({}); setApiError(null); onMode("login"); }} style={{color:"var(--brand)", fontWeight:600, cursor:"pointer"}}>Entrar</a></>
                ) : (
                  <>Ainda não tem conta? <a onClick={()=>{ setErrors({}); setApiError(null); onMode("signup"); }} style={{color:"var(--brand)", fontWeight:600, cursor:"pointer"}}>Criar conta gratuita</a></>
                )}
              </div>

              <div style={{
                marginTop:24, padding:"12px 14px", borderRadius:10, background:"#fafbfe",
                border:"1px solid var(--line-2)", display:"flex", gap:10, alignItems:"flex-start"
              }}>
                <Icon.Lock size={14} color="#0a8a4a"/>
                <div style={{fontSize:12, color:"var(--muted)", lineHeight:1.55}}>
                  Conexão criptografada · Conformidade LGPD. Seus dados de planilha ficam no seu navegador.
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — pitch panel */}
        <AuthSidePanel tweaks={tweaks} mode={mode}/>
      </div>
    </div>
  );
}

const inputStyle = (err)=>({
  width:"100%", padding:"12px 14px", border: `1px solid ${err?"#c9234a":"var(--line)"}`,
  borderRadius:10, fontSize:14, fontFamily:"inherit", color:"var(--ink)",
  outline:"none", background:"white", transition:"border-color .15s ease, box-shadow .15s ease",
});

function Spinner(){
  return (
    <span style={{
      width:14, height:14, borderRadius:"50%",
      border:"2px solid rgba(255,255,255,.35)", borderTopColor:"white",
      animation:"spin .8s linear infinite", display:"inline-block"
    }}>
      <style>{`@keyframes spin{ to{ transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function GoogleLogo(){
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.13 4.13 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.27c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.32A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.67 9c0-.6.1-1.17.3-1.71V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.04l3.03-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.96L3.97 7.3C4.68 5.17 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

function AuthSidePanel({ tweaks, mode }){
  const features = [
    "Análises da IA destravadas: resumo, riscos e recomendações",
    "Edição completa do layout — drag-and-drop, ⅓/½/⅔/full",
    "Dashboards avançados: cohort, sazonalidade, outliers",
    "Exportação PDF/PNG fiel ao dashboard",
    "Compartilhamento por link e embed",
  ];
  return (
    <div style={{
      borderRadius: 24, padding: "44px 36px", color:"white", position:"relative", overflow:"hidden",
      background: `
        radial-gradient(ellipse at 0% 0%, rgba(255,255,255,.18), transparent 50%),
        radial-gradient(ellipse at 100% 100%, rgba(122,92,255,.6), transparent 50%),
        linear-gradient(135deg, ${tweaks.accent}, var(--violet) 60%, #0b1020)
      `,
      minHeight: 560,
      display:"flex", flexDirection:"column", justifyContent:"space-between"
    }}>
      <div style={{position:"relative", zIndex:2}}>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:7, padding:"4px 10px",
          borderRadius:99, background:"rgba(255,255,255,.18)", fontSize:11, fontWeight:600, marginBottom:18
        }}>
          <Icon.Crown size={11}/> Pro · R$ 49/mês
        </div>
        <h2 style={{margin:"0 0 12px", fontSize:32, fontWeight:800, letterSpacing:"-.025em", lineHeight:1.1}}>
          Da planilha ao dashboard.<br/>Sem código.
        </h2>
        <p style={{margin:"0 0 28px", fontSize:14, color:"rgba(255,255,255,.85)", lineHeight:1.55, maxWidth:380}}>
          {mode==="signup"
            ? "Crie a conta e use o Dash gratuitamente. Faça upgrade para Pro quando precisar das análises avançadas."
            : "Entre e continue de onde parou. Suas configurações e bases de dados ficam no seu navegador."}
        </p>

        {/* Glassy mini dashboard preview */}
        <div style={{
          background: "rgba(255,255,255,.08)", backdropFilter:"blur(6px)",
          border: "1px solid rgba(255,255,255,.18)", borderRadius: 14, padding: 14,
          boxShadow: "0 20px 40px -20px rgba(0,0,0,.4)"
        }}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10}}>
            <div>
              <div className="mono" style={{fontSize:9, opacity:.7, letterSpacing:".06em"}}>RECEITA · Q3</div>
              <div style={{fontWeight:800, fontSize:20, letterSpacing:"-.01em"}}>R$ 1,28M</div>
            </div>
            <span style={{padding:"3px 8px", background:"rgba(0,195,154,.25)", color:"#7af2c5", borderRadius:99, fontSize:10, fontWeight:700}}>▲ 18,4%</span>
          </div>
          <div style={{height: 70}}>
            <svg width="100%" height="70" viewBox="0 0 280 70" preserveAspectRatio="none">
              <defs>
                <linearGradient id="auth-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity=".4"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0 55 C30 50, 50 40, 80 35 S 140 20, 170 22 S 230 8, 280 12 L 280 70 L 0 70 Z" fill="url(#auth-grad)"/>
              <path d="M0 55 C30 50, 50 40, 80 35 S 140 20, 170 22 S 230 8, 280 12" fill="none" stroke="white" strokeWidth="2"/>
            </svg>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginTop:8}}>
            {[{l:"NPS", v:74},{l:"Conv.", v:"4,8%"},{l:"AOV", v:"R$ 219"}].map(k=>(
              <div key={k.l} style={{padding:"6px 8px", background:"rgba(255,255,255,.06)", borderRadius:6}}>
                <div style={{fontSize:8, opacity:.7, textTransform:"uppercase", letterSpacing:".06em"}}>{k.l}</div>
                <div style={{fontWeight:700, fontSize:13}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature list */}
        <ul style={{listStyle:"none", padding:0, margin:"24px 0 0", display:"flex", flexDirection:"column", gap:10}}>
          {features.map(f=>(
            <li key={f} style={{display:"flex", gap:10, alignItems:"flex-start", fontSize:13, lineHeight:1.5}}>
              <span style={{
                width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1,
                background:"rgba(255,255,255,.2)", color:"white",
                display:"inline-flex", alignItems:"center", justifyContent:"center"
              }}>
                <Icon.Check size={11} stroke={3}/>
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Testimonial */}
      <div style={{position:"relative", zIndex:2, paddingTop: 24, borderTop:"1px solid rgba(255,255,255,.15)", marginTop:24}}>
        <p style={{margin:"0 0 10px", fontSize:14, fontStyle:"italic", color:"rgba(255,255,255,.92)", lineHeight:1.5}}>
          "O Dash virou nosso primeiro lugar para olhar antes de qualquer reunião de produto."
        </p>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#ff7849,#ff5e93)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12}}>BS</div>
          <div style={{fontSize:12}}>
            <div style={{fontWeight:600}}>Beatriz Sá</div>
            <div style={{opacity:.7}}>Head of Data · North Star</div>
          </div>
          <div style={{flex:1}}/>
          <div style={{display:"flex", gap:6}}>
            <span style={{padding:"3px 8px", background:"rgba(255,255,255,.12)", borderRadius:99, fontSize:10, fontWeight:600}}>LGPD</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// SuccessCard is shown after a successful signup. The user must click the
// confirmation link in their inbox before they can sign in, so we don't
// redirect — they read the message and either go check email or switch to
// the login tab.
function SuccessCard({ mode, tweaks, name, onBack }){
  return (
    <div style={{textAlign:"center", padding:"30px 20px"}}>
      <div style={{
        width:80, height:80, margin:"0 auto 20px", borderRadius:24,
        background:"linear-gradient(180deg, #0a8a4a, #006b3a)",
        color:"white", display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 20px 40px -16px rgba(10,138,74,.5)",
        animation:"successPop .4s cubic-bezier(.2,.7,.2,1)"
      }}>
        <Icon.Check size={40} stroke={3}/>
      </div>
      <style>{`@keyframes successPop{ 0%{ transform: scale(.6); opacity:0; } 60%{ transform: scale(1.08); } }`}</style>
      <h2 style={{margin:"0 0 8px", fontSize:24, fontWeight:800, letterSpacing:"-.02em"}}>
        Conta criada{name?`, ${name.split(" ")[0]}!`:" com sucesso!"}
      </h2>
      <p style={{margin:"0 0 20px", color:"var(--muted)", fontSize:14, lineHeight:1.55}}>
        Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e fazer login.
      </p>
      <button onClick={onBack} className="btn btn-ghost"
        style={{padding:"10px 16px", fontSize:13}}>
        Já confirmei → Entrar
      </button>
    </div>
  );
}

Object.assign(window, { AuthView });
