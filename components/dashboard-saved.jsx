/* Dashboards salvos — guardados SÓ neste navegador (IndexedDB), nunca no servidor.
 *
 * Mantém a promessa "seus dados não saem do navegador" (CLAUDE.md §8): o arquivo
 * já processado, o layout dos blocos e a análise da IA ficam no IndexedDB deste
 * aparelho, separados por dono (id do usuário, ou "anon" sem conta). Dois stores:
 *   dashboards → metadados + layout + narrativa (lista leve)
 *   datasets   → linhas da base, em matriz (header + rows) para clonar rápido
 *
 * Tudo é best-effort: sem IndexedDB (modo privado antigo, cota cheia, bloqueado
 * pelo navegador) as funções resolvem vazio e o app segue igual, só sem salvar.
 * A pessoa pode desligar o salvamento (preferência de UI em localStorage).
 */

const DASH_SAVED_DB = "dash-saved";
// Acima disso clonar as linhas trava a aba por segundos: não salva (avisa na lista).
const DASH_SAVED_MAX_ROWS = 200000;
// Free guarda os mais recentes; planos pagos guardam bem mais.
const DASH_SAVED_KEEP = { free: 3, paid: 50 };
const DASH_SAVED_PREF = "dash.saveLocal";

let _dashSavedDbPromise = null;
const _dashSavedListeners = new Set();

function dashSavedDb(){
  if(_dashSavedDbPromise) return _dashSavedDbPromise;
  _dashSavedDbPromise = new Promise(function(resolve){
    try {
      if(!window.indexedDB){ resolve(null); return; }
      const req = window.indexedDB.open(DASH_SAVED_DB, 1);
      req.onupgradeneeded = function(){
        const db = req.result;
        if(!db.objectStoreNames.contains("dashboards")){
          db.createObjectStore("dashboards", { keyPath: "id" }).createIndex("owner", "owner");
        }
        if(!db.objectStoreNames.contains("datasets")) db.createObjectStore("datasets", { keyPath: "id" });
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ resolve(null); };
      req.onblocked = function(){ resolve(null); };
    } catch(e){ resolve(null); }
  });
  return _dashSavedDbPromise;
}

// Roda fn(stores) numa transação e resolve com o valor que fn devolver (um
// IDBRequest vira o seu .result). Erro → resolve fallback, nunca rejeita.
function dashSavedTx(storeNames, mode, fn, fallback){
  return dashSavedDb().then(function(db){
    if(!db) return fallback;
    return new Promise(function(resolve){
      try {
        const tx = db.transaction(storeNames, mode);
        const stores = {};
        storeNames.forEach(function(n){ stores[n] = tx.objectStore(n); });
        const out = fn(stores);
        tx.oncomplete = function(){ resolve(out && typeof out === "object" && "result" in out && "readyState" in out ? out.result : out); };
        tx.onerror = function(){ resolve(fallback); };
        tx.onabort = function(){ resolve(fallback); };
      } catch(e){ resolve(fallback); }
    });
  });
}

// Cópia sem funções nem elementos React (o IndexedDB não clona funções, e um
// elemento React restaurado quebraria a renderização).
function dashSavedPlain(v){
  if(v == null || typeof v !== "object") return typeof v === "function" ? undefined : v;
  if(v instanceof Date) return new Date(v.getTime());
  if(v.$$typeof) return undefined;
  if(Array.isArray(v)) return v.map(dashSavedPlain);
  const out = {};
  Object.keys(v).forEach(function(k){
    const x = dashSavedPlain(v[k]);
    if(x !== undefined) out[k] = x;
  });
  return out;
}

function dashSavedEmit(){ _dashSavedListeners.forEach(function(fn){ try { fn(); } catch(e){} }); }

