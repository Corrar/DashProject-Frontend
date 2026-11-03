/* Barra de navegação inferior do celular (estilo app de banco: 4 abas e uma
 * ação central em destaque). Só aparece em telas estreitas (CSS .tabbar em
 * index.html) e só para quem está logado nas telas do app — a Landing segue
 * com os dois botões dela.
 *
 * Abas: Início · Dashboards · [Novo] · Plano · Conta. "Novo" abre o envio de
 * arquivo; as outras levam ao Painel (home) ou à Conta.
 */
function MobileTabBar({ view, homeSection, onNav }){
  // Marca no <body> que a barra existe: o CSS reserva o espaço embaixo e sobe
  // a barra flutuante do dashboard (FAB) para não ficar por baixo dela.
  React.useEffect(()=>{
    document.body.classList.add("has-tabbar");
    return ()=> document.body.classList.remove("has-tabbar");
  }, []);

  const active =
    view === "upload" || view === "prompt" ? "new"
    : view === "account" ? "account"
    : view === "plans" ? "usage"
    : view === "dashboard" ? "dashboards"
    : view === "home" ? (homeSection === "dashboards" ? "dashboards" : homeSection === "usage" ? "usage" : homeSection === "overview" ? "overview" : null)
    : null;

  // Aba ativa mostra o ícone preenchido, como na barra de abas do iPhone.
  const tabs = [
    { k:"overview",   n:"Início",     i:Icon.Home,  f:Icon.HomeFill },
    { k:"dashboards", n:"Dashboards", i:Icon.Chart, f:Icon.ChartFill },
    { k:"new",        n:"Novo",       i:Icon.Plus,  center:true },
    { k:"usage",      n:"Plano",      i:Icon.Crown, f:Icon.CrownFill },
    { k:"account",    n:"Conta",      i:Icon.User,  f:Icon.UserFill },
  ];

  return (
    <nav className="tabbar no-export" aria-label="Navegação principal">
      {tabs.map(t => {
        const on = active === t.k;
        if(t.center){
          return (
            <button key={t.k} className={"tabbar-center" + (on ? " on" : "")} onClick={()=> onNav(t.k)}
              aria-label="Novo dashboard" aria-current={on ? "page" : undefined}>
              <span className="tabbar-fab"><Icon.Plus size={24} stroke={2.4}/></span>
              <span className="tabbar-label">{t.n}</span>
            </button>
          );
        }
        return (
          <button key={t.k} className={"tabbar-item" + (on ? " on" : "")} onClick={()=> onNav(t.k)}
            aria-current={on ? "page" : undefined}>
            <span className="tabbar-icon">{on ? <t.f size={25}/> : <t.i size={25}/>}</span>
            <span className="tabbar-label">{t.n}</span>
          </button>
        );
      })}
    </nav>
  );
}

Object.assign(window, { MobileTabBar });
