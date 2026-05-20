/* Dashboard app — improved layout + scroll-driven reveals */

function Topbar({ onClose, tweaks, fileInfo }){
  const fname = fileInfo?.name || "vendas_exemplo.csv";
  return (
    <div className="topbar">
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", maxWidth: 1480, margin:"0 auto"}}>
        <div style={{display:"flex", alignItems:"center", gap:14}}>
          <Icon.Logo size={28}/>
          <div style={{display:"flex", flexDirection:"column", lineHeight:1}}>
            <span style={{fontWeight:700, fontSize:14}}>{tweaks.brandName}</span>
            <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>DASHBOARDS · IA</span>
          </div>
          <div style={{width:1, height:24, background:"var(--line)", margin:"0 6px"}}/>
          <div style={{display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--muted)"}}>
            <span>Workspace</span>
            <Icon.Caret size={12}/>
            <span style={{color:"var(--ink-2)", fontWeight:600}}>{fname}</span>
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <button className="btn btn-ghost" style={{padding:"8px 12px"}} onClick={onClose}><Icon.Arrow size={14} style={{transform:"rotate(180deg)"}}/> Início</button>
          <button className="btn btn-ghost" style={{padding:"8px 12px"}}><Icon.Share size={14}/> Compartilhar</button>
          <button className="btn btn-primary" style={{padding:"8px 14px"}}><Icon.Crown size={14}/> Fazer upgrade</button>
          <div style={{width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg, #ff7849, #ff5e93)", color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12}}>MA</div>
        </div>
      </div>
    </div>
  );
}

function UploadView({ onUploaded }){
  const [drag, setDrag] = React.useState(false);
  const [tab, setTab] = React.useState("file"); // file, paste, url, sample

  const formats = [
    {
      k:"csv", ext:".csv", n:"CSV", c:"#0a8a4a",
      desc:"Valores separados por vírgula ou ponto-e-vírgula. UTF-8.",
      max:"50 MB", rows:"até 500k linhas",
      sample: `data,produto,regiao,valor
2026-07-12,Mesa Ajustável,CO,2980
2026-07-12,Notebook Pro 14,SE,8120`,
    },
    {
      k:"xlsx", ext:".xlsx · .xls", n:"Excel", c:"#1b6f3b",
      desc:"Planilhas do Excel. Detectamos cabeçalho e tipos automaticamente.",
      max:"25 MB", rows:"primeira aba ou escolha qual",
      sample: `[ Planilha1 ]
| data       | produto         | regiao | valor |
| 2026-07-12 | Mesa Ajustável  | CO     | 2980  |`,
    },
    {
      k:"json", ext:".json · .ndjson", n:"JSON", c:"#7a5cff",
      desc:"Array de objetos ou JSON line-delimited (uma linha por registro).",
      max:"30 MB", rows:"até 250k objetos",
      sample: `[
  { "data":"2026-07-12", "produto":"Mesa", "valor":2980 },
  { "data":"2026-07-12", "produto":"Notebook", "valor":8120 }
]`,
    },
    {
      k:"tsv", ext:".tsv · .txt", n:"TSV", c:"#ff7849",
      desc:"Valores separados por tabulação. Útil para exports brutos.",
      max:"50 MB", rows:"detecção automática",
      sample: `data\tproduto\tvalor
2026-07-12\tMesa\t2980`,
    },
    {
      k:"parquet", ext:".parquet", n:"Parquet", c:"#2f6bff", pro:true,
      desc:"Formato colunar comprimido. Ótimo para arquivos grandes.",
      max:"200 MB", rows:"até 5M linhas",
      sample: `[binário, otimizado para análise]
schema inferida automaticamente`,
    },
    {
      k:"gsheet", ext:"link compartilhado", n:"Google Sheets", c:"#34a853", pro:true,
      desc:"Cole o link público da planilha. Sincronização opcional.",
      max:"qualquer tamanho", rows:"primeira aba por padrão",
      sample: `https://docs.google.com/spreadsheets/d/...
☑ acesso somente leitura`,
    },
  ];

  const [preview, setPreview] = React.useState(formats[0]);
  const [filename, setFilename] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [step, setStep] = React.useState(""); // "" | reading | parsing | analyzing | done
  const fileInputRef = React.useRef(null);

  const runProcessing = (file)=>{
    const name = file?.name || "dados.csv";
    const sizeKB = file?.size ? Math.round(file.size/1024) : 86;
    setFilename({ name, sizeKB, rows: 0, cols: 0 });
    setStep("reading");
    setProgress(0);
    const steps = [
      { p: 30, s: "reading", ms: 420 },
      { p: 65, s: "parsing", ms: 520 },
      { p: 92, s: "analyzing", ms: 640 },
      { p: 100, s: "done", ms: 380 },
    ];
    let i = 0;
    const tick = ()=>{
      if(i >= steps.length){
        setTimeout(()=> onUploaded && onUploaded({ name, sizeKB, rows: 120, cols: 10 }), 400);
        return;
      }
      const stp = steps[i++];
      setStep(stp.s);
      setProgress(stp.p);
      if(stp.s === "done"){
        setFilename(prev => ({...prev, rows: 120, cols: 10}));
      }
      setTimeout(tick, stp.ms);
    };
    tick();
  };

  const onPickFile = ()=> fileInputRef.current?.click();
  const onFileChosen = (e)=>{
    const file = e.target.files?.[0];
    if(file) runProcessing(file);
    e.target.value = "";
  };
  const onDropFile = (e)=>{
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if(file) runProcessing(file);
  };

  return (
    <div style={{maxWidth: 1100, margin:"40px auto 0", padding:"0 24px 80px"}}>
      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt,.json,.ndjson,.xlsx,.xls,.parquet" style={{display:"none"}} onChange={onFileChosen}/>
      <div style={{textAlign:"center", marginBottom: 36}}>
        <div className="rv eyebrow" style={{marginBottom:18}}><Icon.Sparkle size={12}/> Powered by IA · seus dados nunca saem do navegador</div>
        <h1 className="rv h-section" style={{margin:"0 0 12px", fontSize: 44}}>Envie seus dados e a IA monta o <span style={{color:"var(--brand)"}}>dashboard</span>.</h1>
        <p className="rv lede" style={{margin:"0 auto", maxWidth: 580}}>Escolha uma fonte abaixo. Em segundos você tem KPIs, gráficos e análises prontas.</p>
      </div>

      {/* Tabs */}
      <div className="rv" style={{display:"flex", justifyContent:"center", marginBottom: 18}}>
        <div className="seg" style={{padding:4, borderRadius:12, background:"white", border:"1px solid var(--line)"}}>
          {[
            {k:"file", i:<Icon.Upload size={14}/>, n:"Enviar arquivo"},
            {k:"paste", i:<Icon.Doc size={14}/>, n:"Colar dados"},
            {k:"url", i:<Icon.Share size={14}/>, n:"Importar de URL"},
            {k:"sample", i:<Icon.Sparkle size={14}/>, n:"Dados de exemplo"},
          ].map(t=>(
            <button key={t.k} className={tab===t.k?"on":""} onClick={()=>setTab(t.k)}
              style={{padding:"8px 14px", display:"inline-flex", alignItems:"center", gap:6, fontSize:13}}>
              {t.i} {t.n}
            </button>
          ))}
        </div>
      </div>

      {/* Main area: dropzone + format list side by side */}
      <div style={{display:"grid", gridTemplateColumns: "1.2fr 1fr", gap: 20}}>
        {/* Left: input area */}
        <div className="rv card" style={{padding: 0, overflow:"hidden", display:"flex", flexDirection:"column"}}>
          {tab === "file" && (
            <div
              role="button" tabIndex={step?-1:0}
              onKeyDown={e=>{ if(!step && (e.key==="Enter" || e.key===" ")){ e.preventDefault(); onPickFile(); }}}
              style={{
                flex:1, padding: 32, textAlign:"center",
                border: drag ? `2px dashed var(--brand)` : "2px dashed transparent",
                background: drag ? "var(--brand-soft)" : "transparent",
                transition:"all .2s", display:"flex", flexDirection:"column", justifyContent:"center", minHeight: 380,
                cursor: step ? "default" : "pointer", outline:"none"
              }}
              onDragOver={e=>{ if(!step){ e.preventDefault(); setDrag(true); }}}
              onDragLeave={()=>setDrag(false)}
              onDrop={step ? undefined : onDropFile}
              onClick={step ? undefined : onPickFile}
            >
              {!step && (
                <>
                  <div style={{
                    width:80, height:80, borderRadius:20, margin:"0 auto 18px",
                    background:"linear-gradient(180deg, var(--brand), var(--brand-2))",
                    color:"white", display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:"0 20px 40px -16px rgba(47,107,255,.6)",
                    animation:"float 4s ease-in-out infinite"
                  }}>
                    <Icon.Upload size={32}/>
                  </div>
                  <div style={{fontWeight:700, fontSize:18, marginBottom:6}}>Arraste seu arquivo aqui</div>
                  <div style={{fontSize:13, color:"var(--muted)", marginBottom: 20}}>ou clique para selecionar do seu computador</div>
                  <div style={{display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap"}}>
                    {[".csv",".xlsx",".json",".tsv",".parquet"].map(e=>(
                      <span key={e} className="chip mono" style={{background:"var(--line-2)"}}>{e}</span>
                    ))}
                  </div>
                  <style>{`@keyframes float{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-6px); } }`}</style>
                </>
              )}
              {step && filename && (
                <ProcessingPanel filename={filename} progress={progress} step={step}/>
              )}
            </div>
          )}
          {tab === "paste" && (
            <div style={{padding: 24, minHeight: 380, display:"flex", flexDirection:"column"}}>
              <div style={{fontWeight:700, fontSize:15, marginBottom:6}}>Cole seus dados</div>
              <div style={{fontSize:13, color:"var(--muted)", marginBottom: 12}}>CSV, TSV ou JSON. Detectamos o formato automaticamente.</div>
              <textarea
                placeholder={`data,produto,regiao,valor\n2026-07-12,Mesa Ajustável,CO,2980\n2026-07-12,Notebook Pro 14,SE,8120`}
                style={{flex:1, padding:14, border:"1px solid var(--line)", borderRadius:12, resize:"none", fontFamily:"'Geist Mono', monospace", fontSize:13, outline:"none", lineHeight:1.5, color:"var(--ink)"}}
                onFocus={e=>e.target.style.borderColor="var(--brand)"}
                onBlur={e=>e.target.style.borderColor="var(--line)"}
              />
              <button className="btn btn-primary" style={{marginTop:14, justifyContent:"center"}} onClick={()=>runProcessing({name:"colado.csv", size:12000})}>
                <Icon.Sparkle size={14}/> Analisar dados colados
              </button>
            </div>
          )}
          {tab === "url" && (
            <div style={{padding: 24, minHeight: 380, display:"flex", flexDirection:"column", gap:12}}>
              <div style={{fontWeight:700, fontSize:15}}>Importar de uma URL</div>
              <div style={{fontSize:13, color:"var(--muted)"}}>Link público de arquivo, Google Sheets ou endpoint público que retorne JSON.</div>
              <div style={{position:"relative"}}>
                <input
                  placeholder="https://exemplo.com/dados.csv"
                  style={{width:"100%", padding:"14px 16px 14px 42px", border:"1px solid var(--line)", borderRadius:12, fontSize:14, outline:"none"}}
                  onFocus={e=>e.target.style.borderColor="var(--brand)"}
                  onBlur={e=>e.target.style.borderColor="var(--line)"}
                />
                <span style={{position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--muted)"}}><Icon.Share size={16}/></span>
              </div>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                <span style={{fontSize:11, color:"var(--muted)", fontWeight:600, alignSelf:"center", marginRight:4}}>SUPORTE</span>
                {["CSV público","Google Sheets","JSON endpoint","S3 pré-assinado"].map(s=>(
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
              <div style={{flex:1}}/>
              <button className="btn btn-primary" style={{justifyContent:"center"}} onClick={()=>runProcessing({name:"dados_remotos.csv", size:50000})}>
                <Icon.Arrow size={14}/> Buscar e analisar
              </button>
            </div>
          )}
          {tab === "sample" && (
            <div style={{padding: 24, minHeight: 380, display:"flex", flexDirection:"column", gap:12}}>
              <div style={{fontWeight:700, fontSize:15}}>Quer testar sem dados próprios?</div>
              <div style={{fontSize:13, color:"var(--muted)", marginBottom:6}}>Escolha um dataset de exemplo. Você pode trocar depois.</div>
              {[
                {n:"vendas_exemplo.csv", d:"120 linhas · 10 colunas · marketplace BR", t:"E-commerce", c:"var(--brand)"},
                {n:"churn_saas.json", d:"850 registros · 14 colunas · cohort 2025", t:"SaaS", c:"var(--violet)"},
                {n:"funil_marketing.xlsx", d:"6 abas · top of funnel → MQL → SQL", t:"Marketing", c:"#0a8a4a"},
                {n:"financeiro_q3.csv", d:"312 linhas · DRE simplificado", t:"Finanças", c:"#ff7849"},
              ].map(s=>(
                <button key={s.n} className="lift" onClick={()=>runProcessing({name:s.n, size:50000})}
                  style={{display:"flex", alignItems:"center", gap:14, padding:"14px 16px", border:"1px solid var(--line)", borderRadius:12, background:"white", cursor:"pointer", textAlign:"left"}}>
                  <div style={{width:36, height:36, borderRadius:10, background: `color-mix(in oklch, ${s.c} 15%, white)`, color:s.c, display:"flex", alignItems:"center", justifyContent:"center"}}>
                    <Icon.Doc size={16}/>
                  </div>
                  <div style={{flex:1}}>
                    <div className="mono" style={{fontSize:13, fontWeight:600}}>{s.n}</div>
                    <div style={{fontSize:12, color:"var(--muted)"}}>{s.d}</div>
                  </div>
                  <span className="chip" style={{background:"var(--line-2)"}}>{s.t}</span>
                  <Icon.Arrow size={14}/>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: formats panel */}
        <div className="rv card" style={{padding: 0, overflow:"hidden", display:"flex", flexDirection:"column", background:"#fafbfe"}}>
          <div style={{padding:"18px 20px 14px", borderBottom:"1px solid var(--line)"}}>
            <div style={{fontWeight:700, fontSize:15}}>Formatos aceitos</div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>Clique para ver o formato esperado.</div>
          </div>
          <div style={{padding:14, display:"flex", flexDirection:"column", gap:8}}>
            {formats.map(f=>(
              <button key={f.k} onClick={()=>setPreview(f)}
                style={{
                  display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                  borderRadius:10, border:`1px solid ${preview.k===f.k ? "var(--brand)":"var(--line)"}`,
                  background: preview.k===f.k ? "white" : "transparent",
                  boxShadow: preview.k===f.k ? "0 6px 16px -8px rgba(47,107,255,.25)" : "none",
                  cursor:"pointer", textAlign:"left", transition:"all .2s"
                }}>
                <div style={{width:34, height:34, borderRadius:8, background:`color-mix(in oklch, ${f.c} 18%, white)`, color:f.c, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                  <Icon.Doc size={14}/>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span style={{fontWeight:700, fontSize:14}}>{f.n}</span>
                    <span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{f.ext}</span>
                    {f.pro && <span className="chip" style={{padding:"1px 6px", fontSize:10, background:"var(--ink)", color:"white"}}>Pro</span>}
                  </div>
                  <div style={{fontSize:12, color:"var(--muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{f.desc}</div>
                </div>
              </button>
            ))}
          </div>
          {/* Preview */}
          <div style={{margin:"0 14px 14px", border:"1px solid var(--line)", borderRadius:10, background:"white", overflow:"hidden"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid var(--line-2)"}}>
              <div className="mono" style={{fontSize:12, fontWeight:600, color:"var(--ink-2)"}}>{preview.n} · estrutura esperada</div>
              <div style={{display:"flex", gap:8, fontSize:11, color:"var(--muted)"}}>
                <span>{preview.max}</span>
                <span>·</span>
                <span>{preview.rows}</span>
              </div>
            </div>
            <pre className="mono" style={{margin:0, padding:"12px 14px", fontSize:11.5, lineHeight:1.55, color:"var(--ink-2)", whiteSpace:"pre-wrap", maxHeight:140, overflow:"auto"}}>
{preview.sample}
            </pre>
          </div>
        </div>
      </div>

      {/* Requirements + trust */}
      <div className="rv" style={{marginTop: 20, display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:20}}>
        <div className="card" style={{padding:22}}>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom: 14}}>
            <span style={{width:32, height:32, borderRadius:8, background:"var(--brand-soft)", color:"var(--brand-2)", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <Icon.Check size={16} stroke={2.6}/>
            </span>
            <div>
              <div style={{fontWeight:700, fontSize:15}}>Como organizar seus dados</div>
              <div style={{fontSize:12, color:"var(--muted)"}}>Quanto mais limpo o arquivo, melhor a análise.</div>
            </div>
          </div>
          <ul style={{listStyle:"none", padding:0, margin:0, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            {[
              {t:"Cabeçalho na primeira linha", d:"Use nomes claros: data, produto, valor."},
              {t:"Uma observação por linha", d:"Evite linhas mescladas ou totais no meio."},
              {t:"Datas em formato consistente", d:"ISO (2026-07-12) é o ideal."},
              {t:"Números sem separador de milhar", d:"2980 em vez de 2.980."},
            ].map(r=>(
              <li key={r.t} style={{display:"flex", gap:10, alignItems:"flex-start"}}>
                <span style={{width:18, height:18, borderRadius:5, background:"var(--brand-soft)", color:"var(--brand)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2}}>
                  <Icon.Check size={11} stroke={3}/>
                </span>
                <div>
                  <div style={{fontWeight:600, fontSize:13}}>{r.t}</div>
                  <div style={{fontSize:12, color:"var(--muted)"}}>{r.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card" style={{padding:22, background:"linear-gradient(180deg, #fafbfe, white)"}}>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:14}}>
            <span style={{width:32, height:32, borderRadius:8, background:"#e7f7ef", color:"#0a8a4a", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <Icon.Lock size={16}/>
            </span>
            <div>
              <div style={{fontWeight:700, fontSize:15}}>Privado por padrão</div>
              <div style={{fontSize:12, color:"var(--muted)"}}>Nada é enviado sem seu consentimento.</div>
            </div>
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:8, fontSize:13, color:"var(--ink-2)"}}>
            <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><Icon.Check size={14} stroke={2.6} color="#0a8a4a"/> Processamento 100% no navegador.</div>
            <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><Icon.Check size={14} stroke={2.6} color="#0a8a4a"/> Apenas metadados (nomes de colunas) vão para a IA — opcional.</div>
            <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><Icon.Check size={14} stroke={2.6} color="#0a8a4a"/> Conformidade com LGPD. Você apaga o arquivo quando quiser.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProcessingPanel({ filename, progress, step }){
  const stages = [
    { k:"reading", n:"Lendo arquivo", i:<Icon.Upload size={14}/> },
    { k:"parsing", n:"Identificando colunas e tipos", i:<Icon.Doc size={14}/> },
    { k:"analyzing", n:"IA sugerindo melhores métricas", i:<Icon.Sparkle size={14}/> },
    { k:"done", n:"Pronto", i:<Icon.Check size={14} stroke={3}/> },
  ];
  const order = ["reading","parsing","analyzing","done"];
  const curIdx = order.indexOf(step);
  return (
    <div style={{textAlign:"left", maxWidth: 420, margin:"0 auto", width:"100%"}}>
      <div style={{display:"flex", alignItems:"center", gap:14, marginBottom: 18}}>
        <div style={{
          width:48, height:48, borderRadius:12,
          background: step==="done" ? "linear-gradient(180deg, #0a8a4a, #006b3a)" : "linear-gradient(180deg, var(--brand), var(--brand-2))",
          color:"white", display:"flex", alignItems:"center", justifyContent:"center"
        }}>
          {step==="done" ? <Icon.Check size={22} stroke={3}/> : <Icon.Doc size={20}/>}
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div className="mono" style={{fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{filename.name}</div>
          <div style={{fontSize:12, color:"var(--muted)"}}>
            {filename.sizeKB} KB
            {filename.rows>0 && <> · {filename.rows.toLocaleString("pt-BR")} linhas · {filename.cols} colunas</>}
          </div>
        </div>
      </div>
      <div style={{height:8, background:"var(--line-2)", borderRadius:99, overflow:"hidden", marginBottom: 18}}>
        <div style={{width:`${progress}%`, height:"100%", background:"linear-gradient(90deg, var(--brand), var(--violet))", transition:"width .35s ease"}}/>
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:10}}>
        {stages.map((s, i)=>{
          const state = i < curIdx ? "done" : i === curIdx ? "active" : "pending";
          return (
            <div key={s.k} style={{display:"flex", alignItems:"center", gap:12, opacity: state==="pending"?0.4:1}}>
              <span style={{
                width:24, height:24, borderRadius:7,
                background: state==="done" ? "#e7f7ef" : state==="active" ? "var(--brand-soft)" : "var(--line-2)",
                color: state==="done" ? "#0a8a4a" : state==="active" ? "var(--brand)" : "var(--muted)",
                display:"inline-flex", alignItems:"center", justifyContent:"center"
              }}>
                {state==="done" ? <Icon.Check size={12} stroke={3}/> : s.i}
              </span>
              <span style={{fontSize:13, fontWeight: state==="active"?600:500, color: state==="active" ? "var(--ink)" : "var(--ink-2)"}}>{s.n}</span>
              {state==="active" && <span className="mono" style={{fontSize:11, color:"var(--muted)", marginLeft:"auto"}}>em andamento…</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromptView({ onGenerate, onBack, fileInfo }){
  const fname = fileInfo?.name || "vendas_exemplo.csv";
  const rows = fileInfo?.rows || 120;
  const cols = fileInfo?.cols || 10;

  // Detected schema
  const schema = [
    { n:"data", t:"date", ex:"2026-07-12", nulls:0 },
    { n:"produto", t:"dimension", ex:"Mesa Ajustável", nulls:0, uniq:18 },
    { n:"categoria", t:"dimension", ex:"Móveis", nulls:0, uniq:5 },
    { n:"regiao", t:"dimension", ex:"Centro-Oeste", nulls:0, uniq:5 },
    { n:"vendedor", t:"dimension", ex:"Ana P.", nulls:2, uniq:24 },
    { n:"canal", t:"dimension", ex:"Marketplace", nulls:0, uniq:4 },
    { n:"quantidade", t:"measure", ex:"3", nulls:0 },
    { n:"preco_unitario", t:"measure", ex:"R$ 1.480", nulls:0 },
    { n:"desconto_pct", t:"measure", ex:"7%", nulls:14 },
    { n:"valor_total", t:"measure", ex:"R$ 4.420", nulls:0 },
  ];
  const typeMeta = {
    date:      { c:"#7a5cff", bg:"color-mix(in oklch, #7a5cff 14%, white)", n:"data" },
    dimension: { c:"#2f6bff", bg:"var(--brand-soft)", n:"dim" },
    measure:   { c:"#0a8a4a", bg:"#e7f7ef", n:"métrica" },
  };

  // AI-suggested metrics, organized
  const groups = [
    { k:"kpi", n:"KPIs principais", i:<Icon.Sparkle size={14}/>, c:"var(--brand)",
      items: [
        { id:"k1", n:"Valor total", d:"SOMA(valor_total)", conf:98 },
        { id:"k2", n:"Ticket médio", d:"MÉDIA(valor_total)", conf:96 },
        { id:"k3", n:"Total de pedidos", d:"CONTAGEM(linhas)", conf:95 },
        { id:"k4", n:"Quantidade vendida", d:"SOMA(quantidade)", conf:90 },
      ]},
    { k:"trend", n:"Tendências no tempo", i:<Icon.Line size={14}/>, c:"#7a5cff",
      items: [
        { id:"t1", n:"Evolução diária do valor", d:"valor_total por data", conf:97 },
        { id:"t2", n:"Receita mensal", d:"SOMA(valor_total) por mês", conf:94 },
        { id:"t3", n:"Volume semanal", d:"CONTAGEM por semana", conf:88 },
      ]},
    { k:"dim", n:"Quebras por dimensão", i:<Icon.Bars size={14}/>, c:"#0a8a4a",
      items: [
        { id:"d1", n:"Vendas por região", d:"SOMA(valor_total) por regiao", conf:96 },
        { id:"d2", n:"Top produtos", d:"SOMA(valor_total) por produto · top 10", conf:95 },
        { id:"d3", n:"Mix por categoria", d:"SOMA(valor_total) por categoria · donut", conf:93 },
        { id:"d4", n:"Canais de venda", d:"SOMA(valor_total) por canal", conf:90 },
        { id:"d5", n:"Ranking de vendedores", d:"SOMA(valor_total) por vendedor", conf:84 },
      ]},
    { k:"adv", n:"Análises avançadas", i:<Icon.Bolt size={14}/>, c:"#ff7849",
      items: [
        { id:"a1", n:"Efeito do desconto", d:"correlação(desconto_pct, valor_total)", conf:81 },
        { id:"a2", n:"Outliers de pedido", d:"pedidos > p99 em valor", conf:78 },
        { id:"a3", n:"Curva ABC de produtos", d:"pareto por valor_total", conf:74, pro:true },
      ]},
  ];

  const allIds = groups.flatMap(g=>g.items.map(i=>i.id));
  const defaultPick = new Set(["k1","k2","t1","d1","d2","d3"]);
  const [picked, setPicked] = React.useState(defaultPick);
  const [val, setVal] = React.useState("Resumo geral de vendas: total, ticket médio, evolução ao longo do tempo e quebras por região, produto e canal.");

  const togglePick = (id)=>{
    setPicked(prev=>{
      const next = new Set(prev);
      if(next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const suggestions = [
    "Mostre vendas totais, receita por categoria e tendência mensal",
    "Top 10 produtos por valor e distribuição por região",
    "Análise por canal de venda e por vendedor no último trimestre",
  ];

  return (
    <div style={{maxWidth: 1100, margin:"32px auto 0", padding:"0 24px 80px"}}>
      {/* Header */}
      <div className="rv" style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20, gap:24, flexWrap:"wrap"}}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
            <span style={{width:32, height:32, borderRadius:8, background:"#e7f7ef", color:"#0a8a4a", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <Icon.Check size={16} stroke={3}/>
            </span>
            <span style={{fontWeight:700, fontSize:14}}>Arquivo carregado com sucesso</span>
          </div>
          <h1 style={{margin:"0 0 4px", fontSize:28, fontWeight:800, letterSpacing:"-.02em"}} className="mono">{fname}</h1>
          <div style={{fontSize:13, color:"var(--muted)"}}>{rows.toLocaleString("pt-BR")} linhas · {cols} colunas · análise da IA concluída em 2,4s</div>
        </div>
        <button className="btn btn-ghost" style={{padding:"8px 12px"}} onClick={onBack}><Icon.Refresh size={14}/> Trocar arquivo</button>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap: 20}}>
        {/* LEFT: metrics + prompt */}
        <div style={{display:"flex", flexDirection:"column", gap: 16}}>
          {/* AI metrics card */}
          <div className="rv card" style={{padding:24}}>
            <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom: 6}}>
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <div style={{width:36, height:36, borderRadius:10, background:"linear-gradient(135deg, var(--brand), var(--violet))", color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Sparkle size={16}/>
                </div>
                <div>
                  <div style={{fontWeight:700, fontSize:16}}>Métricas que a IA encontrou na sua base</div>
                  <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>{groups.reduce((s,g)=>s+g.items.length,0)} sugestões · marque o que quer no dashboard.</div>
                </div>
              </div>
              <div style={{display:"flex", gap:6}}>
                <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12}}
                  onClick={()=>setPicked(new Set(allIds))}>Todas</button>
                <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12}}
                  onClick={()=>setPicked(new Set())}>Nenhuma</button>
              </div>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:18, marginTop:14}}>
              {groups.map(g=>(
                <div key={g.k}>
                  <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
                    <span style={{width:24, height:24, borderRadius:7, background:`color-mix(in oklch, ${g.c} 15%, white)`, color:g.c, display:"inline-flex", alignItems:"center", justifyContent:"center"}}>{g.i}</span>
                    <span style={{fontWeight:700, fontSize:13}}>{g.n}</span>
                    <span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{g.items.filter(i=>picked.has(i.id)).length}/{g.items.length}</span>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                    {g.items.map(it=>{
                      const on = picked.has(it.id);
                      return (
                        <button key={it.id} onClick={()=>togglePick(it.id)} style={{
                          textAlign:"left", padding:"10px 12px", borderRadius:10,
                          border: `1px solid ${on ? "var(--brand)" : "var(--line)"}`,
                          background: on ? "var(--brand-soft)" : "white",
                          cursor:"pointer", display:"flex", alignItems:"flex-start", gap:10
                        }}>
                          <span style={{
                            width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1,
                            border: `1.5px solid ${on?"var(--brand)":"#c8cee0"}`,
                            background: on?"var(--brand)":"white",
                            color:"white", display:"inline-flex", alignItems:"center", justifyContent:"center"
                          }}>{on && <Icon.Check size={11} stroke={3.5}/>}</span>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{display:"flex", alignItems:"center", gap:6}}>
                              <span style={{fontWeight:600, fontSize:13}}>{it.n}</span>
                              {it.pro && <span className="chip" style={{padding:"0 6px", fontSize:9, background:"var(--ink)", color:"white"}}>Pro</span>}
                            </div>
                            <div className="mono" style={{fontSize:11, color:"var(--muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.d}</div>
                          </div>
                          <span className="mono" style={{fontSize:10, color:"var(--muted)", flexShrink:0, alignSelf:"flex-start"}}>{it.conf}%</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt card */}
          <div className="rv card" style={{padding:24}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14}}>
              <div>
                <div style={{fontWeight:700, fontSize:15}}>Refine em linguagem natural</div>
                <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>Opcional. Diga o que quer ver — a IA combina com as métricas selecionadas.</div>
              </div>
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)"}}><Icon.Sparkle size={11}/> Gemini 2.5</span>
            </div>
            <textarea
              value={val} onChange={e=>setVal(e.target.value)} rows={3}
              style={{width:"100%", padding:"14px 16px", border:"1px solid var(--line)", borderRadius:12, resize:"none", fontFamily:"inherit", fontSize:14, lineHeight:1.5, color:"var(--ink)", outline:"none"}}
              onFocus={e=>e.target.style.borderColor="var(--brand)"}
              onBlur={e=>e.target.style.borderColor="var(--line)"}
            />
            <div style={{display:"flex", flexWrap:"wrap", gap:6, marginTop:10}}>
              {suggestions.map(s=>(
                <button key={s} onClick={()=>setVal(s)} className="chip" style={{cursor:"pointer", background:"white", border:"1px solid var(--line)"}}>{s}</button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{padding:"16px", justifyContent:"center", fontSize:15}} onClick={onGenerate}>
            <Icon.Sparkle size={16}/> Gerar dashboard com {picked.size} {picked.size===1?"métrica":"métricas"}
            <Icon.Arrow size={14}/>
          </button>
        </div>

        {/* RIGHT: schema panel */}
        <div className="rv card" style={{padding:0, overflow:"hidden", display:"flex", flexDirection:"column", height: "fit-content", position:"sticky", top: 80}}>
          <div style={{padding:"18px 20px 14px", borderBottom:"1px solid var(--line)"}}>
            <div style={{fontWeight:700, fontSize:15}}>Esquema detectado</div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>Tipos inferidos automaticamente pela IA.</div>
          </div>
          <div style={{padding:"10px 14px 14px", display:"flex", flexDirection:"column"}}>
            {/* Schema legend */}
            <div style={{display:"flex", gap:10, padding:"6px 4px 12px", borderBottom:"1px dashed var(--line-2)", marginBottom:8}}>
              {Object.entries(typeMeta).map(([k,m])=>(
                <span key={k} style={{display:"inline-flex", alignItems:"center", gap:6, fontSize:11, color:"var(--muted)"}}>
                  <span style={{width:8, height:8, borderRadius:2, background:m.c}}/> {m.n}
                </span>
              ))}
              <div style={{flex:1}}/>
              <span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{schema.length} colunas</span>
            </div>
            {schema.map((c,i)=>{
              const m = typeMeta[c.t];
              return (
                <div key={c.n} style={{
                  display:"grid", gridTemplateColumns:"auto 1fr auto", gap:10, alignItems:"center",
                  padding:"8px 6px", borderTop: i===0?"none":"1px solid var(--line-2)"
                }}>
                  <span style={{
                    fontSize:9, fontWeight:700, padding:"3px 6px", borderRadius:5,
                    background: m.bg, color: m.c, letterSpacing:".06em"
                  }}>{m.n.toUpperCase()}</span>
                  <div style={{minWidth:0}}>
                    <div className="mono" style={{fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.n}</div>
                    <div style={{fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                      ex: {c.ex}{c.uniq && ` · ${c.uniq} únicos`}{c.nulls>0 && ` · ${c.nulls} nulos`}
                    </div>
                  </div>
                  <span className="icon-btn" title="Visualizar" style={{width:24, height:24, borderRadius:6}}><Icon.Eye size={11}/></span>
                </div>
              );
            })}
          </div>
          <div style={{padding:"12px 16px", borderTop:"1px solid var(--line)", background:"#fafbfe", fontSize:12, color:"var(--muted)", display:"flex", alignItems:"center", gap:8}}>
            <Icon.Sparkle size={12} color="var(--brand)"/>
            A IA detectou 1 coluna de data, 5 dimensões e 4 métricas numéricas.
          </div>
        </div>
      </div>
    </div>
  );
}

/* Mini sparklines / chart utilities for KPIs */
function KPI({ kpi, editing, onChange, onMove, onResize, onDelete, palette }){
  const { label, value, delta, deltaDir, sub, data, color, suffix } = kpi;
  const ref = React.useRef(null);
  const [vis, setVis] = React.useState(false);
  React.useEffect(()=>{
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVis(true); }, {threshold: 0.3});
    if(ref.current) io.observe(ref.current);
    return ()=> io.disconnect();
  },[]);
  const target = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g,""));
  const v = useCount(target || 0, vis);
  const display = typeof value === "number" ?
    Math.round(v).toLocaleString("pt-BR") :
    (typeof value === "string" && value.includes("R$") ? "R$ " + (v).toLocaleString("pt-BR", {maximumFractionDigits:1}) :
     v.toFixed(1) + (suffix||""));
  const set = (patch)=> onChange && onChange({...kpi, ...patch});
  return (
    <div ref={ref} className="kpi-card lift" style={{
      opacity: vis?1:0, transform: vis?"none":"translateY(16px)", transition:"all .6s cubic-bezier(.2,.7,.2,1)",
      outline: editing ? `2px dashed color-mix(in oklch, ${color} 55%, var(--line))` : "none",
      outlineOffset: editing ? 4 : 0,
    }}>
      {editing && (
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px",
          background:"var(--ink)", color:"white", borderRadius:8, marginBottom:6
        }}>
          <span style={{cursor:"grab", display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600}}>
            <Icon.More size={11}/> KPI
          </span>
          <div style={{display:"flex", gap:3}}>
            <button onClick={()=>onMove && onMove(-1)} title="Mover" style={{padding:"3px 5px", background:"rgba(255,255,255,.12)", color:"white", border:0, borderRadius:5, cursor:"pointer"}}><Icon.Caret size={9} style={{transform:"rotate(180deg)"}}/></button>
            <button onClick={()=>onMove && onMove(1)} title="Mover" style={{padding:"3px 5px", background:"rgba(255,255,255,.12)", color:"white", border:0, borderRadius:5, cursor:"pointer"}}><Icon.Caret size={9}/></button>
            {[{k:3,n:"¼"},{k:4,n:"⅓"},{k:6,n:"½"}].map(o=>(
              <button key={o.k} onClick={()=>onResize && onResize(o.k)} style={{
                padding:"3px 7px", background: kpi.span===o.k?"white":"rgba(255,255,255,.12)",
                color: kpi.span===o.k?"var(--ink)":"white", border:0, borderRadius:5, cursor:"pointer", fontSize:10, fontWeight:600
              }}>{o.n}</button>
            ))}
            <button onClick={onDelete} title="Remover" style={{padding:"3px 5px", background:"rgba(255,93,128,.18)", color:"#ff8aa0", border:0, borderRadius:5, cursor:"pointer"}}><Icon.X size={9}/></button>
          </div>
        </div>
      )}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0}}>
          <span style={{width:8, height:8, borderRadius:"50%", background: color, flexShrink:0}}/>
          {editing ? (
            <input value={label} onChange={e=>set({label:e.target.value})} style={{
              flex:1, padding:"2px 4px", border:"1px dashed var(--line)", borderRadius:5,
              fontSize:12, fontWeight:600, color:"var(--muted)", outline:"none", background:"transparent", fontFamily:"inherit"
            }}/>
          ) : (
            <span style={{fontSize:12, fontWeight:600, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{label}</span>
          )}
        </div>
        {!editing && <span className="icon-btn" style={{width:24, height:24, borderRadius:6}}><Icon.More size={12}/></span>}
      </div>
      <div style={{display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap"}}>
        {editing ? (
          <input value={value} onChange={e=>set({value:e.target.value})} style={{
            padding:"2px 6px", border:"1px dashed var(--line)", borderRadius:6,
            fontSize:24, fontWeight:800, letterSpacing:"-.02em", outline:"none", background:"transparent",
            fontFamily:"inherit", width:"min(140px, 100%)"
          }}/>
        ) : (
          <span className="ticker" style={{fontSize:28, fontWeight:800, letterSpacing:"-.02em"}}>{display}</span>
        )}
        <span className="chip mono" style={{
          background: deltaDir==="up" ? "#e7f7ef" : "#fde7ee",
          color: deltaDir==="up" ? "#0a8a4a" : "#c9234a", fontSize:11, cursor: editing?"pointer":"default"
        }} onClick={()=> editing && set({deltaDir: deltaDir==="up"?"down":"up"})}>
          {deltaDir==="up" ? "▲" : "▼"} {delta}
        </span>
      </div>
      <div style={{fontSize:12, color:"var(--muted)"}}>{sub}</div>
      {editing && (
        <div style={{display:"flex", gap:4, marginTop:4}}>
          <ColorSwatches value={color} onChange={c=>set({color:c})} options={palette}/>
        </div>
      )}
      <div className="spark"><Sparkline data={data} color={color} width={160} height={44}/></div>
    </div>
  );
}

function ChartTypeMenu({ value, onChange }){
  const [open, setOpen] = React.useState(false);
  const types = [
    { k:"bar", i:<Icon.Bars size={14}/>, n:"Barras"},
    { k:"line", i:<Icon.Line size={14}/>, n:"Linha"},
    { k:"area", i:<Icon.Chart size={14}/>, n:"Área"},
    { k:"donut", i:<Icon.Pie size={14}/>, n:"Donut"},
  ];
  const cur = types.find(t=>t.k===value) || types[0];
  return (
    <div style={{position:"relative"}}>
      <button className="icon-btn" onClick={()=>setOpen(!open)} title="Tipo de gráfico" style={{gap:6, padding:"0 8px", width:"auto"}}>
        {cur.i} <Icon.Caret size={12}/>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:10,
          background:"white", border:"1px solid var(--line)", borderRadius:10, padding:6, minWidth:140,
          boxShadow:"0 20px 40px -20px rgba(15,23,42,.25)"
        }}>
          {types.map(t=>(
            <button key={t.k} onClick={()=>{onChange(t.k); setOpen(false);}} style={{
              display:"flex", alignItems:"center", gap:8, padding:"8px 10px", border:0, background: value===t.k?"var(--brand-soft)":"transparent",
              borderRadius:6, width:"100%", textAlign:"left", cursor:"pointer", fontSize:13, color: value===t.k? "var(--brand-2)":"var(--ink-2)"
            }}>{t.i} {t.n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorSwatches({ value, onChange, options }){
  return (
    <div style={{display:"inline-flex", gap:6}}>
      {options.map(c=>(
        <button key={c} onClick={()=>onChange(c)} title={c} style={{
          width:22, height:22, borderRadius:7, border: value===c ? "2px solid var(--ink)" : "1px solid var(--line)",
          background:c, cursor:"pointer", padding:0
        }}/>
      ))}
    </div>
  );
}

function MiniSelect({ value, options, onChange, width=120 }){
  const [open, setOpen] = React.useState(false);
  const opt = options.find(o=>o.k===value) || options[0];
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{
        padding:"6px 10px", border:"1px solid var(--line)", background:"white", borderRadius:8,
        display:"inline-flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer", minWidth: width,
        justifyContent:"space-between"
      }}>
        <span className="mono" style={{color:"var(--ink-2)"}}>{opt.n}</span>
        <Icon.Caret size={11} color="var(--muted)"/>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:20,
          background:"white", border:"1px solid var(--line)", borderRadius:10, padding:4, minWidth: width+20,
          boxShadow:"0 20px 40px -20px rgba(15,23,42,.25)"
        }}>
          {options.map(o=>(
            <button key={o.k} onClick={()=>{onChange(o.k); setOpen(false);}} style={{
              display:"block", padding:"6px 10px", border:0, background: value===o.k ? "var(--brand-soft)":"transparent",
              borderRadius:6, width:"100%", textAlign:"left", cursor:"pointer", fontSize:12,
              color: value===o.k ? "var(--brand-2)":"var(--ink-2)"
            }} className="mono">{o.n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartCard({ chart, color, editing, onChange, onMove, onDelete, onResize, dims, aggs, palette }){
  const { title, sub, type="bar", dim, agg, height=240, data } = chart;
  const ref = React.useRef(null);
  const [vis, setVis] = React.useState(false);
  React.useEffect(()=>{
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVis(true); }, {threshold: 0.15});
    if(ref.current) io.observe(ref.current);
    return ()=> io.disconnect();
  },[]);
  const set = (patch)=> onChange && onChange({ ...chart, ...patch });

  return (
    <div ref={ref} className="chart-card lift" style={{
      opacity: vis?1:0, transform: vis?"none":"translateY(20px)",
      transition:"all .7s cubic-bezier(.2,.7,.2,1)",
      outline: editing ? `2px dashed color-mix(in oklch, ${color} 55%, var(--line))` : "none",
      outlineOffset: editing ? 4 : 0
    }}>
      {/* Edit toolbar */}
      {editing && (
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px",
          background:"var(--ink)", color:"white", borderRadius:10, marginBottom:6
        }}>
          <div style={{display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight:600}}>
            <span style={{cursor:"grab", display:"inline-flex"}} title="Arrastar"><Icon.More size={12}/></span>
            Editando · <span className="mono" style={{opacity:.7}}>id:{chart.id}</span>
          </div>
          <div style={{display:"flex", gap:4}}>
            <button onClick={()=>onMove && onMove(-1)} title="Mover para cima" style={{padding:"4px 6px", background:"rgba(255,255,255,.1)", color:"white", border:0, borderRadius:6, cursor:"pointer"}}><Icon.Caret size={11} style={{transform:"rotate(180deg)"}}/></button>
            <button onClick={()=>onMove && onMove(1)} title="Mover para baixo" style={{padding:"4px 6px", background:"rgba(255,255,255,.1)", color:"white", border:0, borderRadius:6, cursor:"pointer"}}><Icon.Caret size={11}/></button>
            <div style={{width:1, background:"rgba(255,255,255,.15)", margin:"0 4px"}}/>
            {[
              {k:4, n:"⅓"},{k:6, n:"½"},{k:8, n:"⅔"},{k:12, n:"full"}
            ].map(o=>(
              <button key={o.k} onClick={()=>onResize && onResize(o.k)} style={{
                padding:"4px 8px", background: chart.span===o.k ? "white" : "rgba(255,255,255,.1)",
                color: chart.span===o.k ? "var(--ink)" : "white", border:0, borderRadius:6, cursor:"pointer",
                fontSize:11, fontWeight:600
              }}>{o.n}</button>
            ))}
            <div style={{width:1, background:"rgba(255,255,255,.15)", margin:"0 4px"}}/>
            <button onClick={onDelete} title="Remover" style={{padding:"4px 6px", background:"rgba(255,93,128,.18)", color:"#ff8aa0", border:0, borderRadius:6, cursor:"pointer"}}><Icon.X size={11}/></button>
          </div>
        </div>
      )}

      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{width:8, height:8, borderRadius:"50%", background: color, flexShrink:0}}/>
            {editing ? (
              <input
                value={title}
                onChange={e=>set({title:e.target.value})}
                style={{
                  flex:1, padding:"4px 6px", margin:"-4px 0",
                  border:"1px dashed var(--line)", borderRadius:6, fontWeight:700, fontSize:15,
                  fontFamily:"inherit", color:"var(--ink)", outline:"none", background:"transparent"
                }}
                onFocus={e=>e.target.style.borderColor="var(--brand)"}
                onBlur={e=>e.target.style.borderColor="var(--line)"}
              />
            ) : (
              <span style={{fontWeight:700, fontSize:15}}>{title}</span>
            )}
          </div>
          {editing ? (
            <input
              value={sub || ""}
              onChange={e=>set({sub:e.target.value})}
              placeholder="Subtítulo / descrição curta"
              style={{
                width:"100%", padding:"3px 6px", marginTop:4,
                border:"1px dashed transparent", borderRadius:6, fontSize:12,
                fontFamily:"inherit", color:"var(--muted)", outline:"none", background:"transparent"
              }}
              onFocus={e=>e.target.style.borderColor="var(--line)"}
              onBlur={e=>e.target.style.borderColor="transparent"}
            />
          ) : (
            <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>{sub}</div>
          )}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:6, flexShrink:0}}>
          {!editing && dim && <span className="chip mono" style={{background:"var(--line-2)"}}>{dim}</span>}
          {!editing && agg && <span className="chip mono" style={{background:"var(--line-2)"}}>{agg}</span>}
          <ChartTypeMenu value={type} onChange={k=>set({type:k})}/>
          {!editing && <span className="icon-btn"><Icon.More size={14}/></span>}
        </div>
      </div>

      {/* Edit controls row */}
      {editing && (
        <div style={{
          display:"flex", flexWrap:"wrap", gap:10, padding:"10px 12px",
          background:"#fafbfe", border:"1px solid var(--line-2)", borderRadius:10, marginTop:4
        }}>
          <div style={{display:"flex", alignItems:"center", gap:6}}>
            <span className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)"}}>DIM</span>
            <MiniSelect value={dim || dims[0].k} onChange={k=>set({dim:k})} options={dims}/>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:6}}>
            <span className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)"}}>AGG</span>
            <MiniSelect value={agg || aggs[0].k} onChange={k=>set({agg:k})} options={aggs}/>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:6, marginLeft:"auto"}}>
            <span className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)"}}>COR</span>
            <ColorSwatches value={chart.color || color} onChange={c=>set({color:c})} options={palette}/>
          </div>
        </div>
      )}

      <div style={{minHeight: height, marginTop: 8}}>
        {vis && (
          type==="bar" ? <BarChart data={data} height={height} color={chart.color || color}/> :
          type==="line" ? <LineChart data={data} height={height} color={chart.color || color}/> :
          type==="area" ? <LineChart data={data} height={height} color={chart.color || color} fill={true}/> :
          <div style={{display:"flex", alignItems:"center", justifyContent:"center", height}}>
            <Donut data={data.map((d,i)=>({v:d.v, color: i===0? (chart.color||color) : ["#94b7ff","#7a5cff","#0a8a4a","#1b2240","#ff7849"][i%5]}))} size={Math.min(height-20, 200)}/>
          </div>
        )}
      </div>
    </div>
  );
}

function Insights({ tweaks, onAddChart }){
  const [tab, setTab] = React.useState("insights");

  const highlights = [
    { l:"Maior alta", v:"+R$ 142k", s:"Marketplace · CO", c:"#0a8a4a", d:"up" },
    { l:"Maior queda", v:"−23%", s:"Ticket médio", c:"#c9234a", d:"down" },
    { l:"Concentração", v:"42%", s:"Top 2 produtos", c:"var(--brand)", d:"flat" },
    { l:"Cobertura", v:"86%", s:"Linhas analisadas", c:"#7a5cff", d:"flat" },
  ];

  const tabs = {
    insights: [
      { cat:"comparison", t:"Móveis e Eletrônicos lideram", d:'"Mesa Ajustável" e "Notebook Pro 14" respondem por 42% do valor total — concentração relevante no portfólio.', tag:"Categoria", ev:"R$ 178,5k em 12 itens", conf:96 },
      { cat:"trend", t:"Centro-Oeste em ascensão", d:"Maior valor total entre regiões e crescimento de 22% vs. trimestre anterior, com forte presença no Marketplace.", tag:"Região", ev:"R$ 212k · ↑22%", conf:93 },
      { cat:"comparison", t:"Marketplace é o canal-rei", d:'Representa 38% das vendas, seguido por "Loja Física" (29%) e "Site" (24%). Parceiros vêm caindo desde mai/26.', tag:"Canal", ev:"38% do faturamento", conf:91 },
      { cat:"outlier", t:"Picos atípicos em terças", d:"Volume nas terças é 31% acima da média semanal — provavelmente puxado por campanhas no Marketplace.", tag:"Sazonalidade", ev:"+31% vs. média", conf:84 },
    ],
    risks: [
      { cat:"risk", t:"Ticket médio caiu 23%", d:"Período recente vs. anterior. Concentrar promoções em itens de maior valor pode reverter a tendência.", tag:"Receita", ev:"R$ 219 → R$ 169", conf:92, risk:true },
      { cat:"risk", t:"Desconto > 15% derruba margem", d:"Pedidos com desconto > 15% têm valor médio 27% menor, sem ganho proporcional em volume.", tag:"Pricing", ev:"−27% no AOV", conf:88, risk:true },
      { cat:"risk", t:"14 nulos em desconto_pct", d:"~12% das linhas sem valor preenchido. Pode estar enviesando a média geral.", tag:"Qualidade", ev:"14/120 linhas", conf:78, risk:true },
    ],
    recs: [
      { cat:"action", t:"Priorizar Marketplace + Centro-Oeste", d:"Combinação com maior receita e crescimento. Aumentar verba pode multiplicar ticket.", tag:"Crescimento", ev:"oportunidade R$ 90k", conf:90, addType:"bar", addTitle:"Receita: Marketplace x outros canais" },
      { cat:"action", t:"Bundle: Mesa + Cadeira Gamer", d:"Frequentemente comprados em pedidos próximos. Promover bundle pode subir ticket médio.", tag:"Cross-sell", ev:"38 ocorrências", conf:82, addType:"bar", addTitle:"Pedidos com bundle vs. simples" },
      { cat:"action", t:"Investigar quedas em Parceiros", d:"Canal vem caindo há 3 meses. Vale conversar com gestores de relacionamento.", tag:"Atenção", ev:"−18% trimestre", conf:80, addType:"line", addTitle:"Evolução do canal Parceiros" },
    ],
  };

  const catMeta = {
    comparison: { i:<Icon.Bars size={13}/>, c:"var(--brand)", n:"Comparação" },
    trend:      { i:<Icon.Line size={13}/>, c:"#0a8a4a", n:"Tendência" },
    outlier:    { i:<Icon.Bolt size={13}/>, c:"#ff7849", n:"Outlier" },
    risk:       { i:<Icon.Bolt size={13}/>, c:"#c9234a", n:"Risco" },
    action:     { i:<Icon.Sparkle size={13}/>, c:"#7a5cff", n:"Ação" },
  };

  const cur = tabs[tab];

  return (
    <div className="card soft-shadow" style={{padding:24, marginBottom: 20}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:12}}>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <div style={{width:40, height:40, borderRadius:10, background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`, display:"flex", alignItems:"center", justifyContent:"center", color:"white"}}>
            <Icon.Sparkle size={20}/>
          </div>
          <div>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <span style={{fontWeight:700, fontSize:16}}>Análises da IA</span>
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)", fontSize:11}}>Gemini 2.5</span>
              <span className="chip" style={{background:"#e7f7ef", color:"#0a8a4a", fontSize:11}}>confiança 89%</span>
            </div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>{tabs.insights.length + tabs.risks.length + tabs.recs.length} insights · gerados há 2 min</div>
          </div>
        </div>
        <div style={{display:"flex", gap:6, alignItems:"center"}}>
          <button className="btn btn-ghost" style={{padding:"6px 12px", fontSize:13}}><Icon.Share size={12}/> Copiar resumo</button>
          <button className="btn btn-ghost" style={{padding:"6px 12px", fontSize:13}}><Icon.Refresh size={12}/> Reanalisar</button>
        </div>
      </div>

      {/* Executive summary + highlight strip */}
      <div style={{display:"grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 14}}>
        <div style={{padding:"14px 16px", background:"#fafbfe", border:"1px solid var(--line-2)", borderRadius:12}}>
          <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:6}}>RESUMO EXECUTIVO</div>
          <p style={{margin:0, color:"var(--ink-2)", fontSize:14, lineHeight:1.55}}>
            Panorama saudável de vendas com forte expressão em <b>Móveis</b> e <b>Eletrônicos</b>, dominância do canal <b>Marketplace</b> e crescimento sustentado em <b>Centro-Oeste</b>. Há sinal de alerta no <b>ticket médio</b>, que recuou 23%, e dependência de poucos SKUs no topo.
          </p>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
          {highlights.map(h=>(
            <div key={h.l} style={{padding:"10px 12px", border:"1px solid var(--line)", borderRadius:10, background:"white"}}>
              <div style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".05em", textTransform:"uppercase"}}>{h.l}</div>
              <div style={{fontVariantNumeric:"tabular-nums", fontSize:18, fontWeight:800, color:h.c, marginTop:2}}>{h.v}</div>
              <div style={{fontSize:11, color:"var(--muted)"}}>{h.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex", gap:0, borderBottom:"1px solid var(--line)", marginBottom:14, overflowX:"auto"}}>
        {[
          {k:"insights", n:"Insights", c: tabs.insights.length},
          {k:"risks", n:"Riscos & Atenção", c: tabs.risks.length},
          {k:"recs", n:"Recomendações", c: tabs.recs.length},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{
            padding:"10px 16px", border:0, background:"transparent", cursor:"pointer",
            borderBottom: tab===t.k ? "2px solid var(--brand)" : "2px solid transparent",
            color: tab===t.k ? "var(--ink)" : "var(--muted)",
            fontWeight: tab===t.k ? 700 : 500, fontSize:13, marginBottom:-1,
            display:"inline-flex", alignItems:"center", gap:8
          }}>
            {t.n}
            <span className="chip mono" style={{padding:"0 6px", fontSize:10, background: tab===t.k ? "var(--brand-soft)" : "var(--line-2)", color: tab===t.k ? "var(--brand-2)" : "var(--muted)"}}>{t.c}</span>
          </button>
        ))}
      </div>

      {/* Insights grid */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10}}>
        {cur.map((it,i)=>{
          const m = catMeta[it.cat] || catMeta.comparison;
          return (
            <div key={i} style={{
              padding:"14px 16px", borderRadius:12,
              border: it.risk ? "1px solid #ffd2dd" : "1px solid var(--line)",
              background: it.risk ? "#fff7f9" : "white",
              display:"flex", gap:12, alignItems:"flex-start",
              transition:"transform .2s ease, box-shadow .2s ease"
            }}>
              <div style={{
                width:32, height:32, borderRadius:8, flexShrink:0,
                background: `color-mix(in oklch, ${m.c} 14%, white)`, color: m.c,
                display:"flex", alignItems:"center", justifyContent:"center"
              }}>{m.i}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap"}}>
                  <span style={{fontWeight:700, fontSize:14}}>{it.t}</span>
                  <span className="chip" style={{padding:"1px 8px", fontSize:10, background:"var(--line-2)"}}>{it.tag}</span>
                  <span className="chip mono" style={{padding:"1px 6px", fontSize:9, background:`color-mix(in oklch, ${m.c} 12%, white)`, color: m.c}}>{m.n}</span>
                </div>
                <div style={{fontSize:13, color:"var(--ink-2)", lineHeight:1.5, marginBottom:8}}>{it.d}</div>
                <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
                  <span style={{display:"inline-flex", alignItems:"center", gap:6, fontSize:11, color:"var(--muted)"}}>
                    <Icon.Idea size={11}/> <span className="mono">{it.ev}</span>
                  </span>
                  <span style={{display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"var(--muted)"}}>
                    <span style={{width:60, height:4, background:"var(--line-2)", borderRadius:99, overflow:"hidden"}}>
                      <span style={{display:"block", width:`${it.conf}%`, height:"100%", background:m.c}}/>
                    </span>
                    <span className="mono">{it.conf}%</span>
                  </span>
                  <div style={{flex:1}}/>
                  {it.addType && onAddChart && (
                    <button onClick={()=>onAddChart(it)} style={{
                      padding:"4px 10px", border:`1px solid ${m.c}`, color: m.c, background:"white",
                      borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
                      display:"inline-flex", alignItems:"center", gap:5
                    }}>
                      <Icon.Plus size={11}/> Adicionar ao dashboard
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard({ onClose, tweaks, fileInfo }){
  const [period, setPeriod] = React.useState("90d");
  const [editing, setEditing] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [paywallReason, setPaywallReason] = React.useState(null); // null | "edit" | "add" | "insights" | "advanced"

  const isFree = tweaks.plan !== "pro";
  const requirePro = (reason)=>{
    if(isFree){ setPaywallReason(reason); return true; }
    return false;
  };
  // Auto-close editing if downgraded to free
  React.useEffect(()=>{ if(isFree && editing) setEditing(false); }, [isFree]);

  // Period config
  const periodConfig = {
    "7d":  { days: 7,  label:"Últimos 7 dias",  rowsPct: 0.18 },
    "30d": { days: 30, label:"Últimos 30 dias", rowsPct: 0.55 },
    "90d": { days: 90, label:"Últimos 90 dias", rowsPct: 1.00 },
    "all": { days: 365,label:"Todo o período",  rowsPct: 1.00 },
  };
  const periodMeta = periodConfig[period] || periodConfig["90d"];
  const totalRows = fileInfo?.rows || 120;
  const rowsForPeriod = Math.max(8, Math.round(totalRows * periodMeta.rowsPct));

  // Drag state
  const [dragId, setDragId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null); // { id, position: 'before'|'after' }

  const dims = [
    {k:"data", n:"data"}, {k:"produto", n:"produto"}, {k:"categoria", n:"categoria"},
    {k:"regiao", n:"regiao"}, {k:"vendedor", n:"vendedor"}, {k:"canal", n:"canal"},
  ];
  const aggs = [{k:"sum", n:"Soma"}, {k:"avg", n:"Média"}, {k:"count", n:"Contagem"}, {k:"max", n:"Máx"}, {k:"min", n:"Mín"}];
  const palette = ["#2f6bff","#0a8a4a","#7a5cff","#ff7849","#ff5e93","#0b1020"];

  // Mock data — slice tendency by period (days)
  const fullTendency = Array.from({length: 90}, (_,i)=>{
    const day = i+1;
    return { l: day+"/jul", v: 12 + Math.sin(i/5)*6 + i*0.6 + (i>60? (i-60)*0.8 : 0) };
  });
  const tendency = fullTendency.slice(-Math.min(fullTendency.length, periodMeta.days));
  const categoria = [
    {l:"Mesa Ajust.", v:328},{l:"Notebook", v:276},{l:"Cad. Gamer", v:84},
    {l:"Fone BT", v:62},{l:"Mouse", v:42},{l:"Headset", v:36},
  ];
  const regiao = [{l:"CO", v:212},{l:"NE", v:192},{l:"SE", v:154},{l:"SUL", v:142},{l:"N", v:91}];
  const canal = [{v:38, l:"Marketplace"},{v:29, l:"Loja Física"},{v:24, l:"Site"},{v:9, l:"Parceiros"}];
  const rankProduto = [
    { n:"Mesa Ajustável", c:"Móveis", r:"CO", v:96400, pct:74},
    { n:"Notebook Pro 14", c:"Eletrônicos", r:"SE", v:82100, pct:62},
    { n:"Cadeira Gamer", c:"Móveis", r:"NE", v:41500, pct:31},
    { n:"Fone Bluetooth", c:"Eletrônicos", r:"SUL", v:24800, pct:19},
    { n:"Mouse Sem Fio", c:"Eletrônicos", r:"CO", v:18200, pct:14},
  ];

  // Aux mock data for advanced views
  const tendencyMensal = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul"].map((l,i)=>({l, v: 60 + i*12 + Math.sin(i)*8}));
  const vendedores = [
    {l:"Ana P.", v:142},{l:"Bruno S.", v:128},{l:"Carla L.", v:104},
    {l:"Diego R.", v:96},{l:"Eva M.", v:78},{l:"Felipe T.", v:62},
  ];
  const dowVolume = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((l,i)=>({l, v: [80,134,92,108,118,72,46][i]}));
  const cohort = Array.from({length:8}, (_,i)=>({l:`s${i+1}`, v: 100 - i*8 - Math.sin(i)*4}));

  // View presets (Dashboards avançados)
  const buildPresets = ()=>({
    overview: {
      name: "Visão geral", icon: <Icon.Grid size={13}/>,
      desc: "KPIs principais, evolução, canais e ranking de produtos.",
      blocks: [
        { id:"v0-insights", kind:"insights", span:12 },
        { id:"v0-k1", kind:"kpi", span:3, props:{ label:"Valor total", value:"R$ 791,7", delta:"14,2%", deltaDir:"up", sub:"vs período anterior", data:[420,460,440,490,520,560,590,640,700,720,760,791], color:tweaks.accent }},
        { id:"v0-k2", kind:"kpi", span:3, props:{ label:"Ticket médio", value:"R$ 6,6", delta:"3,1%", deltaDir:"down", sub:"média por transação", data:[7.0,6.9,6.8,6.5,6.4,6.6,6.5,6.7,6.6,6.6,6.4,6.6], color:"#7a5cff" }},
        { id:"v0-k3", kind:"kpi", span:3, props:{ label:"Pedidos", value:1284, delta:"9,8%", deltaDir:"up", sub:"120 únicos no período", data:[820,860,920,1020,1100,1160,1200,1250,1284], color:"#0a8a4a" }},
        { id:"v0-k4", kind:"kpi", span:3, props:{ label:"Conversão", value:4.8, suffix:"%", delta:"0,6pp", deltaDir:"up", sub:"visitantes → pedido", data:[3.8,4.0,3.9,4.2,4.3,4.5,4.6,4.7,4.8], color:"#ff7849" }},
        { id:"v0-c1", kind:"chart", span:8, props:{ title:"Evolução diária do valor total", sub:"Tendência por dia · últimos 28 dias", type:"area", dim:"data", agg:"sum", color: tweaks.accent, height: 280, data: tendency }},
        { id:"v0-c2", kind:"chart", span:4, props:{ title:"Canais de venda", sub:"Participação no valor total", type:"donut", dim:"canal", agg:"sum", color: tweaks.accent, height: 280, data: canal }},
        { id:"v0-c3", kind:"chart", span:6, props:{ title:"Vendas por categoria & produto", sub:"Top 6 produtos por valor total", type:"bar", dim:"produto", agg:"sum", color: tweaks.accent, height: 240, data: categoria }},
        { id:"v0-c4", kind:"chart", span:6, props:{ title:"Vendas por região", sub:"Comparativo entre as 5 regiões", type:"bar", dim:"regiao", agg:"sum", color: tweaks.accent, height: 240, data: regiao }},
        { id:"v0-rank", kind:"ranking", span:12, props:{ items: rankProduto }},
      ],
    },
    region: {
      name: "Por região", icon: <Icon.Bars size={13}/>,
      desc: "Comparativo geográfico — vendas, participação e crescimento por estado/região.",
      blocks: [
        { id:"v1-k1", kind:"kpi", span:3, props:{ label:"Centro-Oeste", value:"R$ 212", delta:"22%", deltaDir:"up", sub:"líder absoluto", data:[120,140,150,170,190,200,205,212], color:tweaks.accent }},
        { id:"v1-k2", kind:"kpi", span:3, props:{ label:"Nordeste", value:"R$ 192", delta:"14%", deltaDir:"up", sub:"crescimento sustentado", data:[110,120,135,150,165,178,185,192], color:"#7a5cff" }},
        { id:"v1-k3", kind:"kpi", span:3, props:{ label:"Sudeste", value:"R$ 154", delta:"4%", deltaDir:"down", sub:"queda no canal site", data:[180,175,170,168,165,160,158,154], color:"#0a8a4a" }},
        { id:"v1-k4", kind:"kpi", span:3, props:{ label:"Cobertura geográfica", value:96, suffix:"%", delta:"2pp", deltaDir:"up", sub:"5 regiões ativas", data:[80,82,86,88,90,92,94,96], color:"#ff7849" }},
        { id:"v1-c1", kind:"chart", span:8, props:{ title:"Vendas por região", sub:"Soma de valor_total por região", type:"bar", dim:"regiao", agg:"sum", color: tweaks.accent, height: 280, data: regiao }},
        { id:"v1-c2", kind:"chart", span:4, props:{ title:"Participação por região", sub:"% do valor total", type:"donut", dim:"regiao", agg:"sum", color: tweaks.accent, height: 280, data: regiao.map(r=>({v:r.v, l:r.l})) }},
        { id:"v1-c3", kind:"chart", span:12, props:{ title:"Evolução mensal por região", sub:"Centro-Oeste lidera o crescimento", type:"line", dim:"data", agg:"sum", color: tweaks.accent, height: 260, data: tendencyMensal }},
      ],
    },
    product: {
      name: "Por produto", icon: <Icon.Doc size={13}/>,
      desc: "Ranking de produtos, mix por categoria e curva ABC simulada.",
      blocks: [
        { id:"v2-k1", kind:"kpi", span:3, props:{ label:"SKUs ativos", value:18, delta:"+2", deltaDir:"up", sub:"vs trimestre anterior", data:[14,15,15,16,16,17,17,18], color:tweaks.accent }},
        { id:"v2-k2", kind:"kpi", span:3, props:{ label:"Top 1: Mesa Ajustável", value:"R$ 96,4", delta:"18%", deltaDir:"up", sub:"R$ 96,4k em vendas", data:[60,68,72,78,82,88,92,96], color:"#7a5cff" }},
        { id:"v2-k3", kind:"kpi", span:3, props:{ label:"Concentração top 2", value:42, suffix:"%", delta:"3pp", deltaDir:"up", sub:"risco de dependência", data:[36,37,38,39,40,41,42,42], color:"#ff7849" }},
        { id:"v2-k4", kind:"kpi", span:3, props:{ label:"Long tail", value:32, suffix:"%", delta:"1pp", deltaDir:"down", sub:"itens fora do top 5", data:[40,38,37,36,35,34,33,32], color:"#0a8a4a" }},
        { id:"v2-c1", kind:"chart", span:7, props:{ title:"Top produtos por valor", sub:"Soma de valor_total", type:"bar", dim:"produto", agg:"sum", color: tweaks.accent, height: 280, data: categoria }},
        { id:"v2-c2", kind:"chart", span:5, props:{ title:"Mix por categoria", sub:"Participação", type:"donut", dim:"categoria", agg:"sum", color: tweaks.accent, height: 280, data: [{l:"Móveis",v:54},{l:"Eletrônicos",v:32},{l:"Acessórios",v:14}] }},
        { id:"v2-rank", kind:"ranking", span:12, props:{ items: rankProduto }},
      ],
    },
    channel: {
      name: "Por canal", icon: <Icon.Share size={13}/>,
      desc: "Performance comparada por canal de venda.",
      blocks: [
        { id:"v3-k1", kind:"kpi", span:3, props:{ label:"Marketplace", value:"R$ 301", delta:"18%", deltaDir:"up", sub:"canal líder", data:[200,220,240,260,275,285,295,301], color:tweaks.accent }},
        { id:"v3-k2", kind:"kpi", span:3, props:{ label:"Loja Física", value:"R$ 230", delta:"6%", deltaDir:"up", sub:"recuperando", data:[180,190,200,210,215,220,225,230], color:"#0a8a4a" }},
        { id:"v3-k3", kind:"kpi", span:3, props:{ label:"Site", value:"R$ 190", delta:"3%", deltaDir:"down", sub:"queda em jun-jul", data:[210,205,200,198,196,193,191,190], color:"#7a5cff" }},
        { id:"v3-k4", kind:"kpi", span:3, props:{ label:"Parceiros", value:"R$ 70", delta:"18%", deltaDir:"down", sub:"em atenção", data:[100,95,90,85,82,78,74,70], color:"#c9234a" }},
        { id:"v3-c1", kind:"chart", span:6, props:{ title:"Participação por canal", sub:"% do valor total", type:"donut", dim:"canal", agg:"sum", color: tweaks.accent, height: 260, data: canal }},
        { id:"v3-c2", kind:"chart", span:6, props:{ title:"Evolução por canal", sub:"Linha mensal", type:"line", dim:"data", agg:"sum", color: tweaks.accent, height: 260, data: tendencyMensal }},
        { id:"v3-c3", kind:"chart", span:12, props:{ title:"Volume por dia da semana", sub:"Soma de quantidade", type:"bar", dim:"data", agg:"sum", color: tweaks.accent, height: 240, data: dowVolume }},
      ],
    },
    advanced: {
      name: "Avançado", icon: <Icon.Sparkle size={13}/>, badge: "Pro",
      desc: "Cohorts, sazonalidade, vendedores e detecção de outliers.",
      blocks: [
        { id:"v4-k1", kind:"kpi", span:3, props:{ label:"Retenção média", value:62, suffix:"%", delta:"4pp", deltaDir:"up", sub:"cohort 8 semanas", data:[100,92,84,78,72,68,65,62], color:tweaks.accent }},
        { id:"v4-k2", kind:"kpi", span:3, props:{ label:"Anomalias detectadas", value:7, delta:"2", deltaDir:"up", sub:"pedidos > p99", data:[1,2,2,3,4,5,6,7], color:"#c9234a" }},
        { id:"v4-k3", kind:"kpi", span:3, props:{ label:"Correlação desconto×ticket", value:-0.48, delta:"0,1", deltaDir:"down", sub:"associação inversa", data:[-0.2,-0.3,-0.35,-0.4,-0.42,-0.45,-0.47,-0.48], color:"#7a5cff" }},
        { id:"v4-k4", kind:"kpi", span:3, props:{ label:"Pico semanal", value:"Terça", delta:"31%", deltaDir:"up", sub:"acima da média", data:[80,134,92,108,118,72,46], color:"#ff7849" }},
        { id:"v4-c1", kind:"chart", span:8, props:{ title:"Cohort: retenção semanal", sub:"% que voltou a comprar nas semanas seguintes", type:"line", dim:"data", agg:"avg", color: tweaks.accent, height: 280, data: cohort }},
        { id:"v4-c2", kind:"chart", span:4, props:{ title:"Vendas por dia da semana", sub:"Detecção de sazonalidade", type:"bar", dim:"data", agg:"sum", color: "#ff7849", height: 280, data: dowVolume }},
        { id:"v4-c3", kind:"chart", span:7, props:{ title:"Top vendedores", sub:"Soma por vendedor", type:"bar", dim:"vendedor", agg:"sum", color: tweaks.accent, height: 260, data: vendedores }},
        { id:"v4-c4", kind:"chart", span:5, props:{ title:"Mix por categoria", sub:"Donut", type:"donut", dim:"categoria", agg:"sum", color: "#7a5cff", height: 260, data: [{l:"Móveis",v:54},{l:"Eletrônicos",v:32},{l:"Acessórios",v:14}] }},
        { id:"v4-insights", kind:"insights", span:12 },
      ],
    },
  });
  const presets = React.useMemo(buildPresets, [tweaks.accent]);
  const [viewKey, setViewKey] = React.useState("overview");

  // Initial blocks — unified layout
  const initialBlocks = React.useMemo(()=> presets.overview.blocks.concat([{ id:"b-cta", kind:"cta", span:12 }]), [presets]);

  const [blocks, setBlocks] = React.useState(initialBlocks);

  const switchView = (key)=>{
    const preset = presets[key];
    if(preset?.badge === "Pro" && isFree){
      setPaywallReason("advanced");
      return;
    }
    setViewKey(key);
    if(preset){
      setBlocks([...preset.blocks, { id:"b-cta", kind:"cta", span:12 }]);
      setTimeout(()=> window.scrollTo({top: 200, behavior: "smooth"}), 30);
    }
  };

  const updateBlock = (id, patch)=> setBlocks(bs => bs.map(b => b.id===id ? {...b, props: {...b.props, ...patch}} : b));
  const resizeBlock = (id, span)=> setBlocks(bs => bs.map(b => b.id===id ? {...b, span} : b));
  const deleteBlock = (id)=> setBlocks(bs => bs.filter(b => b.id!==id));
  const moveBlock = (id, dir)=> setBlocks(bs => {
    const i = bs.findIndex(b => b.id===id);
    if(i<0) return bs;
    const j = i+dir;
    if(j<0 || j>=bs.length) return bs;
    const next = [...bs]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const reorderBlock = (sourceId, targetId, position)=> setBlocks(bs => {
    if(sourceId === targetId) return bs;
    const src = bs.find(b=>b.id===sourceId);
    const without = bs.filter(b=>b.id!==sourceId);
    const tIdx = without.findIndex(b=>b.id===targetId);
    if(tIdx<0) return bs;
    const insertAt = position==="after" ? tIdx+1 : tIdx;
    const next = [...without];
    next.splice(insertAt, 0, src);
    return next;
  });

  const addBlock = (type)=>{
    const id = "b-"+Date.now();
    if(type === "kpi"){
      const sparks = [820,860,920,1020,1100,1160,1200,1250];
      setBlocks(bs => [...bs, { id, kind:"kpi", span:3, props:{ label:"Novo KPI", value:"R$ 100k", delta:"5,0%", deltaDir:"up", sub:"vs período anterior", data:sparks, color: palette[bs.filter(b=>b.kind==="kpi").length % palette.length] }}]);
    } else if(type === "ranking"){
      setBlocks(bs => [...bs, { id, kind:"ranking", span:12, props:{ items: rankProduto } }]);
    } else if(type === "insights"){
      setBlocks(bs => [...bs, { id, kind:"insights", span:12 }]);
    } else {
      // chart variants
      const variantData = { bar: categoria, line: tendency, area: tendency, donut: canal };
      setBlocks(bs => [...bs, { id, kind:"chart", span:6, props:{
        title:"Novo gráfico", sub:"Configure as métricas", type, dim:"produto", agg:"sum",
        color: tweaks.accent, height:240, data: variantData[type] || categoria
      } }]);
    }
    setPickerOpen(false);
    setEditing(true);
    setTimeout(()=>{
      const el = document.querySelector(`[data-block-id="${id}"]`);
      el?.scrollIntoView && el.scrollIntoView({behavior:"smooth", block:"center"});
    }, 100);
  };

  const addChartFromInsight = (it)=> {
    const id = "b-"+Date.now();
    setBlocks(bs => [...bs, { id, kind:"chart", span:6, props:{
      title: it.addTitle || it.t,
      sub: "Sugerido pela IA · " + (it.tag || "Novo"),
      type: it.addType || "bar",
      dim: dims[1].k, agg: "sum",
      color: tweaks.accent, height: 240,
      data: categoria,
    }}]);
    setTimeout(()=>{
      const el = document.querySelector(`[data-block-id="${id}"]`);
      el?.scrollIntoView && el.scrollIntoView({behavior:"smooth", block:"center"});
    }, 100);
  };

  // Drag handlers
  const onDragStart = (e, id)=>{
    if(!editing) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Ghost
    if(e.dataTransfer.setDragImage){
      const node = e.currentTarget;
      e.dataTransfer.setDragImage(node, 20, 20);
    }
  };
  const onDragOverItem = (e, id)=>{
    if(!editing || !dragId || dragId===id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width/2;
    const position = e.clientX < midX ? "before" : "after";
    setDragOver({id, position});
  };
  const onDropItem = (e, id)=>{
    if(!editing || !dragId) return;
    e.preventDefault();
    const position = dragOver?.position || "after";
    reorderBlock(dragId, id, position);
    setDragId(null); setDragOver(null);
  };
  const onDragEnd = ()=>{ setDragId(null); setDragOver(null); };

  const renderBlock = (b)=>{
    if(b.kind === "kpi"){
      return <KPI kpi={{...b.props, span: b.span}} editing={editing}
        onChange={(p)=>updateBlock(b.id, p)} onMove={(d)=>moveBlock(b.id,d)}
        onResize={(s)=>resizeBlock(b.id, s)} onDelete={()=>deleteBlock(b.id)} palette={palette}/>;
    }
    if(b.kind === "chart"){
      const c = {id:b.id, ...b.props, span: b.span};
      return <ChartCard chart={c} color={c.color || tweaks.accent} editing={editing}
        dims={dims} aggs={aggs} palette={palette}
        onChange={(patch)=>updateBlock(b.id, patch)} onMove={(d)=>moveBlock(b.id,d)}
        onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)}/>;
    }
    if(b.kind === "insights"){
      const content = (
        <BlockShell editing={editing} kind="Análises da IA" onMove={(d)=>moveBlock(b.id,d)} onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)} span={b.span} resizeOptions={[6,8,12]}>
          <Insights tweaks={tweaks} onAddChart={addChartFromInsight}/>
        </BlockShell>
      );
      if(isFree){
        return (
          <div className="paywall-blur">
            <div className="pw-content">{content}</div>
            <div className="pw-overlay">
              <div className="pw-card">
                <div style={{width:48, height:48, margin:"0 auto 12px", borderRadius:12, background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`, color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Sparkle size={22}/>
                </div>
                <div style={{fontWeight:800, fontSize:18, letterSpacing:"-.01em", marginBottom:6}}>Análises da IA</div>
                <div style={{fontSize:13, color:"var(--muted)", lineHeight:1.5, marginBottom:16}}>
                  Resumo executivo, insights, riscos e recomendações geradas pela IA estão disponíveis apenas no plano Pro.
                </div>
                <div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap"}}>
                  <button className="btn btn-primary" onClick={()=>setPaywallReason("insights")}><Icon.Crown size={14}/> Experimentar Pro</button>
                  <button className="btn btn-ghost" onClick={()=>setPaywallReason("insights")}>Saber mais</button>
                </div>
                <div style={{display:"flex", justifyContent:"center", gap:14, marginTop:14, paddingTop:14, borderTop:"1px dashed var(--line-2)"}}>
                  <span style={{display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"var(--muted)"}}>
                    <Icon.Check size={11} stroke={3} color="#0a8a4a"/> Resumo executivo
                  </span>
                  <span style={{display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"var(--muted)"}}>
                    <Icon.Check size={11} stroke={3} color="#0a8a4a"/> Riscos & recomendações
                  </span>
                  <span style={{display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"var(--muted)"}}>
                    <Icon.Check size={11} stroke={3} color="#0a8a4a"/> Reanálise sob demanda
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      }
      return content;
    }
    if(b.kind === "ranking"){
      return <BlockShell editing={editing} kind="Ranking / Tabela" onMove={(d)=>moveBlock(b.id,d)} onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)} span={b.span} resizeOptions={[6,8,12]}>
        <RankingTable items={b.props.items} accent={tweaks.accent}/>
      </BlockShell>;
    }
    if(b.kind === "cta"){
      return <BlockShell editing={editing} kind="Banner / CTA" onMove={(d)=>moveBlock(b.id,d)} onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)} span={b.span} resizeOptions={[6,8,12]}>
        <div style={{padding:"18px 22px", borderRadius:16, background:"linear-gradient(90deg, #f5f8ff, white)", border:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:24, flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:14}}>
            <div style={{width:40, height:40, borderRadius:10, background:"var(--ink)", color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <Icon.Crown size={18}/>
            </div>
            <div>
              <div style={{fontWeight:700, fontSize:15}}>Compartilhe em domínio próprio e agende exportações</div>
              <div style={{fontSize:13, color:"var(--muted)"}}>Ative o Pro · 7 dias grátis</div>
            </div>
          </div>
          <button className="btn btn-primary">Experimentar Pro <Icon.Arrow size={14}/></button>
        </div>
      </BlockShell>;
    }
    return null;
  };

  // For export modal we filter chart blocks
  const chartsForExport = blocks.filter(b=>b.kind==="chart").map(b=>({id:b.id, ...b.props, span:b.span}));
  const kpisForExport = blocks.filter(b=>b.kind==="kpi").map(b=>b.props);

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <Topbar onClose={onClose} tweaks={tweaks} fileInfo={fileInfo}/>
      <div style={{maxWidth: 1480, margin: "0 auto", padding: "28px 24px 120px"}}>
        {/* Header */}
        <div className="rv" style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom: 22, gap:24, flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)"}}><Icon.Sparkle size={11}/> Gerado por IA</span>
              <span className="chip" style={{background:"#e7f7ef", color:"#0a8a4a"}}><span style={{width:6, height:6, borderRadius:"50%", background:"#0a8a4a"}}/> Atualizado</span>
              {editing && <span className="chip" style={{background:"var(--ink)", color:"white"}}><Icon.Bolt size={11}/> Modo edição</span>}
            </div>
            <h1 style={{margin:"0 0 4px", fontSize:34, fontWeight:800, letterSpacing:"-.02em"}}>Visão geral de vendas</h1>
            <div style={{fontSize:13, color:"var(--muted)"}}>{fileInfo?.name || "vendas_exemplo.csv"} · {periodMeta.label} · {rowsForPeriod.toLocaleString("pt-BR")} de {totalRows.toLocaleString("pt-BR")} linhas</div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
            <div className="seg">
              {[["7d","7d"],["30d","30d"],["90d","90d"],["all","Tudo"]].map(([k,n])=>(
                <button key={k} className={period===k?"on":""} onClick={()=>setPeriod(k)}>{n}</button>
              ))}
            </div>
            <button className="btn btn-ghost" style={{padding:"8px 12px"}}><Icon.Refresh size={14}/> Atualizar</button>
          </div>
        </div>

        {/* View presets — Dashboards avançados */}
        <div className="rv" style={{
          display:"flex", alignItems:"center", gap:8, marginBottom: 18,
          padding:"6px", background:"white", border:"1px solid var(--line)",
          borderRadius: 14, overflowX:"auto"
        }}>
          {Object.entries(presets).map(([key, p])=>{
            const on = viewKey===key;
            const locked = p.badge === "Pro" && isFree;
            return (
              <button key={key} onClick={()=>switchView(key)} style={{
                padding:"8px 14px", border:0, borderRadius:10, cursor:"pointer", flexShrink:0,
                background: on ? "var(--ink)" : "transparent",
                color: on ? "white" : (locked ? "var(--muted)" : "var(--ink-2)"),
                fontSize:13, fontWeight:600,
                display:"inline-flex", alignItems:"center", gap:8,
                transition:"all .2s ease"
              }}>
                <span style={{
                  width:22, height:22, borderRadius:6,
                  background: on ? "rgba(255,255,255,.12)" : "var(--line-2)",
                  color: on ? "white" : "var(--muted)",
                  display:"inline-flex", alignItems:"center", justifyContent:"center"
                }}>{locked ? <Icon.Lock size={11}/> : p.icon}</span>
                {p.name}
                {p.badge && (
                  <span className="chip" style={{padding:"1px 6px", fontSize:9, background: on?"var(--brand)":"var(--ink)", color:"white"}}>{p.badge}</span>
                )}
              </button>
            );
          })}
          <div style={{flex:1}}/>
          <button onClick={()=>{
            const id = "custom-"+Date.now();
            // For simplicity, just clones overview but resets to blank
            setViewKey("custom");
            setBlocks([{ id:"b-cta", kind:"cta", span:12 }]);
          }} style={{
            padding:"8px 12px", border:"1px dashed var(--line)", borderRadius:10, background:"transparent",
            color:"var(--muted)", fontSize:12, cursor:"pointer", flexShrink:0,
            display:"inline-flex", alignItems:"center", gap:6
          }}>
            <Icon.Plus size={12}/> Nova visão em branco
          </button>
        </div>

        {/* View description */}
        {presets[viewKey] && (
          <div className="rv" style={{
            display:"flex", alignItems:"center", gap:10, marginBottom: 16,
            fontSize: 13, color:"var(--muted)"
          }}>
            <Icon.Idea size={13} color="var(--brand)"/>
            <span>{presets[viewKey].desc}</span>
          </div>
        )}

        {editing && (
          <div style={{
            padding:"12px 16px", background:"linear-gradient(90deg, var(--brand-soft), white)",
            border:"1px solid var(--brand)", borderRadius:12, marginBottom: 16,
            display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10
          }}>
            <div style={{display:"flex", alignItems:"center", gap:10, fontSize:13, color:"var(--ink-2)"}}>
              <Icon.Wand size={14} color="var(--brand)"/>
              <span><b>Modo edição:</b> arraste qualquer bloco para reposicionar. Edite textos, tipos, dimensões, cores. Use ⅓/½/⅔/full para o tamanho.</span>
            </div>
            <div style={{display:"flex", gap:8}}>
              <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12}} onClick={()=>setBlocks(initialBlocks)}>Redefinir</button>
              <button className="btn btn-primary" style={{padding:"6px 12px", fontSize:12}} onClick={()=>setEditing(false)}><Icon.Check size={12}/> Salvar</button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:14}}>
          {blocks.map((b, idx)=>{
            const isDragging = dragId === b.id;
            const showBefore = dragOver?.id === b.id && dragOver.position === "before" && dragId !== b.id;
            const showAfter  = dragOver?.id === b.id && dragOver.position === "after"  && dragId !== b.id;
            return (
              <div key={b.id} data-block-id={b.id}
                className={"block-wrap rv"}
                style={{
                  gridColumn: `span ${b.span}`,
                  opacity: isDragging ? 0.3 : undefined,
                  cursor: editing ? "grab" : "default",
                  transitionDelay: (idx*0.04) + "s"
                }}
                draggable={editing}
                onDragStart={(e)=>onDragStart(e, b.id)}
                onDragOver={(e)=>onDragOverItem(e, b.id)}
                onDrop={(e)=>onDropItem(e, b.id)}
                onDragEnd={onDragEnd}
              >
                {showBefore && <DropIndicator side="left"/>}
                {showAfter  && <DropIndicator side="right"/>}
                {!editing && (
                  <BlockMenu
                    onEdit={()=>{ if(requirePro("edit")) return; setEditing(true); setTimeout(()=>{ document.querySelector(`[data-block-id="${b.id}"]`)?.scrollIntoView({behavior:"smooth", block:"center"}); }, 60); }}
                    onDuplicate={()=>{
                      if(requirePro("edit")) return;
                      const id = "b-"+Date.now();
                      setBlocks(bs=>{
                        const i = bs.findIndex(x=>x.id===b.id);
                        const next = [...bs];
                        next.splice(i+1, 0, { ...b, id });
                        return next;
                      });
                    }}
                    onDelete={()=>{ if(requirePro("edit")) return; deleteBlock(b.id); }}
                  />
                )}
                {renderBlock(b)}
              </div>
            );
          })}
          {editing && (
            <button onClick={()=>setPickerOpen(true)} style={{
              gridColumn:"span 6", minHeight: 140, border:"2px dashed var(--line)",
              borderRadius: 18, background:"white", color:"var(--muted)", cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
              fontSize: 14, fontWeight: 600
            }}>
              <span style={{width:36, height:36, borderRadius:10, background:"var(--brand-soft)", color:"var(--brand)", display:"flex", alignItems:"center", justifyContent:"center"}}>
                <Icon.Plus size={18}/>
              </span>
              Adicionar bloco
            </button>
          )}
        </div>
      </div>

      {/* Floating action toolbar */}
      <div className="fab-bar" style={{transform: `translateX(-50%) translateY(${exportOpen ? 80 : 0}px)`}}>
        <button className={editing ? "active" : ""} onClick={()=>{ if(requirePro("edit")) return; setEditing(!editing); }} title={isFree ? "Editar (requer Pro)" : "Editar layout (E)"}>
          {isFree ? <><Icon.Lock size={14}/> Editar</> : (editing ? <><Icon.Check size={14}/> Concluir</> : <><Icon.Wand size={14}/> Editar</>)}
        </button>
        <div style={{position:"relative"}}>
          <button onClick={()=>{ if(requirePro("add")) return; setPickerOpen(!pickerOpen); }} title={isFree ? "Adicionar (requer Pro)" : "Adicionar (A)"} className={pickerOpen?"active":""}>
            {isFree ? <><Icon.Lock size={14}/> Adicionar</> : <><Icon.Plus size={14}/> Adicionar</>}
          </button>
          {pickerOpen && !isFree && (
            <AddPicker onPick={addBlock} onClose={()=>setPickerOpen(false)} accent={tweaks.accent} placement="above-center"/>
          )}
        </div>
        <div className="div"/>
        <button onClick={()=>setExportOpen(true)} className="primary" title="Exportar (X)">
          <Icon.Download size={14}/> Exportar
        </button>
      </div>

      {exportOpen && <ExportModal onClose={()=>setExportOpen(false)} blocks={blocks} tweaks={tweaks} fileInfo={fileInfo}/>}
      {paywallReason && <PaywallModal reason={paywallReason} onClose={()=>setPaywallReason(null)} tweaks={tweaks}/>}
    </div>
  );
}

function PaywallModal({ reason, onClose, tweaks }){
  React.useEffect(()=>{
    const onKey = e=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return ()=>{ window.removeEventListener("keydown", onKey); document.body.style.overflow=""; };
  }, []);
  const meta = {
    edit:     { t:"Editar o layout requer Pro", d:"Reorganizar blocos, redimensionar, mudar tipos, dimensões e cores são recursos do plano Pro." },
    add:      { t:"Adicionar blocos requer Pro", d:"Criar novos KPIs, gráficos, ranking e blocos de insights é exclusivo do Pro." },
    insights: { t:"Análises da IA são exclusivas do Pro", d:"Resumo executivo, insights, detecção de riscos e recomendações ficam disponíveis no Pro." },
    advanced: { t:"Dashboards avançados são Pro", d:"Cohort, sazonalidade, vendedores e detecção de outliers fazem parte do plano Pro." },
  }[reason] || { t:"Recurso Pro", d:"Este recurso requer o plano Pro." };

  const features = [
    { i:<Icon.Wand size={14}/>, n:"Edição completa do layout", d:"drag-and-drop, tamanhos, ordem" },
    { i:<Icon.Plus size={14}/>, n:"KPIs e gráficos ilimitados", d:"barras, linha, área, donut, tabela" },
    { i:<Icon.Sparkle size={14}/>, n:"Análises da IA", d:"resumo + insights + recomendações" },
    { i:<Icon.Download size={14}/>, n:"Exportação avançada", d:"PDF/PNG com layout customizado" },
    { i:<Icon.Share size={14}/>, n:"Compartilhamento por link", d:"domínio próprio e embed" },
    { i:<Icon.Refresh size={14}/>, n:"Reanálise sob demanda", d:"refilme a IA quando quiser" },
  ];

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:120, background:"rgba(11,16,32,.55)",
      backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center",
      padding:24, animation:"fade .2s ease"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"min(560px, 100%)", maxHeight:"90vh", overflow:"auto",
        background:"white", borderRadius:18,
        boxShadow:"0 40px 80px -20px rgba(11,16,32,.5)",
        animation:"pop .3s cubic-bezier(.2,.7,.2,1)"
      }}>
        <div style={{
          padding:"32px 32px 24px",
          background: `linear-gradient(135deg, ${tweaks.accent}, var(--violet))`,
          color:"white", position:"relative"
        }}>
          <button onClick={onClose} style={{
            position:"absolute", top:14, right:14, width:30, height:30, borderRadius:8,
            background:"rgba(255,255,255,.18)", color:"white", border:0, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center"
          }}><Icon.X size={14}/></button>
          <div style={{display:"inline-flex", alignItems:"center", gap:8, padding:"4px 10px", borderRadius:999, background:"rgba(255,255,255,.18)", marginBottom:14, fontSize:11, fontWeight:600}}>
            <Icon.Crown size={11}/> Plano Pro
          </div>
          <h2 style={{margin:"0 0 8px", fontSize:24, fontWeight:800, letterSpacing:"-.02em"}}>{meta.t}</h2>
          <p style={{margin:0, fontSize:14, opacity:.9, lineHeight:1.5, maxWidth:420}}>{meta.d}</p>
        </div>
        <div style={{padding:28}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18}}>
            {features.map(f=>(
              <div key={f.n} style={{display:"flex", gap:10, alignItems:"flex-start"}}>
                <span style={{
                  width:28, height:28, borderRadius:7, flexShrink:0,
                  background:`color-mix(in oklch, ${tweaks.accent} 14%, white)`, color:tweaks.accent,
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>{f.i}</span>
                <div>
                  <div style={{fontWeight:600, fontSize:13}}>{f.n}</div>
                  <div style={{fontSize:11, color:"var(--muted)"}}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", padding:"14px 16px", background:"#fafbfe", border:"1px solid var(--line-2)", borderRadius:12, marginBottom:18}}>
            <div>
              <div style={{fontSize:11, color:"var(--muted)", letterSpacing:".06em", textTransform:"uppercase", fontWeight:600}}>Pro</div>
              <div style={{display:"flex", alignItems:"baseline", gap:4, marginTop:2}}>
                <span style={{fontSize:28, fontWeight:800, color:"var(--brand)", letterSpacing:"-.02em"}}>R$ 29</span>
                <span style={{fontSize:13, color:"var(--muted)"}}>/mês</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11, color:"#0a8a4a", fontWeight:700}}>7 dias grátis</div>
              <div style={{fontSize:11, color:"var(--muted)"}}>Cancele a qualquer momento</div>
            </div>
          </div>
          <div style={{display:"flex", gap:8}}>
            <button className="btn btn-primary" style={{flex:1, justifyContent:"center", padding:"14px"}}>
              <Icon.Crown size={14}/> Começar teste grátis
            </button>
            <button className="btn btn-ghost" style={{padding:"14px 16px"}} onClick={onClose}>Agora não</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropIndicator({ side }){
  return (
    <div style={{
      position:"absolute", top:-4, bottom:-4,
      [side==="left"?"left":"right"]: -8, width: 4, borderRadius: 99,
      background:"var(--brand)", boxShadow:"0 0 0 4px rgba(47,107,255,.2)",
      zIndex: 5, pointerEvents:"none",
      animation:"pulse 1s ease-in-out infinite"
    }}>
      <style>{`@keyframes pulse{ 50%{ opacity: .6; } }`}</style>
    </div>
  );
}

function BlockShell({ editing, kind, onMove, onResize, onDelete, span, resizeOptions=[4,6,8,12], children }){
  const sizeMap = { 3:"¼", 4:"⅓", 6:"½", 8:"⅔", 12:"full" };
  return (
    <div>
      {editing && (
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px",
          background:"var(--ink)", color:"white", borderRadius:10, marginBottom:6
        }}>
          <div style={{display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight:600}}>
            <span style={{cursor:"grab"}}><Icon.More size={12}/></span>
            {kind}
          </div>
          <div style={{display:"flex", gap:4}}>
            <button onClick={()=>onMove && onMove(-1)} title="Mover" style={{padding:"3px 6px", background:"rgba(255,255,255,.12)", color:"white", border:0, borderRadius:5, cursor:"pointer"}}><Icon.Caret size={11} style={{transform:"rotate(180deg)"}}/></button>
            <button onClick={()=>onMove && onMove(1)} title="Mover" style={{padding:"3px 6px", background:"rgba(255,255,255,.12)", color:"white", border:0, borderRadius:5, cursor:"pointer"}}><Icon.Caret size={11}/></button>
            <div style={{width:1, background:"rgba(255,255,255,.15)", margin:"0 4px"}}/>
            {resizeOptions.map(k=>(
              <button key={k} onClick={()=>onResize && onResize(k)} style={{
                padding:"3px 7px", background: span===k ? "white" : "rgba(255,255,255,.1)",
                color: span===k ? "var(--ink)" : "white", border:0, borderRadius:5, cursor:"pointer",
                fontSize:11, fontWeight:600
              }}>{sizeMap[k]||k}</button>
            ))}
            <div style={{width:1, background:"rgba(255,255,255,.15)", margin:"0 4px"}}/>
            <button onClick={onDelete} title="Remover" style={{padding:"3px 6px", background:"rgba(255,93,128,.18)", color:"#ff8aa0", border:0, borderRadius:5, cursor:"pointer"}}><Icon.X size={11}/></button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function BlockMenu({ onEdit, onDuplicate, onDelete }){
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(()=>{
    if(!open) return;
    const onDoc = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    setTimeout(()=> document.addEventListener("click", onDoc), 0);
    return ()=> document.removeEventListener("click", onDoc);
  }, [open]);
  return (
    <div ref={ref}>
      <button
        className={"block-menu-btn" + (open ? " open" : "")}
        onClick={(e)=>{ e.stopPropagation(); setOpen(!open); }}
        title="Opções"
      >
        <Icon.More size={14}/>
      </button>
      {open && (
        <div className="block-menu" onClick={(e)=>e.stopPropagation()}>
          <button onClick={()=>{ setOpen(false); onEdit(); }}>
            <Icon.Wand size={14}/> Editar
          </button>
          {onDuplicate && (
            <button onClick={()=>{ setOpen(false); onDuplicate(); }}>
              <Icon.Plus size={14}/> Duplicar
            </button>
          )}
          <hr/>
          <button className="danger" onClick={()=>{ setOpen(false); onDelete(); }}>
            <Icon.X size={14}/> Apagar
          </button>
        </div>
      )}
    </div>
  );
}

function AddPicker({ onPick, onClose, accent, placement="top-right" }){
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const onDoc = (e)=>{ if(ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(()=> document.addEventListener("click", onDoc), 0);
    return ()=> document.removeEventListener("click", onDoc);
  }, []);
  const items = [
    { k:"kpi", n:"KPI", d:"Métrica única com sparkline e delta", c:"#0a8a4a", i:<Icon.Spark size={16}/> },
    { k:"bar", n:"Gráfico de barras", d:"Comparar categorias", c:accent, i:<Icon.Bars size={16}/> },
    { k:"line", n:"Gráfico de linha", d:"Tendência ao longo do tempo", c:"#7a5cff", i:<Icon.Line size={16}/> },
    { k:"area", n:"Gráfico de área", d:"Volume e tendência", c:"#ff7849", i:<Icon.Chart size={16}/> },
    { k:"donut", n:"Donut", d:"Participação / distribuição", c:"#ff5e93", i:<Icon.Pie size={16}/> },
    { k:"ranking", n:"Ranking", d:"Tabela com barra de distribuição", c:"#1b2240", i:<Icon.Rows size={16}/> },
    { k:"insights", n:"Bloco de Insights da IA", d:"Resumo, tendências, riscos, ações", c:"#7a5cff", i:<Icon.Sparkle size={16}/> },
  ];
  const posStyle = placement === "above-center" ? {
    position:"absolute", bottom:"calc(100% + 12px)", left:"50%", transform:"translateX(-50%)"
  } : {
    position:"absolute", top:"calc(100% + 8px)", right:0
  };
  return (
    <div ref={ref} style={{
      ...posStyle, zIndex:50,
      background:"white", border:"1px solid var(--line)", borderRadius:14, padding:10, width: 360,
      boxShadow:"0 30px 60px -20px rgba(15,23,42,.3)",
      animation:"pickerIn .2s ease"
    }}>
      <style>{`@keyframes pickerIn{ from{ opacity:0; transform: ${placement==="above-center"?"translateX(-50%) translateY(8px)":"translateY(-8px)"}; } }`}</style>
      <div style={{padding:"6px 10px 10px", borderBottom:"1px solid var(--line-2)", marginBottom:6}}>
        <div style={{fontWeight:700, fontSize:14, color:"var(--ink)"}}>Adicionar ao dashboard</div>
        <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>Escolha o tipo de bloco.</div>
      </div>
      {items.map(it=>(
        <button key={it.k} onClick={()=>onPick(it.k)} style={{
          width:"100%", display:"flex", alignItems:"center", gap:12, padding:"10px 10px",
          border:0, background:"transparent", borderRadius:8, cursor:"pointer", textAlign:"left", color:"var(--ink)"
        }}
          onMouseEnter={e=>e.currentTarget.style.background="var(--line-2)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
        >
          <span style={{
            width:34, height:34, borderRadius:8, flexShrink:0,
            background:`color-mix(in oklch, ${it.c} 14%, white)`, color: it.c,
            display:"flex", alignItems:"center", justifyContent:"center"
          }}>{it.i}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13}}>{it.n}</div>
            <div style={{fontSize:12, color:"var(--muted)"}}>{it.d}</div>
          </div>
          <Icon.Plus size={14} color="var(--muted)"/>
        </button>
      ))}
    </div>
  );
}

function ExportModal({ onClose, blocks, tweaks, fileInfo }){
  const [format, setFormat] = React.useState("pdf"); // pdf, png
  const [paper, setPaper] = React.useState("a4"); // a4, letter, wide
  const [orient, setOrient] = React.useState("portrait");
  const [opts, setOpts] = React.useState({ summary:true, filters:true, branding:true });

  // Filter blocks for the preview
  const visibleBlocks = blocks.filter(b => b.kind !== "cta");
  const charts = blocks.filter(b => b.kind === "chart");
  const kpis = blocks.filter(b => b.kind === "kpi");

  const paperSizes = {
    a4: { p:[2480, 3508], n:"A4" },
    letter: { p:[2550, 3300], n:"Carta" },
    wide: { p:[2880, 1620], n:"Apresentação 16:9" },
  };
  const sz = paperSizes[paper].p;
  const [pw, ph] = orient==="portrait" ? sz : [sz[1], sz[0]];
  const ratio = pw/ph;

  // Preview page dimensions
  const previewW = paper === "wide" ? 720 : (orient==="portrait" ? 500 : 700);
  const previewH = previewW / ratio;
  const pad = paper === "wide" ? 22 : 18;
  const contentW = previewW - pad*2;

  React.useEffect(()=>{
    const onKey = e=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return ()=>{ window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, []);

  const togOpt = (k)=> setOpts(o=>({...o, [k]:!o[k]}));

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(11,16,32,.5)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
      animation:"fade .2s ease"
    }}>
      <style>{`@keyframes fade{ from{ opacity:0 } } @keyframes pop{ from{ opacity:0; transform: translateY(8px) scale(.98); } }`}</style>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"min(1240px, 100%)", maxHeight:"94vh", background:"white", borderRadius:18,
        boxShadow:"0 40px 80px -20px rgba(11,16,32,.5)",
        display:"grid", gridTemplateColumns:"320px 1fr", overflow:"hidden",
        animation:"pop .3s cubic-bezier(.2,.7,.2,1)"
      }}>
        {/* Sidebar */}
        <div style={{padding:24, borderRight:"1px solid var(--line)", background:"#fafbfe", display:"flex", flexDirection:"column", gap:20, overflowY:"auto"}}>
          <div>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <h2 style={{margin:0, fontSize:18, fontWeight:800, letterSpacing:"-.01em"}}>Exportar</h2>
              <button onClick={onClose} className="icon-btn" style={{width:28, height:28}}><Icon.X size={14}/></button>
            </div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>Veja a prévia antes de baixar.</div>
          </div>

          <div>
            <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>FORMATO</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              {[
                {k:"pdf", n:"PDF", d:"Multi-página, texto selecionável"},
                {k:"png", n:"PNG", d:"Imagem única em alta resolução"},
              ].map(o=>(
                <button key={o.k} onClick={()=>setFormat(o.k)} style={{
                  padding:"12px 12px", borderRadius:10, textAlign:"left", cursor:"pointer",
                  border: format===o.k ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                  background: format===o.k ? "var(--brand-soft)" : "white"
                }}>
                  <div style={{fontWeight:700, fontSize:13, color: format===o.k ? "var(--brand-2)" : "var(--ink)"}}>{o.n}</div>
                  <div style={{fontSize:11, color:"var(--muted)", marginTop:2}}>{o.d}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>TAMANHO</div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {[
                {k:"a4", n:"A4", d:"210 × 297 mm"},
                {k:"letter", n:"Carta US", d:"216 × 279 mm"},
                {k:"wide", n:"Apresentação", d:"16:9 widescreen"},
              ].map(o=>(
                <label key={o.k} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, cursor:"pointer",
                  background: paper===o.k ? "white" : "transparent", border: paper===o.k ? "1px solid var(--brand)" : "1px solid transparent"
                }}>
                  <input type="radio" name="paper" checked={paper===o.k} onChange={()=>setPaper(o.k)} style={{accentColor:"var(--brand)"}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600, fontSize:13}}>{o.n}</div>
                    <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>{o.d}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {paper !== "wide" && (
            <div>
              <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>ORIENTAÇÃO</div>
              <div className="seg" style={{padding:3, background:"var(--line-2)"}}>
                <button onClick={()=>setOrient("portrait")} className={orient==="portrait"?"on":""}>Retrato</button>
                <button onClick={()=>setOrient("landscape")} className={orient==="landscape"?"on":""}>Paisagem</button>
              </div>
            </div>
          )}

          <div>
            <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:8}}>INCLUIR</div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {[
                ["summary","Capa com resumo executivo"],
                ["filters","Filtros aplicados"],
                ["branding","Marca do Dash no rodapé"],
              ].map(([k,n])=>(
                <label key={k} style={{display:"flex", alignItems:"center", gap:10, padding:"6px 4px", cursor:"pointer"}}>
                  <input type="checkbox" checked={opts[k]} onChange={()=>togOpt(k)} style={{accentColor:"var(--brand)"}}/>
                  <span style={{fontSize:13}}>{n}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{marginTop:"auto", paddingTop:16, borderTop:"1px solid var(--line)"}}>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--muted)", marginBottom:4}}>
              <span>Resolução final</span>
              <span className="mono">{pw} × {ph} px</span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--muted)", marginBottom:8}}>
              <span>Blocos</span>
              <span className="mono">{kpis.length} KPI · {charts.length} gráficos</span>
            </div>
            <button className="btn btn-primary" style={{width:"100%", justifyContent:"center", padding:"12px"}}>
              <Icon.Download size={14}/> Baixar {format.toUpperCase()}
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{width:"100%", justifyContent:"center", marginTop:8, padding:"10px"}}>Cancelar</button>
          </div>
        </div>

        {/* Preview */}
        <div style={{padding:28, overflowY:"auto", background:"#eef0f7", display:"flex", flexDirection:"column", alignItems:"center", gap:14}}>
          <div style={{display:"flex", justifyContent:"space-between", width:"100%", alignItems:"center", maxWidth: previewW}}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <span className="chip" style={{background:"white", border:"1px solid var(--line)"}}><Icon.Eye size={11}/> Pré-visualização fiel</span>
              <span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{paperSizes[paper].n} · {orient==="portrait"?"retrato":"paisagem"}</span>
            </div>
          </div>
          <div style={{
            background:"white", boxShadow:"0 30px 60px -30px rgba(11,16,32,.4)",
            width: previewW, height: previewH, padding: pad, overflow:"hidden",
            display:"flex", flexDirection:"column", gap: 8,
          }}>
            {/* Header */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", paddingBottom:8, borderBottom:"1px solid var(--line-2)"}}>
              <div>
                <div style={{fontSize:8, color:"var(--muted)", letterSpacing:".08em", fontWeight:600}} className="mono">VISÃO GERAL DE VENDAS</div>
                <div style={{fontWeight:800, fontSize:14, letterSpacing:"-.01em"}}>{fileInfo?.name || "vendas_exemplo.csv"}</div>
              </div>
              <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2}}>
                {opts.branding && <Icon.Logo size={18}/>}
                <span className="mono" style={{fontSize:8, color:"var(--muted)"}}>20/mai/2026 · {(fileInfo?.rows||120).toLocaleString("pt-BR")} linhas</span>
              </div>
            </div>

            {opts.filters && (
              <div style={{display:"flex", gap:4, fontSize:8.5, alignItems:"center", flexWrap:"wrap"}}>
                <span className="mono" style={{color:"var(--muted)", fontWeight:600}}>FILTROS:</span>
                <span style={{padding:"1px 6px", background:"var(--brand-soft)", color:"var(--brand-2)", borderRadius:99}}>regiao: CO, NE</span>
                <span style={{padding:"1px 6px", background:"var(--brand-soft)", color:"var(--brand-2)", borderRadius:99}}>canal: Marketplace</span>
                <span style={{color:"var(--muted)", marginLeft:"auto"}} className="mono">72/120 linhas</span>
              </div>
            )}

            {opts.summary && (
              <div style={{padding:"6px 8px", background:"#fafbfe", border:"1px solid var(--line-2)", borderRadius:6}}>
                <div className="mono" style={{fontSize:7, fontWeight:700, color:"var(--muted)", marginBottom:2}}>RESUMO EXECUTIVO</div>
                <div style={{fontSize:8.5, lineHeight:1.45, color:"var(--ink-2)"}}>Panorama saudável com forte expressão em Móveis e Eletrônicos, dominância do canal Marketplace e crescimento no Centro-Oeste. Alerta no ticket médio (−23%).</div>
              </div>
            )}

            {/* Block grid — mirrors the dashboard */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:5, flex:1, minHeight:0, overflow:"hidden"}}>
              {visibleBlocks.map(b => (
                <div key={b.id} style={{gridColumn:`span ${Math.min(12, b.span)}`, minHeight: 0}}>
                  <MiniBlock block={b} accent={tweaks.accent} contentW={contentW}/>
                </div>
              ))}
            </div>

            {opts.branding && (
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:5, borderTop:"1px solid var(--line-2)", fontSize:7.5, color:"var(--muted)", flexShrink:0}}>
                <span>Gerado com {tweaks.brandName} · IA Gemini 2.5</span>
                <span className="mono">página 1/1</span>
              </div>
            )}
          </div>
          <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>
            Os blocos seguem a mesma ordem e proporção do dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniBlock({ block, accent, contentW }){
  if(block.kind === "kpi"){
    const k = block.props;
    return (
      <div style={{
        padding:"5px 7px", border:"1px solid var(--line)", borderRadius:5, background:"white",
        height:"100%", display:"flex", flexDirection:"column", justifyContent:"space-between", overflow:"hidden"
      }}>
        <div style={{display:"flex", alignItems:"center", gap:3}}>
          <span style={{width:5, height:5, borderRadius:"50%", background:k.color, flexShrink:0}}/>
          <span style={{fontSize:7, color:"var(--muted)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{k.label}</span>
        </div>
        <div style={{display:"flex", alignItems:"baseline", gap:3, flexWrap:"nowrap"}}>
          <span style={{fontWeight:800, fontSize:13, color:"var(--ink)", letterSpacing:"-.02em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{k.value}{k.suffix || ""}</span>
          <span style={{fontSize:7, fontWeight:700, color: k.deltaDir==="up"?"#0a8a4a":"#c9234a", flexShrink:0}}>{k.deltaDir==="up"?"▲":"▼"} {k.delta}</span>
        </div>
        <div style={{fontSize:6.5, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{k.sub}</div>
        <div style={{marginTop:2}}>
          <Sparkline data={k.data} color={k.color} width={Math.max(80, Math.round(contentW*(block.span/12)))} height={18} fill={true}/>
        </div>
      </div>
    );
  }
  if(block.kind === "chart"){
    const c = block.props;
    const cardW = Math.round(contentW * (block.span/12));
    const chartH = block.span >= 8 ? 70 : block.span >= 6 ? 64 : 56;
    return (
      <div style={{
        padding:"5px 7px", border:"1px solid var(--line)", borderRadius:5, background:"white",
        height:"100%", display:"flex", flexDirection:"column", gap:3, overflow:"hidden"
      }}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <span style={{width:5, height:5, borderRadius:"50%", background:c.color || accent, flexShrink:0}}/>
          <div style={{fontSize:8, fontWeight:700, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1}}>{c.title}</div>
          <span style={{fontSize:7, color:"var(--muted)", fontFamily:"'Geist Mono', monospace", flexShrink:0}}>{c.dim}</span>
        </div>
        <div style={{fontSize:7, color:"var(--muted)", marginBottom:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.sub}</div>
        <div style={{flex:1, minHeight: chartH}}>
          <MiniChart chart={c} color={c.color || accent} width={cardW-14} height={chartH}/>
        </div>
      </div>
    );
  }
  if(block.kind === "insights"){
    return (
      <div style={{
        padding:"6px 8px", background:"linear-gradient(135deg, var(--brand-soft), white)",
        border:"1px solid var(--brand-soft)", borderRadius:5, height:"100%", overflow:"hidden",
        display:"flex", flexDirection:"column", gap:3
      }}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <Icon.Sparkle size={9} color="var(--brand)"/>
          <span className="mono" style={{fontSize:7.5, fontWeight:700, color:"var(--brand-2)"}}>ANÁLISES DA IA</span>
          <span className="chip" style={{padding:"0 4px", fontSize:6.5, background:"#e7f7ef", color:"#0a8a4a"}}>89%</span>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, flex:1, minHeight:0}}>
          {[
            {t:"Móveis e Eletrônicos lideram", d:"42% do valor total"},
            {t:"Centro-Oeste em alta", d:"R$ 212k · ↑22%"},
            {t:"Marketplace dominante", d:"38% das vendas"},
            {t:"Ticket caiu 23%", d:"alerta de receita", risk:true},
          ].map((it,i)=>(
            <div key={i} style={{
              padding:"4px 6px", borderRadius:4, background: it.risk?"#fff7f9":"white",
              border:`1px solid ${it.risk?"#ffd2dd":"var(--line-2)"}`, minHeight: 0
            }}>
              <div style={{fontSize:7.5, fontWeight:700, color: it.risk?"#c9234a":"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.t}</div>
              <div style={{fontSize:7, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.d}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if(block.kind === "ranking"){
    const items = (block.props?.items || []).slice(0,5);
    return (
      <div style={{
        padding:"6px 8px", border:"1px solid var(--line)", borderRadius:5, background:"white",
        height:"100%", overflow:"hidden", display:"flex", flexDirection:"column", gap:3
      }}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <span style={{width:5, height:5, borderRadius:"50%", background:accent}}/>
          <span style={{fontSize:8, fontWeight:700}}>Top produtos</span>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:2, flex:1}}>
          {items.map((p,i)=>(
            <div key={i} style={{display:"grid", gridTemplateColumns:"12px 1.6fr 1fr 60px", gap:5, alignItems:"center", fontSize:7}}>
              <span className="mono" style={{color:"var(--muted)"}}>{String(i+1).padStart(2,"0")}</span>
              <span style={{fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.n}</span>
              <div style={{position:"relative", height:4, background:"var(--line-2)", borderRadius:99, overflow:"hidden"}}>
                <div style={{width:p.pct+"%", height:"100%", background:`linear-gradient(90deg, ${accent}, var(--violet))`}}/>
              </div>
              <span style={{textAlign:"right", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>R$ {(p.v/1000).toFixed(1)}k</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function MiniChart({ chart, color, width, height }){
  const { type, data } = chart;
  if(type==="line" || type==="area"){
    return <LineChart data={data} width={width||200} height={height} color={color} fill={type==="area"} showAxis={false} animate={false}/>;
  }
  if(type==="donut"){
    return (
      <div style={{display:"flex", alignItems:"center", justifyContent:"center", height:"100%", gap:6}}>
        <Donut data={data.map((d,i)=>({v:d.v, color: i===0? color : ["#94b7ff","#7a5cff","#0a8a4a","#1b2240","#ff7849"][i%5]}))} size={Math.min(height-4, 48)} thickness={6} animDelay={999}/>
        <div style={{display:"flex", flexDirection:"column", gap:1, fontSize:6.5}}>
          {data.slice(0,3).map((d,i)=>(
            <div key={i} style={{display:"flex", alignItems:"center", gap:3}}>
              <span style={{width:4, height:4, borderRadius:"50%", background: i===0? color : ["#94b7ff","#7a5cff","#0a8a4a"][i%3]}}/>
              <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth: 60}}>{d.l}</span>
              <span className="mono" style={{color:"var(--muted)", marginLeft:"auto"}}>{d.v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <MiniBars data={data} color={color} width={width||200} height={height}/>;
}

function MiniBars({ data, color, width, height }){
  const pad = { l: 2, r: 2, t: 2, b: 10 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const max = Math.max(...data.map(d=>d.v));
  const barW = W / data.length * 0.7;
  const gap = W / data.length * 0.3;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((d,i)=>{
        const h = (d.v/max)*H;
        const x = pad.l + i*(barW+gap) + gap/2;
        const y = pad.t + H - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="1.5" fill={color}/>
            <text x={x+barW/2} y={height-2} fontSize="5.5" textAnchor="middle" fill="#8c93a6">{String(d.l).slice(0,5)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function RankingTable({ items, accent }){
  const ref = React.useRef(null);
  const [vis, setVis] = React.useState(false);
  React.useEffect(()=>{
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVis(true); }, {threshold: 0.2});
    if(ref.current) io.observe(ref.current);
    return ()=> io.disconnect();
  },[]);
  return (
    <div ref={ref} className="chart-card lift" style={{
      opacity: vis?1:0, transform: vis?"none":"translateY(20px)", transition:"all .7s cubic-bezier(.2,.7,.2,1)"
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{width:8, height:8, borderRadius:"50%", background:accent}}/>
            <span style={{fontWeight:700, fontSize:15}}>Top produtos</span>
          </div>
          <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>Os 5 itens com maior valor total no período</div>
        </div>
        <div style={{display:"flex", gap:6}}>
          <span className="chip mono" style={{background:"var(--line-2)"}}>valor_total</span>
          <span className="chip mono" style={{background:"var(--line-2)"}}>Soma</span>
          <span className="icon-btn"><Icon.Download size={14}/></span>
          <span className="icon-btn"><Icon.More size={14}/></span>
        </div>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"36px 2.4fr 1fr .6fr 1.4fr 1fr", gap:12, alignItems:"center", marginTop:6}}>
        {["#","Produto","Categoria","Região","Distribuição","Valor"].map((h,i)=>(
          <div key={h} className="mono" style={{fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", textAlign: i>=5? "right":"left"}}>{h}</div>
        ))}
      </div>
      <div style={{display:"flex", flexDirection:"column"}}>
        {items.map((p, i)=>(
          <div key={p.n} style={{
            display:"grid", gridTemplateColumns:"36px 2.4fr 1fr .6fr 1.4fr 1fr", gap:12, alignItems:"center",
            padding:"12px 0", borderTop:"1px solid var(--line-2)",
            opacity: vis?1:0, transform: vis?"none":"translateX(10px)",
            transition:`all .5s ${i*0.08}s cubic-bezier(.2,.7,.2,1)`
          }}>
            <div className="mono" style={{fontSize:13, color:"var(--muted)"}}>{String(i+1).padStart(2,"0")}</div>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <div style={{width:32, height:32, borderRadius:8, background:`linear-gradient(135deg, ${accent}, var(--violet))`, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700}}>{p.n.split(" ").map(x=>x[0]).slice(0,2).join("")}</div>
              <div>
                <div style={{fontWeight:600, fontSize:14}}>{p.n}</div>
                <div className="mono" style={{fontSize:11, color:"var(--muted)"}}>SKU-{1000+i*23}</div>
              </div>
            </div>
            <div style={{fontSize:13}}>{p.c}</div>
            <div className="mono" style={{fontSize:12, color:"var(--muted)"}}>{p.r}</div>
            <div style={{position:"relative", height:8, background:"var(--line-2)", borderRadius:99, overflow:"hidden"}}>
              <div style={{
                width: vis ? p.pct+"%" : "0%", height:"100%",
                background: `linear-gradient(90deg, ${accent}, var(--violet))`,
                transition:`width 1s ${0.3 + i*0.1}s cubic-bezier(.2,.7,.2,1)`
              }}/>
            </div>
            <div style={{textAlign:"right", fontWeight:700, fontVariantNumeric:"tabular-nums"}}>R$ {(p.v/1000).toFixed(1)}k</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, UploadView, PromptView });