const DashSaved = {
  MAX_ROWS: DASH_SAVED_MAX_ROWS,
  KEEP: DASH_SAVED_KEEP,

  subscribe: function(fn){ _dashSavedListeners.add(fn); return function(){ _dashSavedListeners.delete(fn); }; },

  enabled: function(){
    try { return window.localStorage.getItem(DASH_SAVED_PREF) !== "off"; } catch(e){ return true; }
  },
  setEnabled: function(on){
    try { window.localStorage.setItem(DASH_SAVED_PREF, on ? "on" : "off"); } catch(e){}
    dashSavedEmit();
  },

  // Cria o registro de uma base recém-enviada. Resolve true se salvou.
  create: function(id, owner, fileInfo){
    if(!DashSaved.enabled() || !fileInfo || !Array.isArray(fileInfo.data) || !fileInfo.data.length) return Promise.resolve(false);
    if(fileInfo.data.length > DASH_SAVED_MAX_ROWS) return Promise.resolve(false);
    const keys = new Set();
    (fileInfo.schema || []).forEach(function(c){ if(c && c.name != null) keys.add(c.name); });
    fileInfo.data.forEach(function(r){ for(const k in r) keys.add(k); });
    const header = Array.from(keys);
    const rows = fileInfo.data.map(function(r){ return header.map(function(h){ return r[h]; }); });
    const now = Date.now();
    const meta = {
      id: id, owner: owner || "anon",
      name: fileInfo.name || "dados", sizeKB: fileInfo.sizeKB || null,
      rows: fileInfo.data.length, cols: fileInfo.cols || header.length,
      createdAt: now, updatedAt: now, layout: null, narrative: null,
    };
    const dataset = {
      id: id, header: header, rows: rows,
      schema: dashSavedPlain(fileInfo.schema || []), profiles: dashSavedPlain(fileInfo.profiles || []),
    };
    return dashSavedTx(["dashboards", "datasets"], "readwrite", function(s){
      s.datasets.put(dataset);
      s.dashboards.put(meta);
      return true;
    }, false).then(function(ok){ if(ok) dashSavedEmit(); return ok; });
  },

  // Atualiza layout/narrativa de um registro existente.
  update: function(id, patch){
    if(!id) return Promise.resolve(false);
    return dashSavedTx(["dashboards"], "readwrite", function(s){
      const req = s.dashboards.get(id);
      req.onsuccess = function(){
        const cur = req.result;
        if(!cur) return;
        s.dashboards.put(Object.assign({}, cur, dashSavedPlain(patch), { updatedAt: Date.now() }));
      };
      return true;
    }, false).then(function(ok){ if(ok) dashSavedEmit(); return ok; });
  },

  list: function(owner){
    return dashSavedTx(["dashboards"], "readonly", function(s){
      return s.dashboards.index("owner").getAll(owner || "anon");
    }, []).then(function(rows){
      return (rows || []).sort(function(a, b){ return (b.updatedAt || 0) - (a.updatedAt || 0); });
    });
  },

  // Reconstrói o fileInfo do upload + layout e narrativa salvos.
  load: function(id){
    return dashSavedTx(["dashboards", "datasets"], "readonly", function(s){
      const out = {};
      const a = s.dashboards.get(id); a.onsuccess = function(){ out.meta = a.result; };
      const b = s.datasets.get(id);   b.onsuccess = function(){ out.dataset = b.result; };
      return out;
    }, null).then(function(out){
      if(!out || !out.meta || !out.dataset) return null;
      const h = out.dataset.header || [];
      const data = (out.dataset.rows || []).map(function(r){
        const o = {};
        for(let i = 0; i < h.length; i++){ if(r[i] !== undefined) o[h[i]] = r[i]; }
        return o;
      });
      return {
        meta: out.meta,
        fileInfo: {
          name: out.meta.name, sizeKB: out.meta.sizeKB, rows: data.length, cols: out.meta.cols,
          schema: out.dataset.schema || [], data: data, profiles: out.dataset.profiles || [],
          savedId: id, savedLayout: out.meta.layout || null, savedNarrative: out.meta.narrative || null,
        },
      };
    });
  },

  remove: function(id){
    return dashSavedTx(["dashboards", "datasets"], "readwrite", function(s){
      s.dashboards.delete(id);
      s.datasets.delete(id);
      return true;
    }, false).then(function(ok){ if(ok) dashSavedEmit(); return ok; });
  },

  // Mantém só os `keep` mais recentes do dono (o atual nunca é apagado).
  prune: function(owner, keep, protectId){
    return DashSaved.list(owner).then(function(items){
      const extra = items.filter(function(it){ return it.id !== protectId; }).slice(Math.max(0, keep - (protectId ? 1 : 0)));
      return Promise.all(extra.map(function(it){ return DashSaved.remove(it.id); }));
    });
  },

  // Quem usou sem conta e acabou de entrar leva os dashboards deste navegador junto.
  claim: function(fromOwner, toOwner){
    if(!toOwner || fromOwner === toOwner) return Promise.resolve(0);
    return dashSavedTx(["dashboards"], "readwrite", function(s){
      const req = s.dashboards.index("owner").getAll(fromOwner);
      req.onsuccess = function(){
        (req.result || []).forEach(function(m){ s.dashboards.put(Object.assign({}, m, { owner: toOwner })); });
      };
      return true;
    }, false).then(function(ok){ if(ok) dashSavedEmit(); return ok; });
  },
};

