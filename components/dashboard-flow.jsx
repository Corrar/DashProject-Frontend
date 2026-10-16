/* Fluxo de geração do dashboard: Enviar dados → Escolher métricas → Dashboard.
 *
 * UploadView lê o arquivo no navegador (CSV/TSV/JSON/Excel) e entrega
 * { name, rows, cols, schema, data, profiles }. PromptView mostra o esquema e
 * as métricas sugeridas; a seleção e o foco da IA seguem para o Dashboard via
 * onGenerate({ metrics, focus }). Os parsers vivem em dashboard.jsx.
 */

// Indicador de etapas no topo das telas do fluxo.
function FlowSteps({ step }){
  const steps = ["Enviar dados", "Escolher métricas", "Dashboard pronto"];
  return (
    <ol className="flow-steps" aria-label="Etapas">
      {steps.map((n, i)=>{
        const k = i + 1;
        const state = k < step ? "done" : k === step ? "on" : "";
        return (
          <li key={n} className={state} aria-current={k === step ? "step" : undefined}>
            <span className="flow-dot">{k < step ? <Icon.Check size={12} stroke={3}/> : k}</span>
            <span className="flow-label">{n}</span>
          </li>
        );
      })}
    </ol>
  );
}

function UploadView({ onUploaded, maxRows, children }){
  const [drag, setDrag] = React.useState(false);
  const [tab, setTab] = React.useState("file"); // file, paste, url, sample

  const formats = [
    {
      k:"csv", ext:".csv", n:"CSV", c:"#0a8a4a",
      desc:"Valores separados por vírgula ou ponto e vírgula.",
      sample: `data,produto,regiao,valor
2026-07-12,Mesa Ajustável,CO,2980
2026-07-12,Notebook Pro 14,SE,8120`,
    },
    {
      k:"xlsx", ext:".xlsx · .xls", n:"Excel", c:"#1b6f3b",
      desc:"Lemos a primeira aba e detectamos o cabeçalho.",
      sample: `[ Planilha1 ]
| data       | produto         | regiao | valor |
| 2026-07-12 | Mesa Ajustável  | CO     | 2980  |`,
    },
    {
      k:"json", ext:".json · .ndjson", n:"JSON", c:"#7a5cff",
      desc:"Array de objetos ou um objeto por linha.",
      sample: `[
  { "data":"2026-07-12", "produto":"Mesa", "valor":2980 },
  { "data":"2026-07-12", "produto":"Notebook", "valor":8120 }
]`,
    },
    {
      k:"tsv", ext:".tsv · .txt", n:"TSV", c:"#ff7849",
      desc:"Separado por tabulação, como exports brutos.",
      sample: `data\tproduto\tvalor
2026-07-12\tMesa\t2980`,
    },
  ];

  const [preview, setPreview] = React.useState(formats[0]);
  const [filename, setFilename] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [step, setStep] = React.useState(""); // "" | reading | parsing | analyzing | done
  const [pasteText, setPasteText] = React.useState("");
  const [parseError, setParseError] = React.useState(null);
  const fileInputRef = React.useRef(null);

  // Parse a CSV/TSV text payload and forward the full dataset (header + typed
  // rows + schema) via onUploaded. The progress markers below are cosmetic —
  // the parse itself is synchronous for the file sizes we accept here, but the
  // user sees a 4-step pipeline (reading → parsing → analyzing → done) so we
  // sequence setStep with short timers to keep that affordance.
  const runProcessing = (file)=>{
    const name = file?.name || "dados.csv";
    const sizeKB = file?.size ? Math.round(file.size/1024) : Math.round((file?.text?.length || 0)/1024) || 1;
    setParseError(null);
    setFilename({ name, sizeKB, rows: 0, cols: 0 });
    setStep("reading");
    setProgress(10);

    const ext = String(name).toLowerCase().split(".").pop();
    const fail = (msg)=>{ setParseError(msg); setStep(""); };

    // Cauda compartilhada: recebe { header, rows } e roda o MESMO pipeline de
    // schema/dados/profiles para todo formato (CSV, Excel, JSON). É o corpo
    // original do ingest() a partir do dashInferSchema — os fixes de coluna/
    // período/número vivem aqui embaixo e seguem intactos.
    const ingestParsed = (header, rows)=>{
      if(!header.length || !rows.length){
        fail("Não consegui detectar cabeçalho ou linhas no arquivo.");
        return;
      }
      // Limite de linhas do plano (limits.maxRows do /me; anônimo = Free).
      if(maxRows && rows.length > maxRows){
        fail(<>Esta base tem {rows.length.toLocaleString("pt-BR")} linhas e o seu plano permite até {maxRows.toLocaleString("pt-BR")} por base.{" "}
          <a onClick={()=> window.__dashUpgrade?.()} style={{color:"var(--brand)", fontWeight:700, cursor:"pointer", textDecoration:"underline"}}>Ver planos</a></>);
        return;
      }
      const schema = dashInferSchema(header, rows);
      setProgress(70); setStep("analyzing");
      setTimeout(()=>{
        const data = dashRowsToObjects(header, rows, schema);
        // Profile on the RAW rows — currency/percent symbols still intact here.
        const profiles = window.dashProfileColumns ? window.dashProfileColumns(header, rows) : [];
        setProgress(100); setStep("done");
        setFilename(prev => ({...prev, rows: data.length, cols: header.length}));
        setTimeout(()=> onUploaded && onUploaded({
          name, sizeKB,
          rows: data.length,
          cols: header.length,
          schema, data, profiles,
          // Amostra do próprio app: não vira "dashboard salvo".
          ...(file && file.isDemo ? { isDemo: true } : {}),
        }), 400);
      }, 400);
    };

    // Porta CSV/TSV/TXT — caminho ORIGINAL: dashParseCSV → cauda compartilhada.
    const ingestText = (text)=>{
      setProgress(35); setStep("parsing");
      setTimeout(()=>{
        try { const p = dashParseCSV(text); ingestParsed(p.header, p.rows); }
        catch(e){ fail("Erro ao processar o arquivo: " + (e && e.message ? e.message : "formato inesperado")); }
      }, 400);
    };

    // Porta JSON/NDJSON — deriva { header, rows } e cai na cauda compartilhada.
    const ingestJSON = (text)=>{
      setProgress(35); setStep("parsing");
      setTimeout(()=>{
        try { const p = dashJsonToParsed(text, ext === "ndjson"); ingestParsed(p.header, p.rows); }
        catch(e){ fail("Não consegui ler o JSON: " + (e && e.message ? e.message : "formato inválido")); }
      }, 400);
    };

    // ── Dispatch por EXTENSÃO (MIME do xlsx é inconsistente entre SO) ───────
    if(ext === "xlsx" || ext === "xls"){
      if(!(file instanceof Blob)){ fail("Envie o arquivo Excel (a prévia em texto não se aplica)."); return; }
      setStep("parsing"); setProgress(25);
      dashEnsureXLSX().then(XLSX=>{
        const reader = new FileReader();
        reader.onload = (e)=>{
          let p;
          try { p = dashXlsxToParsed(e.target?.result, XLSX); }
          catch(err){ fail("Não consegui ler o Excel (arquivo corrompido ou protegido por senha?)" + (err && err.message ? " — " + err.message : "")); return; }
          setProgress(35);
          setTimeout(()=> ingestParsed(p.header, p.rows), 400);
        };
        reader.onerror = ()=> fail("Não foi possível ler o arquivo.");
        reader.readAsArrayBuffer(file);
      }).catch(()=> fail("Suporte a Excel indisponível agora. Verifique a conexão e tente de novo."));
      return;
    }

    if(ext === "json" || ext === "ndjson"){
      if(file && typeof file.text === "string"){ ingestJSON(file.text); }
      else if(file instanceof Blob){
        const reader = new FileReader();
        reader.onload = (e)=> ingestJSON(dashDecodeText(e.target?.result));
        reader.onerror = ()=> fail("Não foi possível ler o arquivo.");
        reader.readAsArrayBuffer(file);
      } else { fail("Fonte sem dados anexados."); }
      return;
    }

    // Binários conhecidos que NÃO suportamos → erro claro (não lixo "PK").
    const UNSUPPORTED = ["parquet","pdf","zip","rar","7z","png","jpg","jpeg","gif","xlsb","db","sqlite"];
    if(file instanceof Blob && UNSUPPORTED.indexOf(ext) >= 0){
      fail("Formato ." + ext + " não suportado. Use CSV, TSV, JSON ou Excel (.xlsx).");
      return;
    }

    // DEFAULT — CSV/TSV/TXT (e payloads de texto: colar/sample/URL). INALTERADO.
    if(file && typeof file.text === "string"){
      ingestText(file.text);
    } else if(file instanceof Blob){
      const reader = new FileReader();
      reader.onload = (e)=> ingestText(dashDecodeText(e.target?.result));
      reader.onerror = ()=>{ fail("Não foi possível ler o arquivo."); };
      reader.readAsArrayBuffer(file);
    } else {
      // URL tab still calls this without a real payload — bail out cleanly.
      fail("Fonte sem dados anexados.");
    }
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


  const tabs = [
    {k:"file", i:<Icon.Upload size={14}/>, n:"Arquivo"},
    {k:"paste", i:<Icon.Doc size={14}/>, n:"Colar dados"},
    {k:"sample", i:<Icon.Sparkle size={14}/>, n:"Exemplo"},
    {k:"url", i:<Icon.Share size={14}/>, n:"URL"},
  ];
  const sampleRows = (()=>{ try { return dashParseCSV(DASH_SAMPLE_CSV).rows.length; } catch(e){ return null; } })();
  const samples = [
    {n:"vendas_exemplo.csv", d:(sampleRows ? sampleRows + " linhas" : "Vendas") + " · 10 colunas · data, produto, canal, região, receita", t:"CSV", c:"var(--brand)", text: DASH_SAMPLE_CSV},
    {n:"vendas_exemplo.json", d:"Os mesmos dados em JSON (array de objetos)", t:"JSON", c:"var(--violet)", text: DASH_SAMPLE_JSON},
  ];

  return (
    <div className="flow-wrap">
      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt,.json,.ndjson,.xlsx,.xls" style={{display:"none"}} onChange={onFileChosen}/>
      <FlowSteps step={1}/>
      <div style={{textAlign:"center", margin:"8px 0 28px"}}>
        <h1 className="rv flow-title">Envie seus dados e a IA monta o <span style={{color:"var(--brand)"}}>dashboard</span>.</h1>
        <p className="rv lede" style={{margin:"0 auto", maxWidth: 560, fontSize:16}}>Em segundos você tem KPIs, gráficos e um ranking prontos para explorar. O arquivo é lido no seu navegador.</p>
      </div>

      {children}

      {parseError && (
        <div role="alert" style={{
          marginBottom: 14, padding:"12px 16px", borderRadius:12,
          background:"#fff7f9", border:"1px solid #ffd2dd", color:"#c9234a",
          display:"flex", alignItems:"center", gap:10, fontSize:13
        }}>
          <Icon.Bolt size={14}/> <span>{parseError}</span>
        </div>
      )}
      <div className="flow-grid" style={{display:"grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)", gap: 18, alignItems:"start"}}>
        {/* Esquerda: fonte dos dados */}
        <div className="rv card soft-shadow" style={{padding: 0, overflow:"hidden"}}>
          <div style={{padding:"14px 16px", borderBottom:"1px solid var(--line-2)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
            <div className="seg" role="tablist" aria-label="Fonte dos dados" style={{padding:4, borderRadius:11}}>
              {tabs.map(t=>(
                <button key={t.k} role="tab" aria-selected={tab===t.k} className={tab===t.k?"on":""} disabled={!!step}
                  onClick={()=>setTab(t.k)} style={{padding:"7px 12px", display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600}}>
                  {t.i} {t.n}
                </button>
              ))}
            </div>
          </div>

          {tab === "file" && (
            <div style={{padding:16}}>
              <div
                className={"dropzone" + (drag ? " drag" : "") + (step ? " busy" : "")}
                role="button" tabIndex={step?-1:0} aria-label="Selecionar arquivo de dados"
                onKeyDown={e=>{ if(!step && (e.key==="Enter" || e.key===" ")){ e.preventDefault(); onPickFile(); }}}
                onDragOver={e=>{ if(!step){ e.preventDefault(); setDrag(true); }}}
                onDragLeave={()=>setDrag(false)}
                onDrop={step ? undefined : onDropFile}
                onClick={step ? undefined : onPickFile}
              >
                {!step && (
                  <>
                    <div className="dz-icon"><Icon.Upload size={26}/></div>
                    <div style={{fontWeight:700, fontSize:18, marginBottom:4}}>{drag ? "Solte para enviar" : "Arraste e solte sua planilha"}</div>
                    <div style={{fontSize:13, color:"var(--muted)", marginBottom:16}}>ou</div>
                    <span className="btn btn-primary" style={{pointerEvents:"none"}}><Icon.Upload size={14}/> Selecionar arquivo</span>
                    <div style={{display:"flex", justifyContent:"center", gap:6, flexWrap:"wrap", marginTop:18}}>
                      {[".csv",".xlsx",".json",".tsv"].map(e=>(
                        <span key={e} className="chip mono" style={{background:"white", border:"1px solid var(--line)", fontSize:11}}>{e}</span>
                      ))}
                    </div>
                    <div style={{fontSize:12, color:"var(--muted)", marginTop:10, display:"inline-flex", alignItems:"center", gap:6}}>
                      <Icon.Lock size={11}/> Lido no seu navegador · até {(maxRows || 5000).toLocaleString("pt-BR")} linhas por base no seu plano
                    </div>
                  </>
                )}
                {step && filename && (
                  <ProcessingPanel filename={filename} progress={progress} step={step}/>
                )}
              </div>
            </div>
          )}
          {tab === "paste" && (
            <div style={{padding: 20, minHeight: 360, display:"flex", flexDirection:"column"}}>
              <div style={{fontWeight:700, fontSize:15, marginBottom:4}}>Cole seus dados</div>
              <div style={{fontSize:13, color:"var(--muted)", marginBottom: 12}}>CSV, TSV ou JSON, com cabeçalho na primeira linha. Detectamos o formato sozinhos.</div>
              <textarea
                aria-label="Dados colados"
                value={pasteText}
                onChange={e=>setPasteText(e.target.value)}
                placeholder={`data,produto,regiao,valor\n2026-07-12,Mesa Ajustável,CO,2980\n2026-07-12,Notebook Pro 14,SE,8120`}
                className="field mono"
                style={{flex:1, minHeight:200, resize:"vertical", fontSize:13, lineHeight:1.5}}
              />
              <button className="btn btn-primary" style={{marginTop:14, justifyContent:"center"}}
                disabled={!pasteText.trim() || !!step}
                onClick={()=>{
                  // Mesmo texto, porta certa: JSON colado ia para o parser de CSV
                  // e virava uma coluna "[".
                  const t = pasteText.trim();
                  setTab("file");
                  runProcessing({ name: (t[0] === "[" || t[0] === "{") ? "colado.json" : "colado.csv", text: pasteText });
                }}>
                <Icon.Sparkle size={14}/> Analisar dados colados
              </button>
            </div>
          )}
          {tab === "sample" && (
            <div style={{padding: 20, minHeight: 360, display:"flex", flexDirection:"column", gap:10}}>
              <div style={{fontWeight:700, fontSize:15}}>Testar com dados de exemplo</div>
              <div style={{fontSize:13, color:"var(--muted)", marginBottom:4}}>Uma base de vendas fictícia para ver o fluxo completo. Não é salva na sua lista.</div>
              {samples.map(s=>(
                <button key={s.n} className="sample-row" onClick={()=>{ setTab("file"); runProcessing({name:s.n, text: s.text, isDemo: true}); }}>
                  <span style={{width:36, height:36, borderRadius:10, background: `color-mix(in oklch, ${s.c} 15%, white)`, color:s.c, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                    <Icon.Doc size={16}/>
                  </span>
                  <span style={{flex:1, minWidth:0}}>
                    <span className="mono" style={{display:"block", fontSize:13, fontWeight:600}}>{s.n}</span>
                    <span style={{display:"block", fontSize:12, color:"var(--muted)"}}>{s.d}</span>
                  </span>
                  <span className="chip" style={{background:"var(--line-2)"}}>{s.t}</span>
                  <Icon.Arrow size={14}/>
                </button>
              ))}
            </div>
          )}
          {tab === "url" && (
            <div style={{padding: 20, minHeight: 360, display:"flex", flexDirection:"column", gap:12}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span style={{fontWeight:700, fontSize:15}}>Importar de uma URL</span>
                <span className="chip" style={{background:"var(--line-2)", fontSize:11}}>Em breve</span>
              </div>
              <div style={{fontSize:13, color:"var(--muted)"}}>Link público de CSV, Google Sheets ou endpoint JSON. Enquanto isso, baixe o arquivo e envie pela aba Arquivo.</div>
              <input disabled placeholder="https://exemplo.com/dados.csv" aria-label="URL dos dados" className="field" style={{opacity:.7}}/>
              <div style={{flex:1}}/>
              <button className="btn btn-ghost" style={{justifyContent:"center"}} onClick={()=> setTab("file")}>
                <Icon.Upload size={14}/> Enviar um arquivo
              </button>
            </div>
          )}
        </div>

        {/* Direita: formatos aceitos */}
        <div className="rv card" style={{padding: 0, overflow:"hidden", background:"#fafbfe"}}>
          <div style={{padding:"16px 18px 12px", borderBottom:"1px solid var(--line)"}}>
            <div style={{fontWeight:700, fontSize:15}}>Formatos aceitos</div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:3}}>Clique para ver a estrutura esperada.</div>
          </div>
          <div style={{padding:12, display:"flex", flexDirection:"column", gap:6}}>
            {formats.map(f=>(
              <button key={f.k} onClick={()=>setPreview(f)} aria-pressed={preview.k===f.k} className={"format-row" + (preview.k===f.k ? " on" : "")}>
                <span style={{width:32, height:32, borderRadius:8, background:`color-mix(in oklch, ${f.c} 18%, white)`, color:f.c, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                  <Icon.Doc size={14}/>
                </span>
                <span style={{flex:1, minWidth:0}}>
                  <span style={{display:"flex", alignItems:"center", gap:8}}>
                    <span style={{fontWeight:700, fontSize:13.5}}>{f.n}</span>
                    <span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{f.ext}</span>
                  </span>
                  <span style={{display:"block", fontSize:12, color:"var(--muted)", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{f.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <div style={{margin:"0 12px 12px", border:"1px solid var(--line)", borderRadius:10, background:"white", overflow:"hidden"}}>
            <div className="mono" style={{padding:"9px 12px", borderBottom:"1px solid var(--line-2)", fontSize:11.5, fontWeight:600, color:"var(--ink-2)"}}>{preview.n} · estrutura esperada</div>
            <pre className="mono" style={{margin:0, padding:"10px 12px", fontSize:11.5, lineHeight:1.55, color:"var(--ink-2)", whiteSpace:"pre-wrap", maxHeight:130, overflow:"auto"}}>
{preview.sample}
            </pre>
          </div>
        </div>
      </div>

      {/* Dicas + privacidade */}
      <div className="rv flow-grid" style={{marginTop: 18, display:"grid", gridTemplateColumns:"minmax(0, 1.35fr) minmax(0, 1fr)", gap:18}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700, fontSize:14.5, marginBottom:12}}>Como organizar seus dados</div>
          <ul className="resp-collapse" style={{listStyle:"none", padding:0, margin:0, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            {[
              {t:"Cabeçalho na primeira linha", d:"Nomes claros: data, produto, valor."},
              {t:"Uma observação por linha", d:"Sem linhas mescladas ou totais no meio."},
              {t:"Datas consistentes", d:"2026-07-12 ou 12/07/2026."},
              {t:"Números como números", d:"2980 ou 2.980,00 — evite texto junto."},
            ].map(r=>(
              <li key={r.t} style={{display:"flex", gap:10, alignItems:"flex-start"}}>
                <span style={{width:18, height:18, borderRadius:5, background:"var(--brand-soft)", color:"var(--brand)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2}}>
                  <Icon.Check size={11} stroke={3}/>
                </span>
                <span>
                  <span style={{display:"block", fontWeight:600, fontSize:13}}>{r.t}</span>
                  <span style={{display:"block", fontSize:12, color:"var(--muted)"}}>{r.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
            <span style={{width:28, height:28, borderRadius:8, background:"#e7f7ef", color:"#0a8a4a", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <Icon.Lock size={14}/>
            </span>
            <span style={{fontWeight:700, fontSize:14.5}}>Privado por padrão</span>
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:8, fontSize:12.5, color:"var(--ink-2)", lineHeight:1.5}}>
            <div style={{display:"flex", gap:8}}><Icon.Check size={13} stroke={2.6} color="#0a8a4a"/> <span>O arquivo é lido e processado no seu navegador.</span></div>
            <div style={{display:"flex", gap:8}}><Icon.Check size={13} stroke={2.6} color="#0a8a4a"/> <span>A análise por IA só roda quando você clica, e envia nomes de colunas, indicadores e até 20 linhas.</span></div>
            <div style={{display:"flex", gap:8}}><Icon.Check size={13} stroke={2.6} color="#0a8a4a"/> <span>O dashboard fica salvo só neste navegador, e você apaga quando quiser.</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProcessingPanel({ filename, progress, step }){
  const stages = [
    { k:"reading", n:"Lendo o arquivo", i:<Icon.Upload size={13}/> },
    { k:"parsing", n:"Identificando colunas e tipos", i:<Icon.Doc size={13}/> },
    { k:"analyzing", n:"Sugerindo as melhores métricas", i:<Icon.Sparkle size={13}/> },
    { k:"done", n:"Pronto", i:<Icon.Check size={13} stroke={3}/> },
  ];
  const order = ["reading","parsing","analyzing","done"];
  const curIdx = order.indexOf(step);
  return (
    <div style={{textAlign:"left", maxWidth: 420, margin:"0 auto", width:"100%"}} aria-live="polite">
      <div style={{display:"flex", alignItems:"center", gap:14, marginBottom: 16}}>
        <div style={{
          width:46, height:46, borderRadius:12, flexShrink:0,
          background: step==="done" ? "linear-gradient(180deg, #0a8a4a, #006b3a)" : "linear-gradient(180deg, var(--brand), var(--brand-2))",
          color:"white", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .3s ease"
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
        <span className="mono" style={{fontSize:12, fontWeight:700, color:"var(--ink-2)"}}>{progress}%</span>
      </div>
      <div style={{height:6, background:"var(--line-2)", borderRadius:99, overflow:"hidden", marginBottom: 18}}>
        <div style={{width:`${progress}%`, height:"100%", borderRadius:99, background:"linear-gradient(90deg, var(--brand), var(--violet))", transition:"width .35s ease"}}/>
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:10}}>
        {stages.map((s, i)=>{
          const state = i < curIdx || step === "done" ? "done" : i === curIdx ? "active" : "pending";
          return (
            <div key={s.k} style={{display:"flex", alignItems:"center", gap:12, opacity: state==="pending"?0.45:1, transition:"opacity .3s ease"}}>
              <span style={{
                width:24, height:24, borderRadius:7, flexShrink:0,
                background: state==="done" ? "#e7f7ef" : state==="active" ? "var(--brand-soft)" : "var(--line-2)",
                color: state==="done" ? "#0a8a4a" : state==="active" ? "var(--brand)" : "var(--muted)",
                display:"inline-flex", alignItems:"center", justifyContent:"center"
              }}>
                {state==="done" ? <Icon.Check size={12} stroke={3}/> : s.i}
              </span>
              <span style={{fontSize:13, fontWeight: state==="active"?600:500, color: state==="active" ? "var(--ink)" : "var(--ink-2)"}}>{s.n}</span>
              {state==="active" && <span className="flow-spinner" aria-hidden="true" style={{marginLeft:"auto"}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chave estável de uma métrica sugerida. O Dashboard recalcula
// dashSuggestMetrics com os mesmos dados (mesma ordem), então o índice ajuda a
// distinguir duas sugestões do mesmo tipo na mesma coluna.
function dashMetricKey(m, idx){
  return m.kind + "|" + ((m.columns && m.columns.primary) || "") + "|" + idx;
}

function PromptView({ onGenerate, onBack, fileInfo }){
  const fname = fileInfo?.name || "vendas_exemplo.csv";
  const rows = fileInfo?.rows || 120;
  const cols = fileInfo?.cols || 10;

  // Detected schema — comes from the real parser (fileInfo.schema). When the
  // user reaches this view via Tweaks without an upload, fall back to a small
  // illustrative shape so the UI still demos.
  const schema = (fileInfo?.schema && fileInfo.schema.length)
    ? fileInfo.schema.map(c => ({
        n: c.name,
        t: c.type,
        ex: (c.examples && c.examples[0]) || "—",
        nulls: c.nullCount || 0,
        uniq: c.uniqCount || 0,
      }))
    : [
        { n:"data", t:"date", ex:"2026-07-12", nulls:0 },
        { n:"produto", t:"dimension", ex:"Mesa Ajustável", nulls:0, uniq:18 },
        { n:"regiao", t:"dimension", ex:"Centro-Oeste", nulls:0, uniq:5 },
        { n:"valor_total", t:"measure", ex:"R$ 4.420", nulls:0 },
      ];
  const typeMeta = {
    date:      { c:"#7a5cff", bg:"color-mix(in oklch, #7a5cff 14%, white)", n:"data" },
    dimension: { c:"#2f6bff", bg:"var(--brand-soft)", n:"dimensão" },
    measure:   { c:"#0a8a4a", bg:"#e7f7ef", n:"número" },
  };
  const count = (t)=> schema.filter(c=>c.t===t).length;

  // Métricas sugeridas pelo perfilador quando há upload; sem upload (só pelo
  // Tweaks), um conjunto ilustrativo.
  const realMetrics = React.useMemo(()=> (fileInfo && fileInfo.profiles && fileInfo.profiles.length && window.dashSuggestMetrics)
    ? window.dashSuggestMetrics(fileInfo.profiles, fileInfo.data || [])
    : null, [fileInfo]);

  const demoGroups = [
    { k:"kpi", n:"KPIs principais", i:<Icon.Sparkle size={13}/>, c:"var(--brand)",
      items: [
        { id:"k1", n:"Valor total", d:"SOMA(valor_total)", conf:98 },
        { id:"k2", n:"Ticket médio", d:"MÉDIA(valor_total)", conf:96 },
        { id:"k3", n:"Total de pedidos", d:"CONTAGEM(linhas)", conf:95 },
      ]},
    { k:"trend", n:"Tendências no tempo", i:<Icon.Line size={13}/>, c:"#7a5cff",
      items: [
        { id:"t1", n:"Evolução diária do valor", d:"valor_total por data", conf:97 },
      ]},
    { k:"dim", n:"Quebras por dimensão", i:<Icon.Bars size={13}/>, c:"#0a8a4a",
      items: [
        { id:"d1", n:"Vendas por região", d:"SOMA(valor_total) por regiao", conf:96 },
        { id:"d2", n:"Top produtos", d:"SOMA(valor_total) por produto", conf:95 },
      ]},
  ];

  const groups = realMetrics ? (()=>{
    const kindDesc = { sum:"soma", avg:"média", count:"contagem", count_unique:"contagem distinta",
      percent_positive:"% positivo", trend:"evolução no tempo", top_n:"ranking",
      distribution:"distribuição", frequency_by_item:"frequência por item" };
    const famOf = (kind)=> (["sum","avg","count","count_unique","percent_positive"].indexOf(kind) >= 0) ? "kpi"
      : kind === "trend" ? "trend" : "dim";
    const meta = {
      kpi:   { k:"kpi",   n:"KPIs principais",     i:<Icon.Sparkle size={13}/>, c:"var(--brand)", hint:"até 4 no dashboard" },
      trend: { k:"trend", n:"Tendências no tempo",  i:<Icon.Line size={13}/>,    c:"#7a5cff" },
      dim:   { k:"dim",   n:"Quebras por dimensão", i:<Icon.Bars size={13}/>,    c:"#0a8a4a" },
    };
    const buckets = { kpi:[], trend:[], dim:[] };
    realMetrics.forEach((m, idx)=>{
      buckets[famOf(m.kind)].push({
        id: dashMetricKey(m, idx),
        n: m.label,
        d: (kindDesc[m.kind] || m.kind) + (m.columns.primary ? " · " + m.columns.primary : ""),
        conf: Math.min(99, m.priority),
      });
    });
    return ["kpi","trend","dim"].filter(f => buckets[f].length).map(f => ({ ...meta[f], items: buckets[f] }));
  })() : demoGroups;

  const allIds = groups.flatMap(g=>g.items.map(i=>i.id));
  const [picked, setPicked] = React.useState(()=> new Set(allIds));
  const [focus, setFocus] = React.useState((fileInfo && fileInfo.aiFocus) || "");

  const togglePick = (id)=>{
    setPicked(prev=>{
      const next = new Set(prev);
      if(next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleGroup = (g)=>{
    const ids = g.items.map(i=>i.id);
    const allOn = ids.every(id=>picked.has(id));
    setPicked(prev=>{
      const next = new Set(prev);
      ids.forEach(id=> allOn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const focusIdeas = [
    "Destaque tendências e sazonalidade",
    "Aponte os maiores e os menores valores",
    "Sugira ações práticas para o próximo mês",
  ];

  const summary = groups.map(g=>{
    const n = g.items.filter(i=>picked.has(i.id)).length;
    const label = g.k === "kpi" ? (n === 1 ? "KPI" : "KPIs") : g.k === "trend" ? (n === 1 ? "tendência" : "tendências") : (n === 1 ? "quebra" : "quebras");
    return n ? n + " " + label : null;
  }).filter(Boolean).join(" · ");
  const none = picked.size === 0;
  const generate = ()=>{
    if(none) return;
    // Tudo marcado = comportamento padrão (sem filtro); senão, só as escolhidas.
    const metrics = realMetrics && picked.size < allIds.length ? allIds.filter(id => picked.has(id)) : null;
    onGenerate && onGenerate({ metrics, focus: focus.trim().slice(0, 200) });
  };

  return (
    <div className="flow-wrap" style={{paddingBottom: 24}}>
      <FlowSteps step={2}/>

      {/* Cabeçalho */}
      <div className="rv" style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", margin:"8px 0 18px", gap:20, flexWrap:"wrap"}}>
        <div style={{minWidth:0}}>
          <div style={{display:"inline-flex", alignItems:"center", gap:8, marginBottom:8, padding:"4px 10px 4px 4px", borderRadius:999, background:"#e7f7ef", color:"#0a5a30", fontSize:12, fontWeight:700}}>
            <span style={{width:20, height:20, borderRadius:"50%", background:"#0a8a4a", color:"white", display:"inline-flex", alignItems:"center", justifyContent:"center"}}><Icon.Check size={11} stroke={3}/></span>
            Arquivo lido com sucesso
          </div>
          <h1 className="mono" style={{margin:"0 0 8px", fontSize:"clamp(20px, 2.6vw, 28px)", fontWeight:700, letterSpacing:"-.02em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"min(680px, 90vw)"}}>{fname}</h1>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            <span className="chip" style={{background:"white", border:"1px solid var(--line)"}}><b className="ticker">{rows.toLocaleString("pt-BR")}</b> linhas</span>
            <span className="chip" style={{background:"white", border:"1px solid var(--line)"}}><b className="ticker">{cols}</b> colunas</span>
            {[["date","data","datas"],["dimension","dimensão","dimensões"],["measure","número","números"]].map(([t, s1, sN])=>{
              const n = count(t);
              if(!n) return null;
              const m = typeMeta[t];
              return <span key={t} className="chip" style={{background:m.bg, color:m.c, fontWeight:600}}>{n} {n === 1 ? s1 : sN}</span>;
            })}
          </div>
        </div>
        <button className="btn btn-ghost" style={{padding:"8px 12px"}} onClick={onBack}><Icon.Refresh size={14}/> Trocar arquivo</button>
      </div>

      <div className="flow-grid" style={{display:"grid", gridTemplateColumns:"minmax(0, 1.45fr) minmax(0, 1fr)", gap: 18, alignItems:"start"}}>
        {/* ESQUERDA: métricas + foco da IA */}
        <div style={{display:"flex", flexDirection:"column", gap: 16, minWidth:0}}>
          <div className="rv card soft-shadow" style={{padding:22}}>
            <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
              <div style={{display:"flex", alignItems:"center", gap:10, minWidth:0}}>
                <div style={{width:36, height:36, borderRadius:10, flexShrink:0, background:"linear-gradient(135deg, var(--brand), var(--violet))", color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Sparkle size={16}/>
                </div>
                <div>
                  <div style={{fontWeight:700, fontSize:16}}>O que entra no dashboard</div>
                  <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>{allIds.length} sugestões a partir das suas colunas. O % é a confiança em cada uma.</div>
                </div>
              </div>
              <div style={{display:"flex", gap:6}}>
                <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12}} onClick={()=>setPicked(new Set(allIds))}>Marcar todas</button>
                <button className="btn btn-ghost" style={{padding:"6px 10px", fontSize:12}} onClick={()=>setPicked(new Set())}>Limpar</button>
              </div>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:18, marginTop:18}}>
              {groups.map(g=>{
                const on = g.items.filter(i=>picked.has(i.id)).length;
                return (
                  <div key={g.k}>
                    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
                      <span style={{width:24, height:24, borderRadius:7, background:`color-mix(in oklch, ${g.c} 15%, white)`, color:g.c, display:"inline-flex", alignItems:"center", justifyContent:"center"}}>{g.i}</span>
                      <span style={{fontWeight:700, fontSize:13}}>{g.n}</span>
                      <span className="mono" style={{fontSize:11, color:"var(--muted)"}}>{on}/{g.items.length}</span>
                      {g.hint && <span style={{fontSize:11, color:"var(--muted)"}}>· {g.hint}</span>}
                      <button className="link-btn" style={{marginLeft:"auto"}} onClick={()=>toggleGroup(g)}>{on === g.items.length ? "Desmarcar grupo" : "Marcar grupo"}</button>
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap:8}}>
                      {g.items.map(it=>{
                        const sel = picked.has(it.id);
                        return (
                          <button key={it.id} role="checkbox" aria-checked={sel} onClick={()=>togglePick(it.id)} className={"metric-opt" + (sel ? " on" : "")}>
                            <span className="metric-box">{sel && <Icon.Check size={11} stroke={3.5}/>}</span>
                            <span style={{flex:1, minWidth:0}}>
                              <span style={{display:"block", fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.n}</span>
                              <span className="mono" style={{display:"block", fontSize:11, color:"var(--muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{it.d}</span>
                            </span>
                            <span className="metric-conf" title={"Confiança da sugestão: " + it.conf + "%"}>
                              <span className="mono">{it.conf}%</span>
                              <span className="metric-conf-bar"><span style={{width: it.conf + "%"}}/></span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rv card" style={{padding:22}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:12, flexWrap:"wrap"}}>
              <div>
                <div style={{fontWeight:700, fontSize:15}}>Foco da análise por IA <span style={{fontWeight:500, color:"var(--muted)", fontSize:13}}>(opcional)</span></div>
                <div style={{fontSize:12, color:"var(--muted)", marginTop:3}}>Diga o que a IA deve destacar quando você gerar a análise no dashboard.</div>
              </div>
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)"}}><Icon.Sparkle size={11}/> Gemini</span>
            </div>
            <textarea
              aria-label="Foco da análise por IA"
              value={focus} onChange={e=>setFocus(e.target.value)} rows={2} maxLength={200}
              placeholder="Ex.: compare as regiões e explique a queda de março"
              className="field"
              style={{resize:"none", lineHeight:1.5}}
            />
            <div style={{display:"flex", flexWrap:"wrap", gap:6, marginTop:10, alignItems:"center"}}>
              {focusIdeas.map(s=>(
                <button key={s} onClick={()=>setFocus(s)} className="chip idea-chip">{s}</button>
              ))}
              <span className="mono" style={{marginLeft:"auto", fontSize:11, color:"var(--muted)"}}>{focus.length}/200</span>
            </div>
          </div>
        </div>

        {/* DIREITA: esquema */}
        <div className="rv card flow-sticky" style={{padding:0, overflow:"hidden"}}>
          <div style={{padding:"16px 18px 12px", borderBottom:"1px solid var(--line)"}}>
            <div style={{fontWeight:700, fontSize:15}}>Colunas detectadas</div>
            <div style={{fontSize:12, color:"var(--muted)", marginTop:3}}>Tipos inferidos automaticamente.</div>
          </div>
          <div style={{padding:"6px 12px 10px", maxHeight:420, overflowY:"auto"}}>
            {schema.map((c,i)=>{
              const m = typeMeta[c.t] || typeMeta.dimension;
              return (
                <div key={c.n + i} style={{display:"grid", gridTemplateColumns:"auto minmax(0, 1fr)", gap:10, alignItems:"center", padding:"9px 4px", borderTop: i===0?"none":"1px solid var(--line-2)"}}>
                  <span style={{fontSize:9.5, fontWeight:700, padding:"3px 7px", borderRadius:5, background: m.bg, color: m.c, letterSpacing:".05em", textTransform:"uppercase", minWidth:62, textAlign:"center"}}>{m.n}</span>
                  <span style={{minWidth:0}}>
                    <span className="mono" style={{display:"block", fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.n}</span>
                    <span style={{display:"block", fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                      ex.: {String(c.ex)}{c.uniq ? ` · ${c.uniq.toLocaleString("pt-BR")} únicos` : ""}{c.nulls>0 ? ` · ${c.nulls} vazios` : ""}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Barra de ação fixa: resumo + gerar */}
      <div className="flow-actionbar">
        <div style={{minWidth:0}}>
          <div style={{fontWeight:700, fontSize:14}}>{none ? "Nenhuma métrica marcada" : picked.size + " de " + allIds.length + " métricas"}</div>
          <div style={{fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{none ? "Marque ao menos uma para gerar o dashboard." : summary}</div>
        </div>
        <div style={{display:"flex", gap:8, flexShrink:0}}>
          <button className="btn btn-ghost flow-back" onClick={onBack}>Voltar</button>
          <button className="btn btn-primary" onClick={generate} disabled={none} style={{opacity: none ? .55 : 1, cursor: none ? "not-allowed" : "pointer"}}>
            <Icon.Sparkle size={15}/> Gerar dashboard <Icon.Arrow size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { UploadView, PromptView, ProcessingPanel, FlowSteps, dashMetricKey });