function dashSavedWhen(ts){
  if(!ts) return "";
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if(diff < 60 * 1000) return "agora";
  if(diff < 60 * 60 * 1000) return "há " + Math.round(diff / 60000) + " min";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if(d >= today) return "hoje, " + hm;
  if(d >= new Date(today.getTime() - 864e5)) return "ontem, " + hm;
  return d.toLocaleDateString("pt-BR");
}

// Lista "Continuar de onde parou" (UploadView). Some quando não há nada salvo.
function SavedDashboards({ owner, isPaid, onOpen }){
  const [items, setItems] = React.useState(null);
  const [enabled, setEnabled] = React.useState(()=> DashSaved.enabled());
  const [opening, setOpening] = React.useState(null);

  React.useEffect(()=>{
    let alive = true;
    const refresh = ()=>{
      setEnabled(DashSaved.enabled());
      DashSaved.list(owner).then(list => { if(alive) setItems(list); });
    };
    refresh();
    const off = DashSaved.subscribe(refresh);
    return ()=>{ alive = false; off(); };
  }, [owner]);

  if(!items || (!items.length && enabled)) return null;

  const keep = isPaid ? DASH_SAVED_KEEP.paid : DASH_SAVED_KEEP.free;
  const open = async (id)=>{
    if(opening) return;
    setOpening(id);
    const ok = await onOpen(id);
    if(!ok) setOpening(null);
  };
  const remove = (it)=>{
    if(window.confirm("Apagar “" + it.name + "” deste navegador? O arquivo original no seu computador não é afetado.")) DashSaved.remove(it.id);
  };

  return (
    <section aria-label="Dashboards salvos" className="card" style={{padding:"18px 20px", marginBottom:28}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom: items.length ? 12 : 0}}>
        <div>
          <div style={{fontWeight:700, fontSize:15}}>Continuar de onde parou</div>
          <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>
            {enabled
              ? "Salvos só neste navegador, com layout e análise da IA. " + (isPaid ? "Até " + keep + " dashboards." : "O Free guarda os " + keep + " mais recentes.")
              : "O salvamento neste navegador está desligado."}
          </div>
        </div>
        <label style={{display:"inline-flex", alignItems:"center", gap:8, fontSize:12, color:"var(--ink-2)", cursor:"pointer"}}>
          <input type="checkbox" checked={enabled} onChange={e=> DashSaved.setEnabled(e.target.checked)}/>
          Salvar neste navegador
        </label>
      </div>
      {items.length > 0 && (
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:10}}>
          {items.slice(0, keep).map(it=>(
            <div key={it.id} style={{display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:"1px solid var(--line)", borderRadius:12, background:"white", minWidth:0}}>
              <button onClick={()=> open(it.id)} disabled={!!opening} title={"Abrir " + it.name}
                style={{flex:1, minWidth:0, display:"flex", alignItems:"center", gap:10, background:"transparent", border:0, padding:0, cursor:"pointer", textAlign:"left", color:"var(--ink)"}}>
                <span style={{width:32, height:32, borderRadius:9, flexShrink:0, background:"var(--brand-soft)", color:"var(--brand)", display:"inline-flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Chart size={15}/>
                </span>
                <span style={{minWidth:0}}>
                  <span style={{display:"block", fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{opening === it.id ? "Abrindo…" : it.name}</span>
                  <span className="mono" style={{display:"block", fontSize:11, color:"var(--muted)", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                    {(it.rows || 0).toLocaleString("pt-BR")} linhas · {dashSavedWhen(it.updatedAt)}{it.narrative ? " · IA" : ""}
                  </span>
                </span>
              </button>
              <button className="icon-btn" onClick={()=> remove(it)} title="Apagar deste navegador" aria-label={"Apagar " + it.name}>
                <Icon.X size={13}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

Object.assign(window, { DashSaved, SavedDashboards });
