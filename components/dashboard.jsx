/* Dashboard app — improved layout + scroll-driven reveals */

/* ─────────────────── CSV ingestion + aggregation ───────────────────
 * Pure helpers used by UploadView (parsing) and Dashboard (aggregation).
 * No external libs — everything runs in the browser per CLAUDE.md §8.
 */

function dashParseCSV(text){
  if(!text) return { header: [], rows: [], sep: "," };
  // Detect separator from the first non-blank line, ignoring quoted regions.
  let probe = "";
  for(let i=0; i<text.length && i<2048; i++){
    const c = text[i];
    if(c === "\n") break;
    if(c !== "\r") probe += c;
  }
  const counts = { ",":0, ";":0, "\t":0 };
  let inQ = false;
  for(const c of probe){
    if(c === '"') inQ = !inQ;
    else if(!inQ && c in counts) counts[c]++;
  }
  const sep = counts[";"] > counts[","] && counts[";"] >= counts["\t"] ? ";" :
              counts["\t"] > counts[","] ? "\t" : ",";

  const all = [];
  let row = [], cur = "", q = false;
  for(let i=0; i<text.length; i++){
    const c = text[i];
    if(q){
      if(c === '"' && text[i+1] === '"'){ cur += '"'; i++; }
      else if(c === '"'){ q = false; }
      else cur += c;
    } else if(c === '"' && cur === ""){ q = true; }
    else if(c === sep){ row.push(cur); cur = ""; }
    else if(c === '\r'){ /* skip */ }
    else if(c === '\n'){
      if(cur !== "" || row.length){ row.push(cur); all.push(row); }
      cur = ""; row = [];
    }
    else cur += c;
  }
  if(cur !== "" || row.length){ row.push(cur); all.push(row); }
  const header = (all.shift() || []).map(h => String(h).trim());
  return { header, rows: all, sep };
}

function dashParseNumber(v){
  if(v == null) return null;
  if(typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if(!s) return null;
  // Strip currency symbols, percent and whitespace (incl. nbsp).
  s = s.replace(/R\$|US\$|\$|€|£|¥|%/g, "").replace(/\s| /g, "");
  // Capture sign: leading "-" or accounting parens "(123)".
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/^[+\-]/, "");
  if(!s) return null;
  // Strict guard (BUG: parseFloat("01/01/2025") === 1). After stripping known
  // decorations only digits and the two separators may remain — a stray "/"
  // (dates), "-" (ISO dates) or letter means this is NOT a number, so bail to
  // null instead of letting parseFloat return a partial read.
  if(!/^[\d.,]+$/.test(s)) return null;
  const hasDot = s.includes("."), hasComma = s.includes(",");
  let norm;
  if(hasDot && hasComma){
    // Decimal marker is whichever separator appears last.
    norm = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")   // BR 1.234,56 → 1234.56
      : s.replace(/,/g, "");                       // US 1,234.56 → 1234.56
  } else if(hasComma || hasDot){
    // One separator kind only. Several groups (1.234.567) → thousands. A single
    // separator is thousands ONLY in the "1.500" / "12,345" shape: 1-3 leading
    // digits (not 0) + exactly 3 digits. Anything else is a decimal — before,
    // "0.048" virava 48, "3.14159" virava 314159 e "12.5000" virava 125000.
    const sep = hasComma ? "," : ".";
    const parts = s.split(sep);
    const thousands = parts.length > 2 || (/^[1-9]\d{0,2}$/.test(parts[0]) && parts[1].length === 3);
    norm = thousands ? parts.join("") : parts[0] + "." + parts[1];
  } else {
    norm = s;
  }
  const n = parseFloat(norm);
  if(!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function dashParseDate(v){
  if(v == null) return null;
  const s = String(v).trim();
  if(!s) return null;
  // Valida dia/mês: new Date(2026, 14, 3) "transborda" para 2027 em silêncio
  // (ex.: "3/15/26" no formato americano). Data impossível → null.
  const mk = (y, mo, d)=>{
    if(mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo-1, d);
    return dt.getMonth() === mo-1 && dt.getDate() === d ? dt : null;
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return mk(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(m){
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return mk(y, Number(m[2]), Number(m[1]));
  }
  return null;
}

/* Número do JS (JSON/Excel) → texto que dashParseNumber lê sem ambiguidade.
 * String(12.345) = "12.345", que no padrão BR é doze mil — um zero à direita
 * ("12.3450") mantém o valor e tira a ambiguidade. */
function dashNumberCell(n){
  if(!Number.isFinite(n)) return "";
  const s = String(n);
  return /^-?[1-9]\d{0,2}\.\d{3}$/.test(s) ? s + "0" : s;
}

/* Texto de arquivo → string. Excel-BR salva "CSV (separado por vírgulas)" em
 * Windows-1252; ler como UTF-8 transformava "região" em "regi�o" e quebrava a
 * detecção de colunas. Tenta UTF-8 estrito e cai para Windows-1252. */
function dashDecodeText(buffer){
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch(e){ return new TextDecoder("windows-1252").decode(buffer); }
}

function dashInferSchema(header, rawRows){
  const sample = rawRows.slice(0, Math.min(200, rawRows.length));
  return header.map((name, idx)=>{
    const all = rawRows.map(r => r[idx]);
    const nullCount = all.filter(v => v == null || String(v).trim() === "").length;
    const present = sample.map(r => r[idx]).filter(v => v != null && String(v).trim() !== "");
    const examples = present.slice(0, 3).map(s => String(s));
    const uniqCount = new Set(all.filter(v => v != null && String(v).trim() !== "")).size;
    if(!present.length) return { name, type:"dimension", examples:[], uniqCount:0, nullCount };
    // Date BEFORE number, and a 0.85 threshold instead of every(): a single
    // "-"/"N/A" cell used to flip a whole date column to "measure", where the
    // strict parser then nulls every date. Same tolerance numbers already had.
    const dateCount = present.filter(v => dashParseDate(v) !== null).length;
    if(dateCount / present.length >= 0.85) return { name, type:"date", examples, uniqCount, nullCount };
    const numCount = present.filter(v => dashParseNumber(v) !== null).length;
    if(numCount / present.length >= 0.85) return { name, type:"measure", examples, uniqCount, nullCount };
    return { name, type:"dimension", examples, uniqCount, nullCount };
  });
}

function dashRowsToObjects(header, rawRows, schema){
  return rawRows.map(r => {
    const o = {};
    header.forEach((h, i)=>{
      const v = r[i];
      const t = schema[i] && schema[i].type;
      if(v == null || String(v).trim() === "") o[h] = null;
      else if(t === "measure") o[h] = dashParseNumber(v);
      else if(t === "date") o[h] = dashParseDate(v);
      else o[h] = String(v).trim();
    });
    return o;
  });
}

/* ── Excel (.xlsx/.xls) — SheetJS carregado LAZY ─────────────────────────
 * A lib só é baixada quando o usuário sobe um Excel, então quem usa CSV/JSON
 * não paga o peso dela no load da página.
 * ⚠️ CSP (CLAUDE.md §8): quando a Content-Security-Policy entrar, `cdn.sheetjs.com`
 * PRECISA ir para a allowlist de `script-src` — senão este <script> injetado é
 * bloqueado e o upload de Excel quebra silenciosamente. Hoje a CSP planejada só
 * permite unpkg + fonts. */
let _xlsxLoad = null;
function dashEnsureXLSX(){
  if(typeof window !== "undefined" && window.XLSX) return Promise.resolve(window.XLSX);
  if(_xlsxLoad) return _xlsxLoad;
  _xlsxLoad = new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.crossOrigin = "anonymous"; // TODO: adicionar integrity (SRI) na hora do deploy
    s.onload = ()=> window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX ausente após carregar"));
    s.onerror = ()=>{ _xlsxLoad = null; reject(new Error("Falha ao carregar SheetJS")); };
    document.head.appendChild(s);
  });
  return _xlsxLoad;
}

/* Excel ArrayBuffer → { header, rows } (primeira aba), no MESMO formato do
 * dashParseCSV. Lê o valor bruto de cada célula em vez do texto formatado
 * (sheet_to_csv): data vira AAAA-MM-DD (o texto vinha "3/15/26", formato
 * americano, lido como dia/mês) e número vira texto sem ambiguidade de milhar. */
function dashXlsxToParsed(arrayBuffer, XLSX){
  const wb = XLSX.read(arrayBuffer, { type:"array", cellNF:true });
  const sheetName = wb.SheetNames && wb.SheetNames[0];
  if(!sheetName) throw new Error("A planilha está vazia.");
  const ws = wb.Sheets[sheetName];
  if(!ws || !ws["!ref"]) throw new Error("A primeira aba não tem dados.");
  const pad = (n)=> String(n).padStart(2, "0");
  const cellText = (cell)=>{
    if(!cell || cell.v == null || cell.t === "e") return "";
    if(cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z)){
      const d = XLSX.SSF.parse_date_code(cell.v);
      if(d) return d.y + "-" + pad(d.m) + "-" + pad(d.d);
    }
    if(cell.t === "d" && cell.v instanceof Date){
      return cell.v.getFullYear() + "-" + pad(cell.v.getMonth()+1) + "-" + pad(cell.v.getDate());
    }
    if(cell.t === "n") return dashNumberCell(cell.v);
    if(cell.t === "b") return cell.v ? "true" : "false";
    return String(cell.v);
  };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const all = [];
  for(let r = range.s.r; r <= range.e.r; r++){
    const row = [];
    for(let c = range.s.c; c <= range.e.c; c++) row.push(cellText(ws[XLSX.utils.encode_cell({ r, c })]));
    if(row.some(v => v !== "")) all.push(row);
  }
  if(!all.length) throw new Error("A primeira aba não tem dados.");
  const header = all.shift().map(h => String(h).trim());
  return { header, rows: all };
}

/* JSON / NDJSON texto → { header, rows } no MESMO formato que dashParseCSV
 * devolve, então alimenta dashInferSchema/dashRowsToObjects sem lib externa.
 * Aceita array de objetos, {data:[...]} ou {rows:[...]}. */
function dashJsonToParsed(text, ndjson){
  let arr;
  if(ndjson){
    arr = String(text).split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
  } else {
    const p = JSON.parse(text);
    arr = Array.isArray(p) ? p
        : (p && Array.isArray(p.data)) ? p.data
        : (p && Array.isArray(p.rows)) ? p.rows
        : null;
  }
  if(!Array.isArray(arr) || !arr.length) throw new Error("o JSON precisa ser um array de objetos (ou {data:[...]}).");
  // Header = união das chaves entre as linhas (mantém ordem de 1ª aparição).
  const header = [], seen = {};
  arr.forEach(o => { if(o && typeof o === "object" && !Array.isArray(o)){ Object.keys(o).forEach(k => { if(!seen[k]){ seen[k]=1; header.push(k); } }); } });
  if(!header.length) throw new Error("JSON sem campos reconhecíveis (esperado array de objetos).");
  const rows = arr.map(o => header.map(k => {
    const v = o ? o[k] : null;
    if(v == null) return "";
    if(typeof v === "number") return dashNumberCell(v);
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  }));
  return { header, rows };
}

function dashResolveColumns(schema){
  const lc = (s)=> String(s).toLowerCase();
  const pick = (re, type)=>{
    const m = schema.find(c => (!type || c.type === type) && re.test(lc(c.name)));
    return m ? m.name : null;
  };
  // Order identifiers (used below for the unique-order denominator) must never
  // be read as revenue. The full "is this the value column?" scoring lives in
  // dashScoreValueName (dashboard-discovery.jsx) so realAgg and the discovery
  // pipeline share ONE ranking and can't pick different value columns.
  const isOrderName = (n)=> /(pedido|order|num_venda|venda_id|cod_venda|numero_pedido|nota_fiscal|^nf$|^id$|order_id)/.test(n);
  const scoreValue = window.dashScoreValueName;
  const measures = schema.filter(c => c.type === "measure");
  let value = null, bestScore = 0;
  for(const c of measures){ const sc = scoreValue(c.name); if(sc > bestScore){ bestScore = sc; value = c.name; } }
  if(!value){
    // No name matched: prefer a measure that isn't a qty/order id; only fall
    // back to the first raw measure as a last resort.
    const neutral = measures.find(c => scoreValue(c.name) === 0);
    value = (neutral && neutral.name) || (measures[0] && measures[0].name) || null;
  }
  // Order identifier (any type — IDs may be numeric or text). Drives the
  // unique-order denominator for Ticket Médio (BUG 4).
  const order = (schema.find(c => isOrderName(lc(c.name))) || {}).name || null;
  return {
    date:       pick(/^(data|date|dia|created|criado)/, "date") || (schema.find(c=>c.type==="date") || {}).name || null,
    value,
    order,
    product:    pick(/(produto|sku|item|product)/, "dimension"),
    region:     pick(/(regiao|região|region|estado|^uf$|state)/, "dimension"),
    channel:    pick(/(canal|channel|source|origem|fonte)/, "dimension"),
    seller:     pick(/(vendedor|seller|repr)/, "dimension"),
    category:   pick(/(categoria|category|family|tipo)/, "dimension"),
    qty:        pick(/(quantidade|qty|qtde|^qt$)/, "measure"),
    ticket:     pick(/(ticket|aov)/, "measure"),
    conversion: pick(/(convers|conv_)/, "measure"),
  };
}

/* Limpa os blocos de um preset montado sobre dados reais: tira KPI sem props,
 * gráfico sem pontos e ranking vazio; os KPIs restantes dividem a linha e, em
 * cada linha de gráficos que ficou incompleta, o último estica até fechar 12. */
function dashFitBlocks(blocks){
  const kept = (blocks || []).filter(b => {
    if(!b) return false;
    if(b.kind === "kpi") return !!b.props;
    if(b.kind === "chart") return !!(b.props && Array.isArray(b.props.data) && b.props.data.length);
    if(b.kind === "ranking") return !!(b.props && b.props.items && b.props.items.length);
    return true;
  }).map(b => ({ ...b }));
  const kpiSpan = { 1:12, 2:6, 3:4, 4:3 }[kept.filter(b => b.kind === "kpi").length];
  if(kpiSpan) kept.forEach(b => { if(b.kind === "kpi") b.span = kpiSpan; });
  const fill = (row, sum)=>{ if(row.length && sum < 12) row[row.length-1].span += 12 - sum; };
  for(let i = 0; i < kept.length;){
    if(kept[i].kind !== "chart"){ i++; continue; }
    let row = [], sum = 0;
    while(i < kept.length && kept[i].kind === "chart"){
      if(sum + kept[i].span > 12){ fill(row, sum); row = []; sum = 0; }
      row.push(kept[i]); sum += kept[i].span; i++;
    }
    fill(row, sum);
  }
  return kept;
}

function dashSum(rows, key){
  if(!key) return 0;
  let s = 0;
  for(const r of rows){ const v = r[key]; if(typeof v === "number") s += v; }
  return s;
}
function dashAvg(rows, key){
  if(!key || !rows.length) return 0;
  let s = 0, n = 0;
  for(const r of rows){ const v = r[key]; if(typeof v === "number"){ s += v; n++; } }
  return n ? s/n : 0;
}
function dashGroupSum(rows, dimKey, measureKey){
  if(!dimKey || !measureKey) return [];
  const map = new Map();
  for(const r of rows){
    const k = r[dimKey]; if(k == null) continue;
    const v = r[measureKey]; if(typeof v !== "number") continue;
    map.set(k, (map.get(k) || 0) + v);
  }
  return [...map.entries()].map(([l, v]) => ({ l, v }));
}
function dashTimeSeries(rows, dateKey, measureKey){
  if(!dateKey || !measureKey) return [];
  const map = new Map();
  for(const r of rows){
    const d = r[dateKey];
    if(!(d instanceof Date) || isNaN(d.getTime())) continue;
    // Chave pelos campos LOCAIS: toISOString (UTC) + new Date("AAAA-MM-DD")
    // (também UTC) rotulavam cada ponto com o dia anterior no Brasil (UTC−3).
    const k = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    const v = r[measureKey]; if(typeof v !== "number") continue;
    map.set(k, (map.get(k) || 0) + v);
  }
  return [...map.entries()].sort(([a],[b]) => a<b?-1:1).map(([k, v])=>{
    return { l: k.slice(8,10) + "/" + k.slice(5,7), v, date: k };
  });
}
function dashFilterByPeriod(rows, dateKey, days){
  if(!dateKey || days == null) return rows;
  // Laço em vez de Math.max.apply: com ~120k+ linhas o apply estoura a pilha
  // (RangeError) no meio do render e derruba a página inteira.
  let maxMs = -Infinity;
  for(const r of rows){
    const d = r[dateKey];
    if(d instanceof Date){ const t = d.getTime(); if(t > maxMs) maxMs = t; }
  }
  if(maxMs === -Infinity) return rows;
  const minMs = maxMs - days * 86400000;
  return rows.filter(r => {
    const d = r[dateKey];
    return d instanceof Date && d.getTime() >= minMs && d.getTime() <= maxMs;
  });
}

/* Fetch a real AI narrative from the backend (POST /tools/analyze via DashAPI).
 * O DashAPI anexa o Bearer (access token em memória) + cookie de refresh e faz
 * auto-refresh em 401. Resolve no payload da ferramenta ({ narrative, model }),
 * null em falha/402 (free → abre planos), ou { quotaExceeded } em 429 (quota do
 * mês). Só um sample limitado (≤20 linhas) + metadados de coluna saem do browser,
 * e só para planos pagos que pediram a análise (o tier/quota é reforçado no
 * servidor). */
async function dashFetchNarrative(profiles, metrics, sampleRows, datasetName, focus){
  try {
    // profiles = saída de dashProfileColumns: { name, baseType, pattern, stats,… }.
    // Mapeia pro contrato do backend {name, type}. Filtra colunas sem name string
    // não-vazio (o zod do backend exige name) → nunca manda name:""/undefined.
    const columns = (profiles || [])
      .filter(function(p){ return p && typeof p.name === "string" && p.name.trim() !== ""; })
      .map(function(p){ return { name: p.name, type: p.baseType || p.pattern || null }; });
    // Injeta os KPIs reais como contexto na pergunta (o backend lê
    // datasetName/columns/sampleRows/question — campos extras são ignorados).
    // Foco escrito na tela de métricas vai na frente; o backend aceita até 500 caracteres.
    const parts = [];
    if(focus && String(focus).trim()) parts.push("Foco pedido pelo usuario: " + String(focus).trim().slice(0, 200) + ".");
    if(metrics && metrics.length) parts.push("KPIs calculados: " + JSON.stringify(metrics));
    const question = parts.length ? parts.join(" ").slice(0, 500) : null;
    const result = await window.DashAPI.analyze({
      datasetName: datasetName,
      columns: columns,
      sampleRows: sampleRows,
      question: question,
    });
    return result; // { narrative, model }
  } catch(err){
    if(err && err.status === 402){            // plano insuficiente (ex.: plano venceu no meio da sessão)
      // Não navega sozinho para Planos (voltar remontava o dashboard, que pedia
      // de novo e quicava de volta). Reidrata o plano: com ele Free, o bloco
      // mostra o paywall normal.
      window.DashAPI.me().catch(function(){});
      return { planRequired: true };
    }
    if(err && err.status === 429){            // quota de IA do mês excedida
      return { quotaExceeded: true, limite: err.data && err.data.limite, usados: err.data && err.data.usados };
    }
    if(err && err.status === 401){            // sessão expirou: o me() falho zera o currentUser e o bloco pede login
      window.DashAPI.me().catch(function(){});
      return { authRequired: true };
    }
    console.error("Narrative fetch failed:", err);
    return null;
  }
}

// Bundled sample dataset — matches the column shape CLAUDE.md references for
// vendas_exemplo.csv (data/produto/canal/regiao/vendedor/receita/quantidade
// /ticket_medio/conversao/nps). 35 rows, sum ≈ R$ 1,57M.
const DASH_SAMPLE_CSV = [
  "data,produto,canal,regiao,vendedor,receita,quantidade,ticket_medio,conversao,nps",
  "2026-03-02,Esteira Coletora Auto,Marketplace,CO,Ana P.,52400,14,3742.86,0.048,72",
  "2026-03-04,Sistema Pesagem,Loja Física,NE,Bruno S.,38200,8,4775.00,0.052,68",
  "2026-03-06,Climatização Industrial,Marketplace,SE,Carla L.,61800,16,3862.50,0.051,75",
  "2026-03-08,Bandeja Inox,Site,Sul,Diego R.,18200,42,433.33,0.044,70",
  "2026-03-10,Esteira Coletora Auto,Loja Física,CO,Ana P.,48900,11,4445.45,0.046,73",
  "2026-03-13,Sistema Pesagem,Marketplace,SE,Eva M.,45600,9,5066.67,0.053,69",
  "2026-03-15,Climatização Industrial,Marketplace,NE,Bruno S.,57200,15,3813.33,0.050,74",
  "2026-03-17,Bandeja Inox,Marketplace,CO,Felipe T.,22100,52,425.00,0.045,71",
  "2026-03-19,Esteira Coletora Auto,Site,SE,Carla L.,46800,13,3600.00,0.047,72",
  "2026-03-22,Sistema Pesagem,Loja Física,Sul,Diego R.,41200,9,4577.78,0.049,67",
  "2026-03-24,Climatização Industrial,Marketplace,CO,Ana P.,64500,17,3794.12,0.052,76",
  "2026-03-26,Bandeja Inox,Loja Física,NE,Bruno S.,19800,46,430.43,0.043,69",
  "2026-03-28,Esteira Coletora Auto,Marketplace,SE,Eva M.,55600,15,3706.67,0.049,73",
  "2026-03-30,Sistema Pesagem,Marketplace,Sul,Felipe T.,42800,9,4755.56,0.051,68",
  "2026-04-02,Climatização Industrial,Site,CO,Carla L.,62300,16,3893.75,0.053,75",
  "2026-04-04,Bandeja Inox,Marketplace,SE,Ana P.,21400,49,436.73,0.046,72",
  "2026-04-06,Esteira Coletora Auto,Loja Física,NE,Diego R.,49800,13,3830.77,0.048,71",
  "2026-04-09,Sistema Pesagem,Marketplace,CO,Eva M.,46200,10,4620.00,0.054,69",
  "2026-04-11,Climatização Industrial,Marketplace,Sul,Bruno S.,58900,15,3926.67,0.050,74",
  "2026-04-13,Bandeja Inox,Site,SE,Felipe T.,20500,47,436.17,0.044,70",
  "2026-04-16,Esteira Coletora Auto,Marketplace,CO,Ana P.,53200,14,3800.00,0.049,73",
  "2026-04-18,Sistema Pesagem,Loja Física,NE,Carla L.,43800,9,4866.67,0.052,68",
  "2026-04-20,Climatização Industrial,Marketplace,SE,Diego R.,60100,16,3756.25,0.051,75",
  "2026-04-23,Bandeja Inox,Marketplace,Sul,Eva M.,22800,53,430.19,0.045,71",
  "2026-04-25,Esteira Coletora Auto,Site,CO,Bruno S.,50100,13,3853.85,0.047,72",
  "2026-04-27,Sistema Pesagem,Marketplace,SE,Felipe T.,44900,10,4490.00,0.053,69",
  "2026-05-01,Climatização Industrial,Loja Física,NE,Ana P.,59600,16,3725.00,0.050,74",
  "2026-05-03,Bandeja Inox,Marketplace,CO,Carla L.,21900,51,429.41,0.044,70",
  "2026-05-06,Esteira Coletora Auto,Marketplace,Sul,Diego R.,51800,14,3700.00,0.048,73",
  "2026-05-08,Sistema Pesagem,Site,SE,Eva M.,42600,9,4733.33,0.051,68",
  "2026-05-10,Climatização Industrial,Marketplace,CO,Bruno S.,63100,17,3711.76,0.052,76",
  "2026-05-13,Bandeja Inox,Loja Física,NE,Felipe T.,20100,46,436.96,0.045,69",
  "2026-05-15,Esteira Coletora Auto,Marketplace,SE,Ana P.,54300,14,3878.57,0.049,73",
  "2026-05-17,Sistema Pesagem,Marketplace,Sul,Carla L.,45200,10,4520.00,0.053,68",
  "2026-05-19,Climatização Industrial,Marketplace,CO,Diego R.,61700,16,3856.25,0.051,75",
].join("\n");

// Amostra JSON real (array de objetos) — usada no botão de exemplo ".json" para
// exercitar o suporte a JSON de verdade, em vez de fingir com o CSV.
const DASH_SAMPLE_JSON = JSON.stringify([
  { data:"2026-04-02", produto:"Mesa Ajustável",        canal:"Marketplace",  regiao:"CO", vendedor:"Ana P.",    receita:2980, quantidade:2,  ticket_medio:1490.00, conversao:0.21, nps:74 },
  { data:"2026-04-05", produto:"Notebook Pro 14",       canal:"Site",         regiao:"SE", vendedor:"Bruno S.",  receita:8120, quantidade:1,  ticket_medio:8120.00, conversao:0.18, nps:71 },
  { data:"2026-04-09", produto:"Cadeira Gamer",         canal:"Loja Física",  regiao:"NE", vendedor:"Carla L.",  receita:3460, quantidade:3,  ticket_medio:1153.33, conversao:0.16, nps:69 },
  { data:"2026-04-12", produto:"Fone Bluetooth",        canal:"Marketplace",  regiao:"Sul",vendedor:"Diego R.",  receita:1880, quantidade:8,  ticket_medio:235.00,  conversao:0.24, nps:73 },
  { data:"2026-04-16", produto:"Mouse Sem Fio",         canal:"Marketplace",  regiao:"CO", vendedor:"Eva M.",    receita:1240, quantidade:11, ticket_medio:112.73,  conversao:0.22, nps:70 },
  { data:"2026-04-20", produto:"Mesa Ajustável",        canal:"Site",         regiao:"SE", vendedor:"Felipe T.", receita:5960, quantidade:4,  ticket_medio:1490.00, conversao:0.20, nps:75 },
], null, 2);

function Topbar({ onClose, tweaks, fileInfo, currentUser, onSignIn, onSignUp, onSignOut, onProfile }){
  // Sem arquivo (tela de upload) não há o que mostrar no breadcrumb — antes
  // aparecia um "vendas_exemplo.csv" fictício.
  const fname = fileInfo?.name || null;
  const isPro = tweaks.plan === "pro";
  return (
    <div className="topbar">
      <div className="tb-row" style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"14px 24px", maxWidth: 1480, margin:"0 auto"}}>
        <div style={{display:"flex", alignItems:"center", gap:14, minWidth:0}}>
          <Icon.Logo size={28}/>
          <div className="tb-brand" style={{display:"flex", flexDirection:"column", lineHeight:1}}>
            <span style={{fontWeight:700, fontSize:14}}>{tweaks.brandName}</span>
            <span className="mono" style={{fontSize:10, color:"var(--muted)"}}>DASHBOARDS · IA</span>
          </div>
          {fname && (
            <div className="tb-crumb" style={{display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--muted)", minWidth:0}}>
              <div style={{width:1, height:24, background:"var(--line)", margin:"0 6px"}}/>
              <span>Workspace</span>
              <Icon.Caret size={12}/>
              <span style={{color:"var(--ink-2)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:260}}>{fname}</span>
            </div>
          )}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:10, flexShrink:0}}>
          <button className="btn btn-ghost" style={{padding:"8px 12px"}} onClick={onClose} title="Início" aria-label="Início"><Icon.Arrow size={14} style={{transform:"rotate(180deg)"}}/> <span className="tb-label">Início</span></button>
          {/* "Compartilhar" saiu: não havia handler (link público ainda não existe). */}
          {!isPro && (
            <button className="btn btn-primary" style={{padding:"8px 14px"}} onClick={()=> window.__dashUpgrade?.()} title="Fazer upgrade" aria-label="Fazer upgrade"><Icon.Crown size={14}/> <span className="tb-label">Fazer upgrade</span></button>
          )}
          <AuthBubble currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile} accent={tweaks.accent}/>
        </div>
      </div>
    </div>
  );
}

/* Mini sparklines / chart utilities for KPIs */
function KPI({ kpi, editing, onChange, onMove, onResize, onDelete, palette }){
  const { label, value, delta, deltaDir, sub, data, color, suffix, format } = kpi;
  const ref = React.useRef(null);
  const [vis, setVis] = React.useState(false);
  React.useEffect(()=>{
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVis(true); }, {threshold: 0.3});
    if(ref.current) io.observe(ref.current);
    return ()=> io.disconnect();
  },[]);
  // Animation target — the previous code did `parseFloat(value.replace(/[^0-9.]/g,""))`
  // which stripped the BR decimal comma, so "R$ 1,1M" became parseFloat("11") = 11
  // (a 10x display bug). Now we accept either a raw number (preferred — see
  // `format:"brl"` callers) or a BR-formatted string parsed comma-aware.
  const target = typeof value === "number" ? value : (()=>{
    let s = String(value).replace(/[^0-9,.\-]/g, "");
    if(/,/.test(s) && /\./.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if(/,/.test(s)) s = s.replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  })();
  const v = useCount(target, vis);
  // Format the animated raw number into the display string. `format:"brl"` is
  // the clean path: callers pass the underlying amount and the formatter picks
  // the M / k / raw tier from the animated value at each frame. Legacy string
  // callers still work via the fallback branches; we preserve a trailing
  // "M"/"k" from the source value so pre-scaled labels like "R$ 1,1M" keep
  // their suffix in the display.
  let display;
  // Valor textual ("Segunda", "SP") não tem o que animar: mostra como veio.
  if(typeof value === "string" && !/\d/.test(value)){
    display = value;
  } else if(format === "brl"){
    const abs = Math.abs(v);
    if(abs >= 1e6)      display = "R$ " + (v/1e6).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "M";
    else if(abs >= 1e3) display = "R$ " + (v/1e3).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "k";
    else                display = "R$ " + Math.round(v).toLocaleString("pt-BR");
  } else if(format === "pct"){
    display = v.toLocaleString("pt-BR", {maximumFractionDigits:1}) + (suffix || "%");
  } else if(format === "scale"){
    display = v.toLocaleString("pt-BR", {maximumFractionDigits:1}) + (suffix || "");
  } else if(format === "int"){
    display = Math.round(v).toLocaleString("pt-BR");
  } else if(typeof value === "number"){
    display = Math.round(v).toLocaleString("pt-BR");
  } else if(typeof value === "string" && value.includes("R$")){
    const brlSuffix = (String(value).match(/[MmKk]$/) || [""])[0];
    display = "R$ " + v.toLocaleString("pt-BR", {maximumFractionDigits:1}) + brlSuffix;
  } else {
    display = v.toFixed(1) + (suffix || "");
  }
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
          <input value={typeof value === "number" ? String(Math.round(value*100)/100) : value} onChange={e=>set({value:e.target.value})} style={{
            padding:"2px 6px", border:"1px dashed var(--line)", borderRadius:6,
            fontSize:24, fontWeight:800, letterSpacing:"-.02em", outline:"none", background:"transparent",
            fontFamily:"inherit", width:"min(140px, 100%)"
          }}/>
        ) : (
          <span className="ticker" style={{fontSize:28, fontWeight:800, letterSpacing:"-.02em"}}>{display}</span>
        )}
        {/* Sem variação calculada ("—") o chip "▲ —" só fazia ruído. */}
        {(editing || (delta && delta !== "—")) && (
          <span className="chip mono" style={{
            background: deltaDir==="up" ? "#e7f7ef" : "#fde7ee",
            color: deltaDir==="up" ? "#0a8a4a" : "#c9234a", fontSize:11, cursor: editing?"pointer":"default"
          }} onClick={()=> editing && set({deltaDir: deltaDir==="up"?"down":"up"})}>
            {deltaDir==="up" ? "▲" : "▼"} {delta}
          </span>
        )}
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
          {!editing && dim && <span className="chip mono cc-meta" style={{background:"var(--line-2)"}}>{dim}</span>}
          {!editing && agg && <span className="chip mono cc-meta" style={{background:"var(--line-2)"}}>{agg}</span>}
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
          <DonutLegend data={data} height={height} color={chart.color || color} unit={chart.unit}/>
        )}
      </div>
    </div>
  );
}

/* Live AI narrative card — renders the real Gemini analysis returned by the
 * gemini-narrative Edge Function. `live` is { data, loading, error, onReload }
 * driven by the Dashboard. Mirrors the visual language of <Insights> (the card
 * it replaces for Pro users with a real upload) so the section stays familiar:
 * executive summary + insight cards + numbered recommendations. The Edge
 * Function may return list items as plain strings OR objects, so we normalize
 * both — never assume a shape that could render `undefined` into the tree. */
// Cache da sessão: narrativa por base (chave = arquivo + forma das colunas).
// Sobrevive a remontagens do Dashboard (ir à Conta e voltar não gasta cota).
const _dashNarrativeCache = new Map();

// anon: visitante sem conta — a análise grátis (1/mês) exige conta, então o
// bloco vira convite de cadastro em vez de chamar a API.
function AINarrative({ tweaks, live, limits, anon }){
  const accent = tweaks.accent;
  const isFreePlan = tweaks.plan === "free";
  const data = (live && live.data) || null;
  const loading = !!(live && live.loading);
  const error = !!(live && live.error);
  // Cota já gasta segundo o /me: mostra o card de limite sem gastar uma chamada.
  const used = limits && limits.aiUsed != null ? limits.aiUsed : null;
  const cap = limits && limits.aiMonthly != null ? limits.aiMonthly : null;
  const exhausted = !anon && used != null && cap != null && used >= cap;
  const quota = (live && live.quota) || (exhausted ? { usados: used, limite: cap } : null);
  const signup = ()=> window.__dashOpenAuth && window.__dashOpenAuth("signup");
  const reload = ()=> {
    if(anon){ signup(); return; }
    if(live && live.onReload) live.onReload();
  };

  const norm = (arr)=> (Array.isArray(arr) ? arr : []).map(it => {
    if(typeof it === "string") return { title:null, detail:it };
    if(it && typeof it === "object") return {
      title: it.title || it.titulo || it.label || it.name || it.heading || null,
      detail: it.detail || it.description || it.descricao || it.text || it.texto || it.body ||
              (typeof it.value === "string" ? it.value : "") || ""
    };
    return { title:null, detail:String(it) };
  }).filter(x => (x.title && String(x.title).trim()) || (x.detail && String(x.detail).trim()));

  const summary  = data ? (data.narrative || data.resumo || data.summary || data.rawText || "") : "";
  const insights = data ? norm(data.insights) : [];
  const recs     = data ? norm(data.recommendations || data.recomendacoes || data.recs) : [];

  const Header = (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:12}}>
      <div style={{display:"flex", alignItems:"center", gap:12}}>
        <div style={{width:40, height:40, borderRadius:10, background:`linear-gradient(135deg, ${accent}, var(--violet))`, display:"flex", alignItems:"center", justifyContent:"center", color:"white"}}>
          <Icon.Sparkle size={20}/>
        </div>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontWeight:700, fontSize:16}}>Análise por IA</span>
            <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)", fontSize:11}}>Gemini</span>
          </div>
          <div style={{fontSize:12, color:"var(--muted)", marginTop:2, display:"inline-flex", alignItems:"center", gap:5}}>
            <Icon.Sparkle size={10}/> Análise gerada por IA
          </div>
        </div>
      </div>
      {!anon && !quota && data && (
        <button className="btn btn-ghost no-export" style={{padding:"6px 12px", fontSize:13, opacity: loading ? 0.6 : 1}} disabled={loading}
          onClick={reload} title="Gerar uma nova análise com a IA">
          <Icon.Refresh size={12}/> {loading ? "Gerando…" : data ? "Recarregar análise" : "Gerar análise"}
        </button>
      )}
    </div>
  );

  // Visitante: a análise grátis precisa de conta (a cota é por usuário).
  if(anon && !data){
    return (
      <div className="card soft-shadow" style={{padding:24, marginBottom:20}}>
        {Header}
        <div style={{padding:"18px 20px", border:"1px dashed var(--line)", borderRadius:12, background:"#fafbfe", display:"flex", gap:16, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{flex:"1 1 320px", fontSize:13, color:"var(--ink-2)", lineHeight:1.55}}>
            <div style={{fontWeight:700, marginBottom:4}}>Crie uma conta grátis e gere 1 análise por mês</div>
            A IA escreve um resumo executivo, insights e recomendações a partir desta base. Sem cartão de crédito. Seus dados continuam aqui enquanto você cria a conta.
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button className="btn btn-primary" onClick={signup}><Icon.Sparkle size={13}/> Criar conta grátis</button>
            <button className="btn btn-ghost" onClick={()=> window.__dashOpenAuth && window.__dashOpenAuth("login")}>Já tenho conta</button>
          </div>
        </div>
      </div>
    );
  }

  // Loading skeleton — only when there's nothing to show yet. A reload with
  // existing data keeps the previous content visible (button shows "Gerando…").
  if(loading && !data){
    return (
      <div className="card soft-shadow" style={{padding:24, marginBottom:20}}>
        {Header}
        <div style={{display:"flex", alignItems:"center", gap:10, color:"var(--muted)", fontSize:13, marginBottom:14}}>
          <span style={{width:16, height:16, borderRadius:"50%", border:"2px solid var(--line)", borderTopColor:accent, display:"inline-block", animation:"narrSpin 1s linear infinite"}}/>
          Gerando análise…
          <style>{`@keyframes narrSpin{ to{ transform: rotate(360deg); } } @keyframes narrShimmer{ 0%,100%{ opacity:.45; } 50%{ opacity:1; } }`}</style>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          {[92, 82, 70].map((w,i)=>(
            <div key={i} style={{height:14, width:w+"%", borderRadius:7, background:"var(--line-2)", animation:"narrShimmer 1.4s ease-in-out infinite", animationDelay:(i*0.15)+"s"}}/>
          ))}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:8}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{height:62, borderRadius:12, background:"var(--line-2)", animation:"narrShimmer 1.4s ease-in-out infinite", animationDelay:(i*0.12)+"s"}}/>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Quota state — monthly AI limit reached. Distinct from the generic error:
  // offers an upgrade CTA instead of "try again". Rendered BEFORE error/idle.
  if(quota && !data){
    return (
      <div className="card soft-shadow" style={{padding:24, marginBottom:20}}>
        {Header}
        <div style={{padding:"18px 20px", borderRadius:12, background:"var(--brand-soft)", border:"1px solid var(--line)", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap"}}>
          <div style={{width:36, height:36, borderRadius:9, background:"#fff", color:"var(--brand-2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
            <Icon.Sparkle size={16}/>
          </div>
          <div style={{flex:1, minWidth:200}}>
            <div style={{fontWeight:700, fontSize:14, color:"var(--brand-2)"}}>
              {isFreePlan ? "Você já usou a análise grátis deste mês" : "Limite de análises deste mês atingido"}
            </div>
            <div style={{fontSize:13, color:"var(--ink-2)", marginTop:2}}>
              {isFreePlan
                ? "Ela renova no dia 1º. No Essencial são 50 análises por mês e no Pro, 300."
                : "Você usou " + (quota.usados != null ? quota.usados : "—") + " de " + (quota.limite != null ? quota.limite : "—") + " análises. A cota renova no dia 1º; faça upgrade para continuar agora."}
            </div>
          </div>
          <button className="btn btn-primary" style={{padding:"8px 14px"}} onClick={()=> window.__dashOpenPlans && window.__dashOpenPlans()}>
            <Icon.Arrow size={13}/> Ver planos
          </button>
        </div>
      </div>
    );
  }

  // Error state — friendly message + retry, never a blank card.
  if(error && !data){
    return (
      <div className="card soft-shadow" style={{padding:24, marginBottom:20}}>
        {Header}
        <div style={{padding:"18px 20px", borderRadius:12, background:"#fff7f9", border:"1px solid #ffd2dd", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap"}}>
          <div style={{width:36, height:36, borderRadius:9, background:"#ffe3ea", color:"#c9234a", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
            <Icon.Bolt size={16}/>
          </div>
          <div style={{flex:1, minWidth:200}}>
            <div style={{fontWeight:700, fontSize:14, color:"#c9234a"}}>Não foi possível gerar a análise agora</div>
            <div style={{fontSize:13, color:"var(--ink-2)", marginTop:2}}>Verifique sua conexão e tente novamente em instantes.</div>
          </div>
          <button className="btn btn-primary" style={{padding:"8px 14px"}} onClick={reload}>
            <Icon.Refresh size={13}/> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Idle — nada é enviado até o clique. O aviso diz exatamente o que sai do
  // navegador (dashFetchNarrative: colunas, KPIs e até 20 linhas) e o custo.
  if(!data){
    const focus = live && live.focus;
    return (
      <div className="card soft-shadow ai-idle" style={{padding:"18px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
        background:`linear-gradient(90deg, color-mix(in oklch, ${accent} 6%, white), white 55%)`}}>
        <div style={{width:44, height:44, borderRadius:12, flexShrink:0, background:`linear-gradient(135deg, ${accent}, var(--violet))`, display:"flex", alignItems:"center", justifyContent:"center", color:"white"}}>
          <Icon.Sparkle size={20}/>
        </div>
        <div style={{flex:"1 1 360px", minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <span style={{fontWeight:700, fontSize:15}}>Análise por IA</span>
            <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)", fontSize:11}}>Gemini</span>
            {cap != null && <span style={{fontSize:12, color:"var(--muted)"}}>
              {isFreePlan
                ? "1 análise grátis por mês" + (used != null ? ` · ${used} de ${cap} usada${cap === 1 ? "" : "s"}` : "")
                : "Usa 1 da sua cota mensal" + (used != null ? ` · ${used} de ${cap} usadas` : "")}
            </span>}
          </div>
          <div style={{fontSize:13, color:"var(--ink-2)", lineHeight:1.5, marginTop:3}}>
            Resumo executivo, insights e recomendações sobre esta base{focus ? <> com foco em <b>“{focus}”</b></> : null}.
            {" "}<span style={{color:"var(--muted)"}}>Envia ao Google Gemini os nomes das colunas, os indicadores e até 20 linhas; o resto do arquivo fica no seu navegador.</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={reload} style={{flexShrink:0}}><Icon.Sparkle size={13}/> Gerar análise</button>
      </div>
    );
  }

  // Success.
  return (
    <div className="card soft-shadow" style={{padding:24, marginBottom:20}}>
      {Header}

      {live && live.quota && (
        <div className="no-export" style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", padding:"10px 14px", marginBottom:14, borderRadius:10, background:"var(--brand-soft)", fontSize:13, color:"var(--ink-2)"}}>
          <span style={{flex:1, minWidth:200}}>Limite de análises deste mês atingido. A análise abaixo continua disponível.</span>
          <button className="btn btn-ghost" style={{padding:"6px 12px", fontSize:12}} onClick={()=> window.__dashOpenPlans && window.__dashOpenPlans()}>Ver planos</button>
        </div>
      )}

      {summary && (
        <div style={{padding:"16px 18px", background:"#fafbfe", border:"1px solid var(--line-2)", borderRadius:12, marginBottom:14}}>
          <div className="mono" style={{fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:".08em", marginBottom:6}}>RESUMO</div>
          <p style={{margin:0, color:"var(--ink-2)", fontSize:14, lineHeight:1.6, whiteSpace:"pre-wrap"}}>{summary}</p>
        </div>
      )}

      {insights.length > 0 && (
        <div style={{marginBottom: recs.length ? 16 : 0}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
            <Icon.Idea size={14} color={accent}/>
            <span style={{fontWeight:700, fontSize:14}}>Insights</span>
            <span className="chip mono" style={{padding:"0 6px", fontSize:10, background:"var(--brand-soft)", color:"var(--brand-2)"}}>{insights.length}</span>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10}}>
            {insights.map((it,i)=>(
              <div key={i} style={{padding:"14px 16px", borderRadius:12, border:"1px solid var(--line)", background:"white", display:"flex", gap:12, alignItems:"flex-start"}}>
                <div style={{width:28, height:28, borderRadius:8, flexShrink:0, background:`color-mix(in oklch, ${accent} 14%, white)`, color:accent, display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Sparkle size={13}/>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  {it.title && <div style={{fontWeight:700, fontSize:14, marginBottom:3}}>{it.title}</div>}
                  {it.detail && <div style={{fontSize:13, color:"var(--ink-2)", lineHeight:1.5}}>{it.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
            <Icon.Check size={14} stroke={2.6} color="#0a8a4a"/>
            <span style={{fontWeight:700, fontSize:14}}>Recomendações</span>
            <span className="chip mono" style={{padding:"0 6px", fontSize:10, background:"#e7f7ef", color:"#0a8a4a"}}>{recs.length}</span>
          </div>
          <ol style={{listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:8}}>
            {recs.map((it,i)=>(
              <li key={i} style={{display:"flex", gap:12, alignItems:"flex-start", padding:"12px 14px", border:"1px solid var(--line)", borderRadius:12, background:"#fafbfe"}}>
                <span style={{width:24, height:24, borderRadius:7, flexShrink:0, background:"var(--ink)", color:"white", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700}}>{i+1}</span>
                <div style={{flex:1, minWidth:0}}>
                  {it.title && <div style={{fontWeight:700, fontSize:14, marginBottom:2}}>{it.title}</div>}
                  {it.detail && <div style={{fontSize:13, color:"var(--ink-2)", lineHeight:1.5}}>{it.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!summary && !insights.length && !recs.length && (
        <div style={{padding:18, textAlign:"center", color:"var(--muted)", fontSize:13, border:"1px dashed var(--line-2)", borderRadius:12}}>
          A IA não retornou conteúdo para esta base. Tente recarregar a análise.
        </div>
      )}

      <div style={{display:"flex", alignItems:"center", gap:6, marginTop:14, paddingTop:12, borderTop:"1px dashed var(--line-2)", fontSize:11, color:"var(--muted)"}}>
        <Icon.Sparkle size={11}/> Conteúdo gerado por inteligência artificial · pode conter imprecisões.
      </div>
    </div>
  );
}

function Insights({ tweaks, onAddChart, generated }){
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

  // Data-driven mode: when the dashboard passes `generated` (the insight items
  // from dashGenerateBlocks), build the strip + tabs + summary from real data
  // instead of the hardcoded sales demo. Falls back to the demo otherwise.
  const isGen = Array.isArray(generated) && generated.length > 0;
  const catColor = (c)=> ({ comparison:"var(--brand)", trend:"#0a8a4a", outlier:"#ff7849", risk:"#c9234a", action:"#7a5cff" }[c] || "var(--brand)");
  const genTabs = isGen ? {
    insights: generated.filter(it => it.cat === "comparison" || it.cat === "trend" || it.cat === "outlier"),
    risks:    generated.filter(it => it.cat === "risk" || it.risk),
    recs:     generated.filter(it => it.cat === "action"),
  } : null;
  const tabsData = isGen ? genTabs : tabs;
  const hlUse = isGen
    ? generated.slice(0, 4).map(it => ({ l: it.tag, v: it.ev, s: String(it.t).length > 26 ? String(it.t).slice(0,25)+"…" : it.t, c: catColor(it.cat) }))
    : highlights;
  const genSummary = isGen ? ("Painel gerado automaticamente a partir dos seus dados: " + generated.slice(0,3).map(it => it.t).join("; ") + ".") : null;
  const cur = (tabsData[tab]) || [];

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
            <div style={{fontSize:12, color:"var(--muted)", marginTop:2}}>{tabsData.insights.length + tabsData.risks.length + tabsData.recs.length} insights · gerados há 2 min</div>
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
          {isGen ? (
            <p style={{margin:0, color:"var(--ink-2)", fontSize:14, lineHeight:1.55}}>{genSummary}</p>
          ) : (
            <p style={{margin:0, color:"var(--ink-2)", fontSize:14, lineHeight:1.55}}>
              Panorama saudável de vendas com forte expressão em <b>Móveis</b> e <b>Eletrônicos</b>, dominância do canal <b>Marketplace</b> e crescimento sustentado em <b>Centro-Oeste</b>. Há sinal de alerta no <b>ticket médio</b>, que recuou 23%, e dependência de poucos SKUs no topo.
            </p>
          )}
        </div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
          {hlUse.map(h=>(
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
          {k:"insights", n:"Insights", c: tabsData.insights.length},
          {k:"risks", n:"Riscos & Atenção", c: tabsData.risks.length},
          {k:"recs", n:"Recomendações", c: tabsData.recs.length},
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
      {cur.length === 0 && (
        <div style={{padding:"18px", textAlign:"center", color:"var(--muted)", fontSize:13, border:"1px dashed var(--line-2)", borderRadius:12}}>
          Nenhum item nesta categoria para os dados atuais.
        </div>
      )}
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

function Dashboard({ onClose, tweaks, fileInfo, currentUser, onSignIn, onSignUp, onSignOut, onProfile, onPersist }){
  // Dashboard salvo (dashboard-saved.jsx): reabre com o layout, o período e a
  // visão de quando foi deixado.
  const savedLayout = (fileInfo && fileInfo.savedLayout) || null;
  // Real upload → abre em "Tudo" para mostrar TODOS os dados de cara (não uma
  // janela de 90d que descartaria linhas silenciosamente). O caminho de demo
  // sem upload mantém "90d". Lazy init: roda só no mount.
  const [period, setPeriod] = React.useState(()=>
    (savedLayout && ["7d","30d","90d","all"].includes(savedLayout.period)) ? savedLayout.period
    : (fileInfo && fileInfo.data && fileInfo.data.length) ? "all" : "90d");
  const [editing, setEditing] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [paywallReason, setPaywallReason] = React.useState(null); // null | "edit" | "add" | "insights" | "advanced"

  const isFree = tweaks.plan === "free";   // pago (essencial OU pro) libera a análise
  const [shareOpen, setShareOpen] = React.useState(false);
  // Gate central (CLAUDE.md §5). Quase tudo libera a partir do Essencial; o link
  // público é o único recurso exclusivo do Pro.
  const requirePro = (reason)=>{
    const blocked = reason === "share" ? tweaks.plan !== "pro" : isFree;
    if(blocked){ setPaywallReason(reason); return true; }
    return false;
  };
  // Auto-close editing if downgraded to free
  React.useEffect(()=>{ if(isFree && editing) setEditing(false); }, [isFree]);

  // Period config — `days:null` means no time window (include everything).
  const periodConfig = {
    "7d":  { days: 7,    label:"Últimos 7 dias",   rowsPct: 0.18 },
    "30d": { days: 30,   label:"Últimos 30 dias",  rowsPct: 0.55 },
    "90d": { days: 90,   label:"Últimos 90 dias",  rowsPct: 1.00 },
    "all": { days: null, label:"Todo o período",   rowsPct: 1.00 },
  };
  const periodMeta = periodConfig[period] || periodConfig["90d"];

  // ── Data layer ─────────────────────────────────────────────────────────
  // Real dataset comes from UploadView via fileInfo. Columns are resolved by
  // heuristics (dashResolveColumns) so we don't hardcode "valor_total" etc.
  // When the user reaches this view via Tweaks without uploading, hasRealData
  // is false and the existing mock arrays below take over.
  const dataset = React.useMemo(()=> (fileInfo && fileInfo.data) || [], [fileInfo]);
  const baseSchema = React.useMemo(()=> (fileInfo && fileInfo.schema) || [], [fileInfo]);
  const dataCols = React.useMemo(()=> dashResolveColumns(baseSchema), [baseSchema]);
  // isUpload: o usuário trouxe dados (upload ou demonstração). Daqui pra baixo,
  // com isUpload os arrays de exemplo NUNCA entram — bloco sem dado real some.
  // hasRealData exige também uma coluna de valor (alimenta realAgg).
  const isUpload = dataset.length > 0;
  const hasRealData = isUpload && !!dataCols.value;
  // Filtra sempre que houver dados — antes, base sem coluna numérica virava []
  // e o pipeline de descoberta rodava sobre zero linhas.
  const filteredData = React.useMemo(()=>{
    if(!isUpload) return [];
    return (periodMeta.days != null && dataCols.date)
      ? dashFilterByPeriod(dataset, dataCols.date, periodMeta.days)
      : dataset;
  }, [dataset, dataCols.date, periodMeta.days, isUpload]);

  const totalRows = (fileInfo && fileInfo.rows) || (isUpload ? dataset.length : 120);
  const rowsForPeriod = isUpload
    ? filteredData.length
    : Math.max(8, Math.round(totalRows * periodMeta.rowsPct));

  // ── Data-driven discovery layer ─────────────────────────────────────────
  // Profiles come from the upload (computed on raw rows). The new pipeline
  // (profile → suggest → generate) drives the "Descoberta" view when it is
  // confident AND the data isn't a classic sales shape. Sales/sample CSVs and
  // low-confidence data keep the existing realAgg/mock presets (no regression).
  const profiles = React.useMemo(()=> (fileInfo && fileInfo.profiles) || [], [fileInfo]);
  const presetCompat = React.useMemo(()=> window.dashPresetCompat ? window.dashPresetCompat(profiles) : { salesShape:false }, [profiles]);
  const suggestedMetrics = React.useMemo(()=>
    (profiles.length && window.dashSuggestMetrics) ? window.dashSuggestMetrics(profiles, dataset) : [],
    [profiles, dataset]);
  // Métricas marcadas na tela anterior (PromptView). null = todas (padrão).
  const metricPick = (fileInfo && Array.isArray(fileInfo.metricPick)) ? fileInfo.metricPick : null;
  const pickedMetrics = React.useMemo(()=>{
    if(!metricPick || !window.dashMetricKey) return suggestedMetrics;
    const want = new Set(metricPick);
    return suggestedMetrics.filter((m, i)=> want.has(window.dashMetricKey(m, i)));
  }, [suggestedMetrics, metricPick]);
  const generatedAll = React.useMemo(()=>
    (profiles.length && window.dashGenerateBlocks) ? window.dashGenerateBlocks(profiles, suggestedMetrics, filteredData) : null,
    [profiles, suggestedMetrics, filteredData]);
  const generated = React.useMemo(()=>
    (metricPick && profiles.length && window.dashGenerateBlocks) ? window.dashGenerateBlocks(profiles, pickedMetrics, filteredData) : generatedAll,
    [metricPick, profiles, pickedMetrics, filteredData, generatedAll]);
  // A confiança vem da base inteira: marcar menos métricas não troca o modo do painel.
  const useGenerated = !!(generatedAll && generatedAll.overallConfidence > 0.7 && generated && (generated.kpis.length || generated.charts.length));
  const salesShape = !!presetCompat.salesShape;
  const hasDatetimeProfile = profiles.some(p => p.pattern === "datetime");
  // Descoberta leads only when generated AND not a sales shape; sales data keeps
  // its tailored presets so the sample CSV stays byte-for-byte the same.
  // Base sem coluna de valor não alimenta os presets de vendas: se a descoberta
  // gerou algo, ela lidera mesmo abaixo do limiar de confiança.
  const dataDrivenMode = (useGenerated && !salesShape) ||
    (isUpload && !hasRealData && !!(generated && (generated.kpis.length || generated.charts.length)));

  // ── AI narrative (Gemini Edge Function) ─────────────────────────────────
  // The real narrative replaces the mock "Análises da IA" for any signed-in
  // user with a real upload (Free = 1/month, enforced by the backend quota).
  // Anonymous visitors get a signup prompt and nothing is sent. Cached by the profile
  // shape (column name + pattern) so it doesn't refire when the period changes;
  // the "Recarregar análise" button forces a fresh call.
  const [narrative, setNarrative] = React.useState(null);
  const [narrativeLoading, setNarrativeLoading] = React.useState(false);
  const [narrativeError, setNarrativeError] = React.useState(false);
  const [narrativeQuota, setNarrativeQuota] = React.useState(null); // null | { usados, limite }
  const narrativeKeyRef = React.useRef(null); // profile shape of the cached result
  const narrativeReqRef = React.useRef(0);    // guards against stale responses
  const narrativeKey = React.useMemo(()=>{
    if(!isUpload || !profiles.length) return null;
    return ((fileInfo && fileInfo.name) || "dados") + "::" + profiles.map(p => p.name + ":" + p.pattern).join("|");
  }, [isUpload, profiles, fileInfo]);

  // A IA só roda com clique explícito (CLAUDE.md §8/§14: nada de dados crus
  // para a IA sem opt-in) — antes ela disparava sozinha ao abrir o dashboard,
  // a cada remontagem e de novo se o período mudasse com a 1ª chamada em voo,
  // gastando cota. O resultado fica no cache da sessão por base de dados.
  // Um dashboard salvo traz a narrativa junto: reabrir não gasta cota.
  React.useEffect(()=>{
    const cached = narrativeKey && (_dashNarrativeCache.get(narrativeKey) || (fileInfo && fileInfo.savedNarrative) || null);
    if(cached){
      _dashNarrativeCache.set(narrativeKey, cached);
      narrativeKeyRef.current = narrativeKey;
      setNarrative(cached);
    }
  }, [narrativeKey]);

  const loadNarrative = React.useCallback((force)=>{
    if(!narrativeKey || narrativeLoading || !currentUser) return; // a cota é por conta (Free = 1/mês)
    if(!force && narrativeKeyRef.current === narrativeKey) return; // same data → keep cache
    const reqId = ++narrativeReqRef.current;
    setNarrativeLoading(true); setNarrativeError(false); setNarrativeQuota(null);
    // Real KPI values give the model concrete numbers to narrate; sampleRows is
    // a small, representative slice (period-independent so the cache stays warm).
    const metricsPayload = (generated && Array.isArray(generated.kpis) ? generated.kpis : [])
      .map(k => ({ label: k.props.label, value: k.props.value, format: k.props.format }));
    const sampleRows = dataset.slice(0, 20);
    dashFetchNarrative(profiles, metricsPayload, sampleRows, (fileInfo && fileInfo.name) || "dados", fileInfo && fileInfo.aiFocus)
      .then(result => {
        if(reqId !== narrativeReqRef.current) return; // a newer request superseded this one
        if(result && result.quotaExceeded){ // 429 — quota do mês esgotada: card de upgrade, não erro genérico
          setNarrativeQuota({ usados: result.usados, limite: result.limite });
          setNarrativeError(false); setNarrativeLoading(false);
          return;
        }
        if(result && result.planRequired){ setNarrativeError(true); setNarrativeLoading(false); return; }
        if(result && result.authRequired){ setNarrativeLoading(false); return; } // currentUser vira null → bloco pede login
        const ok = result && (result.narrative || result.rawText ||
          (Array.isArray(result.insights) && result.insights.length) ||
          (Array.isArray(result.recommendations) && result.recommendations.length));
        if(ok){
          narrativeKeyRef.current = narrativeKey;
          _dashNarrativeCache.set(narrativeKey, result);
          setNarrative(result); setNarrativeError(false);
          window.dashTrack && window.dashTrack("analise_ia", { plano: tweaks.plan });
          window.DashAPI.me().catch(()=>{}); // atualiza o contador de uso (limits.aiUsed)
        }
        else { setNarrativeError(true); }
        setNarrativeLoading(false);
      })
      .catch(()=>{ // dashFetchNarrative already swallows errors, but stay defensive
        if(reqId === narrativeReqRef.current){ setNarrativeError(true); setNarrativeLoading(false); }
      });
  }, [narrativeKey, narrativeLoading, profiles, dataset, generated, fileInfo, currentUser, tweaks.plan]);

  // Drag state
  const [dragId, setDragId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null); // { id, position: 'before'|'after' }

  const dims = [
    {k:"data", n:"data"}, {k:"produto", n:"produto"}, {k:"categoria", n:"categoria"},
    {k:"regiao", n:"regiao"}, {k:"vendedor", n:"vendedor"}, {k:"canal", n:"canal"},
  ];
  const aggs = [{k:"sum", n:"Soma"}, {k:"avg", n:"Média"}, {k:"count", n:"Contagem"}, {k:"max", n:"Máx"}, {k:"min", n:"Mín"}];
  const palette = ["#2f6bff","#0a8a4a","#7a5cff","#ff7849","#ff5e93","#0b1020"];

  // ── Aggregations ───────────────────────────────────────────────────────
  // realAgg is null when there's no upload. Mock arrays below act as fallback.
  const realAgg = React.useMemo(()=>{
    if(!hasRealData) return null;
    const tend = dashTimeSeries(filteredData, dataCols.date, dataCols.value);
    const prod = dataCols.product ? dashGroupSum(filteredData, dataCols.product, dataCols.value).sort((a,b)=>b.v-a.v) : [];
    const reg  = dataCols.region  ? dashGroupSum(filteredData, dataCols.region,  dataCols.value).sort((a,b)=>b.v-a.v) : [];
    const totalAll = dashSum(filteredData, dataCols.value);
    const chanRaw = dataCols.channel ? dashGroupSum(filteredData, dataCols.channel, dataCols.value).sort((a,b)=>b.v-a.v) : [];
    const chan = totalAll ? chanRaw.map(c=>({ l: c.l, v: Math.round(c.v/totalAll*100) })) : chanRaw;
    const top = prod.slice(0, 5);
    const maxV = (top[0] && top[0].v) || 1;
    const ranking = top.map(p => {
      const row = dataCols.product ? filteredData.find(r => r[dataCols.product] === p.l) : null;
      return {
        n: String(p.l),
        c: (row && dataCols.category && row[dataCols.category]) || "—",
        v: p.v,
        pct: Math.round(p.v/maxV*100),
        s: totalAll ? Math.round(p.v/totalAll*1000)/10 : null, // participação no total (%)
      };
    });
    // Period-over-period delta: split sorted-by-date in halves.
    const sorted = [...filteredData].sort((a,b)=>{
      const da = a[dataCols.date] instanceof Date ? a[dataCols.date].getTime() : 0;
      const db = b[dataCols.date] instanceof Date ? b[dataCols.date].getTime() : 0;
      return da - db;
    });
    const mid = Math.floor(sorted.length/2);
    const prev = sorted.slice(0, mid), cur = sorted.slice(mid);
    const prevSum = dashSum(prev, dataCols.value), curSum = dashSum(cur, dataCols.value);
    const totalDelta = prevSum ? (curSum - prevSum)/prevSum * 100 : 0;
    // Ticket Médio denominator = distinct orders, not row count. When the CSV is
    // one row per *item* (multi-item orders), dividing by rows gives the per-item
    // average; dividing by distinct order IDs gives "receita média por pedido" —
    // the business-relevant metric. With no order column (one row = one order)
    // this collapses back to the row count, so order-level data is unchanged.
    const countOrders = (rows)=> dataCols.order
      ? new Set(rows.map(r => r[dataCols.order]).filter(v => v != null && v !== "")).size
      : rows.length;
    const uniqueOrders = countOrders(filteredData);
    const prevOrders = countOrders(prev), curOrders = countOrders(cur);
    const prevAvg = prevOrders ? prevSum/prevOrders : 0;
    const curAvg  = curOrders  ? curSum/curOrders   : 0;
    const ticketDelta = prevAvg ? (curAvg - prevAvg)/prevAvg * 100 : 0;
    const countDelta  = prevOrders ? (curOrders - prevOrders)/prevOrders * 100 : 0;
    // Conversion: dashAvg gives the raw column mean. CSVs may store the value
    // as a decimal (0.216 = 21,6 %) or already as a percentage (21.6). Detect
    // by magnitude: < 1 → multiply by 100, otherwise treat as already %.
    const convRaw = dataCols.conversion ? dashAvg(filteredData, dataCols.conversion) : null;
    const convAvg = convRaw == null ? null : (Math.abs(convRaw) < 1 ? convRaw * 100 : convRaw);
    const ticketMedio = uniqueOrders ? totalAll/uniqueOrders : 0;
    // Seller grouping (Top vendedores chart in advanced view).
    const vendedores = dataCols.seller
      ? dashGroupSum(filteredData, dataCols.seller, dataCols.value).sort((a,b)=>b.v-a.v)
      : [];
    // Day-of-week aggregation (Mon → Sun) for the dow chart.
    const dow = dataCols.date ? (()=>{
      const labels = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
      const buckets = labels.map(l => ({ l, v: 0 }));
      for(const r of filteredData){
        const d = r[dataCols.date]; if(!(d instanceof Date)) continue;
        const val = r[dataCols.value]; if(typeof val !== "number") continue;
        // JS: Sun=0..Sat=6 — shift so Mon=0..Sun=6
        buckets[(d.getDay() + 6) % 7].v += val;
      }
      return buckets;
    })() : [];
    // Monthly aggregation for the "Evolução mensal" charts in region/channel
    // views. Buckets by YYYY-MM and labels with pt-BR month abbreviations.
    const monthly = dataCols.date ? (()=>{
      const map = new Map();
      const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      for(const r of filteredData){
        const d = r[dataCols.date]; if(!(d instanceof Date)) continue;
        const val = r[dataCols.value]; if(typeof val !== "number") continue;
        const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
        map.set(key, (map.get(key) || 0) + val);
      }
      return [...map.entries()].sort(([a],[b])=> a<b?-1:1).map(([k, v])=>({
        l: meses[parseInt(k.slice(5), 10) - 1] || k.slice(5),
        v,
      }));
    })() : [];
    return {
      tendency: tend, produto: prod, regiao: reg, canal: chan, canalRaw: chanRaw, ranking,
      totalAll, ticketMedio, pedidos: uniqueOrders, convAvg,
      totalDelta, ticketDelta, countDelta, vendedores, dow, monthly,
      sparkSeries: tend.length ? tend.map(d=>d.v) : [0,0,0],
    };
  }, [filteredData, hasRealData, dataCols]);

  // Mock fallbacks — preserved so the dashboard still demos when the user
  // jumps in via Tweaks without uploading.
  const fullTendency = Array.from({length: 90}, (_,i)=>{
    const day = i+1;
    return { l: day+"/jul", v: 12 + Math.sin(i/5)*6 + i*0.6 + (i>60? (i-60)*0.8 : 0) };
  });
  const sliceDays = periodMeta.days != null ? periodMeta.days : fullTendency.length;
  // `mock(x)`: exemplo só no caminho sem upload (Tweaks/dev).
  const mock = (x)=> isUpload ? [] : x;
  const tendency = realAgg && realAgg.tendency.length
    ? realAgg.tendency
    : mock(fullTendency.slice(-Math.min(fullTendency.length, sliceDays)));
  const categoria = realAgg && realAgg.produto.length
    ? realAgg.produto.slice(0,6).map(p => ({
        l: String(p.l).length > 14 ? String(p.l).slice(0,13)+"…" : String(p.l),
        v: p.v,
      }))
    : mock([
        {l:"Mesa Ajust.", v:328},{l:"Notebook", v:276},{l:"Cad. Gamer", v:84},
        {l:"Fone BT", v:62},{l:"Mouse", v:42},{l:"Headset", v:36},
      ]);
  const regiao = realAgg && realAgg.regiao.length
    ? realAgg.regiao.map(r => ({ l: String(r.l), v: r.v }))
    : mock([{l:"CO", v:212},{l:"NE", v:192},{l:"SE", v:154},{l:"SUL", v:142},{l:"N", v:91}]);
  const canal = realAgg && realAgg.canal.length
    ? realAgg.canal
    : mock([{v:38, l:"Marketplace"},{v:29, l:"Loja Física"},{v:24, l:"Site"},{v:9, l:"Parceiros"}]);
  const rankProduto = realAgg && realAgg.ranking.length
    ? realAgg.ranking
    : mock([
        { n:"Mesa Ajustável", c:"Móveis", r:"CO", v:96400, pct:74},
        { n:"Notebook Pro 14", c:"Eletrônicos", r:"SE", v:82100, pct:62},
        { n:"Cadeira Gamer", c:"Móveis", r:"NE", v:41500, pct:31},
        { n:"Fone Bluetooth", c:"Eletrônicos", r:"SUL", v:24800, pct:19},
        { n:"Mouse Sem Fio", c:"Eletrônicos", r:"CO", v:18200, pct:14},
      ]);

  // KPI props for the overview preset. realAgg drives them; mocks remain for
  // the no-upload demo path.
  const fmtDelta = (n)=> Math.abs(n).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "%";
  // KPI com props null é removido do preset (ver cleanBlocks).
  const k1Props = realAgg
    ? { label:"Valor total", value: realAgg.totalAll, format:"brl", delta: fmtDelta(realAgg.totalDelta), deltaDir: realAgg.totalDelta >= 0 ? "up" : "down", sub:"vs metade anterior do período", data: realAgg.sparkSeries, color: tweaks.accent }
    : isUpload ? null : { label:"Valor total", value:"R$ 791,7", delta:"14,2%", deltaDir:"up", sub:"vs período anterior", data:[420,460,440,490,520,560,590,640,700,720,760,791], color: tweaks.accent };
  const k2Props = realAgg
    ? { label:"Ticket médio", value: realAgg.ticketMedio, format:"brl", delta: fmtDelta(realAgg.ticketDelta), deltaDir: realAgg.ticketDelta >= 0 ? "up" : "down", sub:"média por pedido", data: realAgg.sparkSeries, color:"#7a5cff" }
    : isUpload ? null : { label:"Ticket médio", value:"R$ 6,6", delta:"3,1%", deltaDir:"down", sub:"média por transação", data:[7.0,6.9,6.8,6.5,6.4,6.6,6.5,6.7,6.6,6.6,6.4,6.6], color:"#7a5cff" };
  const k3Props = realAgg
    ? { label:"Pedidos", value: realAgg.pedidos, format:"int", delta: fmtDelta(realAgg.countDelta), deltaDir: realAgg.countDelta >= 0 ? "up" : "down", sub: realAgg.pedidos + (dataCols.order ? " pedidos no período" : " registros no período"), data: realAgg.sparkSeries, color:"#0a8a4a" }
    : isUpload ? null : { label:"Pedidos", value:1284, format:"int", delta:"9,8%", deltaDir:"up", sub:"120 únicos no período", data:[820,860,920,1020,1100,1160,1200,1250,1284], color:"#0a8a4a" };
  const k4Props = (realAgg && realAgg.convAvg != null)
    ? { label:"Conversão", value: realAgg.convAvg, format:"pct", suffix:"%", delta:"—", deltaDir:"up", sub:"média no período", data: realAgg.sparkSeries, color:"#ff7849" }
    : isUpload ? null : { label:"Conversão", value:4.8, format:"pct", suffix:"%", delta:"0,6pp", deltaDir:"up", sub:"visitantes → pedido", data:[3.8,4.0,3.9,4.2,4.3,4.5,4.6,4.7,4.8], color:"#ff7849" };

  // ── Per-view aggregated data ───────────────────────────────────────────
  // tendencyMensal/dowVolume/vendedores come from realAgg when an upload is
  // present; otherwise the mock arrays kick in so the Tweaks-only path still
  // renders something. categoriaMix is product-based (the user's CSV rarely
  // has a categoria column) to avoid showing fake "Móveis/Eletrônicos" labels.
  const tendencyMensal = realAgg && realAgg.monthly.length
    ? realAgg.monthly
    : mock(["Jan","Fev","Mar","Abr","Mai","Jun","Jul"].map((l,i)=>({l, v: 60 + i*12 + Math.sin(i)*8})));
  const dowVolume = realAgg && realAgg.dow.length
    ? realAgg.dow
    : mock(["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((l,i)=>({l, v: [80,134,92,108,118,72,46][i]})));
  const vendedores = realAgg && realAgg.vendedores.length
    ? realAgg.vendedores.slice(0, 6).map(s => ({ l: String(s.l), v: s.v }))
    : mock([
        {l:"Ana P.", v:142},{l:"Bruno S.", v:128},{l:"Carla L.", v:104},
        {l:"Diego R.", v:96},{l:"Eva M.", v:78},{l:"Felipe T.", v:62},
      ]);
  const categoriaMix = realAgg && realAgg.produto.length
    ? realAgg.produto.slice(0, 5).map(p => ({
        l: String(p.l).length > 14 ? String(p.l).slice(0,13)+"…" : String(p.l),
        v: p.v,
      }))
    : mock([{l:"Móveis", v:54},{l:"Eletrônicos", v:32},{l:"Acessórios", v:14}]);
  // Mix por categoria real (coluna de categoria), usado no Avançado com upload.
  const categoriaReal = realAgg && dataCols.category
    ? dashGroupSum(filteredData, dataCols.category, dataCols.value).sort((a,b)=>b.v-a.v).slice(0, 6).map(c => ({ l: String(c.l), v: c.v }))
    : [];
  // Pico semanal real: dia com maior soma e quanto fica acima da média diária.
  const dowPeak = (realAgg && realAgg.dow.length) ? (()=>{
    const tot = realAgg.dow.reduce((s, d)=> s + d.v, 0);
    if(!tot) return null;
    const top = realAgg.dow.reduce((a, b)=> b.v > a.v ? b : a);
    const over = (top.v / (tot / 7) - 1) * 100;
    const nomes = { Seg:"Segunda", Ter:"Terça", Qua:"Quarta", Qui:"Quinta", Sex:"Sexta", "Sáb":"Sábado", Dom:"Domingo" };
    return { label:"Pico semanal", value: nomes[top.l] || top.l, delta: fmtDelta(over), deltaDir:"up", sub:"acima da média diária", data: realAgg.dow.map(d => d.v), color:"#ff7849" };
  })() : null;
  const cohort = Array.from({length:8}, (_,i)=>({l:`s${i+1}`, v: 100 - i*8 - Math.sin(i)*4}));

  // ── Per-view KPI props ─────────────────────────────────────────────────
  // Each preset (region / product / channel) gets four data-driven KPIs.
  // Mock fallbacks preserved for the Tweaks-only entry path.
  const regionPalette = [tweaks.accent, "#7a5cff", "#0a8a4a", "#ff7849"];
  const regionKpis = !realAgg && isUpload ? [] : realAgg ? [
    ...[0,1,2].map(i => {
      const r = realAgg.regiao[i];
      const subs = ["líder de receita","vice-líder","3º lugar"];
      return r
        ? { label: String(r.l), value: r.v, format:"brl", delta:"—", deltaDir:"up", sub: subs[i], data: realAgg.sparkSeries, color: regionPalette[i] }
        : { label:"—", value:0, format:"brl", delta:"—", deltaDir:"up", sub:"sem dados no período", data: realAgg.sparkSeries, color: regionPalette[i] };
    }),
    { label:"Regiões ativas", value: realAgg.regiao.length, format:"int", delta:"—", deltaDir:"up", sub:"distintas no período", data: realAgg.sparkSeries, color: regionPalette[3] },
  ] : [
    { label:"Centro-Oeste", value:"R$ 212", delta:"22%", deltaDir:"up", sub:"líder absoluto", data:[120,140,150,170,190,200,205,212], color:tweaks.accent },
    { label:"Nordeste", value:"R$ 192", delta:"14%", deltaDir:"up", sub:"crescimento sustentado", data:[110,120,135,150,165,178,185,192], color:"#7a5cff" },
    { label:"Sudeste", value:"R$ 154", delta:"4%", deltaDir:"down", sub:"queda no canal site", data:[180,175,170,168,165,160,158,154], color:"#0a8a4a" },
    { label:"Cobertura geográfica", value:96, suffix:"%", delta:"2pp", deltaDir:"up", sub:"5 regiões ativas", data:[80,82,86,88,90,92,94,96], color:"#ff7849" },
  ];

  const productKpis = !realAgg && isUpload ? [] : realAgg ? (()=>{
    const total = realAgg.totalAll || 1;
    const prods = realAgg.produto;
    const top = prods[0];
    const top2Sum = (prods[0]?.v || 0) + (prods[1]?.v || 0);
    const top5Sum = prods.slice(0, 5).reduce((s, p) => s + p.v, 0);
    const longTailSum = Math.max(0, realAgg.totalAll - top5Sum);
    const top1Label = top ? (String(top.l).length > 22 ? String(top.l).slice(0,21)+"…" : String(top.l)) : "—";
    return [
      { label:"SKUs ativos", value: prods.length, format:"int", delta:"—", deltaDir:"up", sub:"produtos distintos no período", data: realAgg.sparkSeries, color: tweaks.accent },
      { label:"Top 1: "+top1Label, value: top?.v || 0, format:"brl", delta:"—", deltaDir:"up", sub:"campeão de receita", data: realAgg.sparkSeries, color:"#7a5cff" },
      { label:"Concentração top 2", value: (top2Sum/total)*100, format:"pct", suffix:"%", delta:"—", deltaDir:"up", sub:"risco de dependência", data: realAgg.sparkSeries, color:"#ff7849" },
      { label:"Long tail", value: (longTailSum/total)*100, format:"pct", suffix:"%", delta:"—", deltaDir:"up", sub:"itens fora do top 5", data: realAgg.sparkSeries, color:"#0a8a4a" },
    ];
  })() : [
    { label:"SKUs ativos", value:18, delta:"+2", deltaDir:"up", sub:"vs trimestre anterior", data:[14,15,15,16,16,17,17,18], color:tweaks.accent },
    { label:"Top 1: Mesa Ajustável", value:"R$ 96,4", delta:"18%", deltaDir:"up", sub:"R$ 96,4k em vendas", data:[60,68,72,78,82,88,92,96], color:"#7a5cff" },
    { label:"Concentração top 2", value:42, suffix:"%", delta:"3pp", deltaDir:"up", sub:"risco de dependência", data:[36,37,38,39,40,41,42,42], color:"#ff7849" },
    { label:"Long tail", value:32, suffix:"%", delta:"1pp", deltaDir:"down", sub:"itens fora do top 5", data:[40,38,37,36,35,34,33,32], color:"#0a8a4a" },
  ];

  const channelPalette = [tweaks.accent, "#0a8a4a", "#7a5cff", "#c9234a"];
  const channelKpis = !realAgg && isUpload ? [] : realAgg ? [0,1,2,3].map(i => {
    const c = realAgg.canalRaw[i];
    return c
      ? { label: String(c.l), value: c.v, format:"brl", delta:"—", deltaDir:"up", sub: i===0?"canal líder":(i===3?"em atenção":"em volume"), data: realAgg.sparkSeries, color: channelPalette[i] }
      : { label:"—", value:0, format:"brl", delta:"—", deltaDir:"up", sub:"sem dados", data: realAgg.sparkSeries, color: channelPalette[i] };
  }) : [
    { label:"Marketplace", value:"R$ 301", delta:"18%", deltaDir:"up", sub:"canal líder", data:[200,220,240,260,275,285,295,301], color:tweaks.accent },
    { label:"Loja Física", value:"R$ 230", delta:"6%", deltaDir:"up", sub:"recuperando", data:[180,190,200,210,215,220,225,230], color:"#0a8a4a" },
    { label:"Site", value:"R$ 190", delta:"3%", deltaDir:"down", sub:"queda em jun-jul", data:[210,205,200,198,196,193,191,190], color:"#7a5cff" },
    { label:"Parceiros", value:"R$ 70", delta:"18%", deltaDir:"down", sub:"em atenção", data:[100,95,90,85,82,78,74,70], color:"#c9234a" },
  ];

  // View presets (Dashboards avançados)
  const buildPresets = ()=>{ const all = {
    overview: {
      name: "Visão geral", icon: <Icon.Grid size={13}/>,
      desc: "KPIs principais, evolução, canais e ranking de produtos.",
      blocks: [
        { id:"v0-insights", kind:"insights", span:12 },
        { id:"v0-k1", kind:"kpi", span:3, props: k1Props },
        { id:"v0-k2", kind:"kpi", span:3, props: k2Props },
        { id:"v0-k3", kind:"kpi", span:3, props: k3Props },
        { id:"v0-k4", kind:"kpi", span:3, props: k4Props },
        { id:"v0-c1", kind:"chart", span:8, props:{ title:"Evolução diária do valor total", sub:"Tendência por dia · "+periodMeta.label.toLowerCase(), type:"area", dim:"data", agg:"sum", color: tweaks.accent, height: 280, data: tendency }},
        { id:"v0-c2", kind:"chart", span:4, props:{ title:"Canais de venda", sub:"Participação no valor total", type:"donut", dim:"canal", agg:"sum", color: tweaks.accent, height: 280, data: canal, unit: "%" }},
        { id:"v0-c3", kind:"chart", span:6, props:{ title:"Vendas por categoria & produto", sub:"Top 6 produtos por valor total", type:"bar", dim:"produto", agg:"sum", color: tweaks.accent, height: 240, data: categoria }},
        { id:"v0-c4", kind:"chart", span:6, props:{ title:"Vendas por região", sub:"Comparativo entre as 5 regiões", type:"bar", dim:"regiao", agg:"sum", color: tweaks.accent, height: 240, data: regiao }},
        { id:"v0-rank", kind:"ranking", span:12, props:{ items: rankProduto, title: dataCols.product ? "Top " + dataCols.product : "Top produtos", measure: realAgg ? dataCols.value : undefined }},
      ],
    },
    region: {
      name: "Por região", icon: <Icon.Bars size={13}/>,
      desc: "Comparativo geográfico — vendas, participação e crescimento por estado/região.",
      blocks: [
        { id:"v1-k1", kind:"kpi", span:3, props: regionKpis[0] },
        { id:"v1-k2", kind:"kpi", span:3, props: regionKpis[1] },
        { id:"v1-k3", kind:"kpi", span:3, props: regionKpis[2] },
        { id:"v1-k4", kind:"kpi", span:3, props: regionKpis[3] },
        { id:"v1-c1", kind:"chart", span:8, props:{ title:"Vendas por região", sub:"Soma de receita por região", type:"bar", dim:"regiao", agg:"sum", color: tweaks.accent, height: 280, data: regiao }},
        { id:"v1-c2", kind:"chart", span:4, props:{ title:"Participação por região", sub:"% do valor total", type:"donut", dim:"regiao", agg:"sum", color: tweaks.accent, height: 280, data: regiao.map(r=>({v:r.v, l:r.l})) }},
        { id:"v1-c3", kind:"chart", span:12, props:{ title:"Evolução mensal", sub:"Soma de receita por mês · "+periodMeta.label.toLowerCase(), type:"line", dim:"data", agg:"sum", color: tweaks.accent, height: 260, data: tendencyMensal }},
      ],
    },
    product: {
      name: "Por produto", icon: <Icon.Doc size={13}/>,
      desc: "Ranking de produtos, mix por participação e concentração de receita.",
      blocks: [
        { id:"v2-k1", kind:"kpi", span:3, props: productKpis[0] },
        { id:"v2-k2", kind:"kpi", span:3, props: productKpis[1] },
        { id:"v2-k3", kind:"kpi", span:3, props: productKpis[2] },
        { id:"v2-k4", kind:"kpi", span:3, props: productKpis[3] },
        { id:"v2-c1", kind:"chart", span:7, props:{ title:"Top produtos por valor", sub:"Soma de receita por produto", type:"bar", dim:"produto", agg:"sum", color: tweaks.accent, height: 280, data: categoria }},
        { id:"v2-c2", kind:"chart", span:5, props:{ title:"Mix por produto", sub:"Top 5 · participação no valor total", type:"donut", dim:"produto", agg:"sum", color: tweaks.accent, height: 280, data: categoriaMix }},
        { id:"v2-rank", kind:"ranking", span:12, props:{ items: rankProduto, title: dataCols.product ? "Top " + dataCols.product : "Top produtos", measure: realAgg ? dataCols.value : undefined }},
      ],
    },
    channel: {
      name: "Por canal", icon: <Icon.Share size={13}/>,
      desc: "Performance comparada por canal de venda.",
      blocks: [
        { id:"v3-k1", kind:"kpi", span:3, props: channelKpis[0] },
        { id:"v3-k2", kind:"kpi", span:3, props: channelKpis[1] },
        { id:"v3-k3", kind:"kpi", span:3, props: channelKpis[2] },
        { id:"v3-k4", kind:"kpi", span:3, props: channelKpis[3] },
        { id:"v3-c1", kind:"chart", span:6, props:{ title:"Participação por canal", sub:"% do valor total", type:"donut", dim:"canal", agg:"sum", color: tweaks.accent, height: 260, data: canal, unit: "%" }},
        { id:"v3-c2", kind:"chart", span:6, props:{ title:"Evolução por canal", sub:"Soma de receita por mês", type:"line", dim:"data", agg:"sum", color: tweaks.accent, height: 260, data: tendencyMensal }},
        { id:"v3-c3", kind:"chart", span:12, props:{ title:"Volume por dia da semana", sub:"Soma de receita por dia da semana", type:"bar", dim:"data", agg:"sum", color: tweaks.accent, height: 240, data: dowVolume }},
      ],
    },
    advanced: {
      name: "Avançado", icon: <Icon.Sparkle size={13}/>, badge: "Pro",
      desc: isUpload ? "Sazonalidade semanal, vendedores e mix por categoria." : "Cohorts, sazonalidade, vendedores e detecção de outliers.",
      // Com upload, só o que dá para calcular dos dados. Retenção, anomalias,
      // correlação e cohort eram números fixos exibidos como se fossem da base.
      blocks: isUpload ? (()=>{
        const charts = [
          { id:"v4-c2", kind:"chart", props:{ title:"Vendas por dia da semana", sub:"Detecção de sazonalidade", type:"bar", dim:"data", agg:"sum", color: "#ff7849", height: 260, data: dowVolume }},
          { id:"v4-c3", kind:"chart", props:{ title:"Top vendedores", sub:"Soma por vendedor", type:"bar", dim:"vendedor", agg:"sum", color: tweaks.accent, height: 260, data: vendedores }},
          { id:"v4-c4", kind:"chart", props:{ title:"Mix por categoria", sub:"Participação no valor total", type:"donut", dim:"categoria", agg:"sum", color: "#7a5cff", height: 260, data: categoriaReal }},
        ].filter(c => c.props.data.length);
        const span = charts.length === 1 ? 12 : charts.length === 2 ? 6 : 4;
        return [
          { id:"v4-k4", kind:"kpi", span:3, props: dowPeak },
          ...charts.map(c => ({ ...c, span })),
          { id:"v4-insights", kind:"insights", span:12 },
        ];
      })() : [
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
  };
    // Com upload: remove blocos sem dado real, presets cuja coluna não existe e
    // fecha os buracos do grid (KPIs dividem a linha; gráfico sozinho estica).
    if(isUpload){
      const has = { region: dataCols.region, product: dataCols.product, channel: dataCols.channel, advanced: dataCols.date };
      Object.keys(all).forEach(k => {
        if(k !== "overview" && (!realAgg || (k in has && !has[k]))){ delete all[k]; return; }
        all[k] = { ...all[k], blocks: dashFitBlocks(all[k].blocks) };
        if(k !== "overview" && !all[k].blocks.some(b => b.kind !== "insights")) delete all[k];
      });
    }
    // Data-driven mode: only "Descoberta" (+ "Avançado" when a date column
    // exists, so seasonality still makes sense). Otherwise the full sales suite.
    if(dataDrivenMode && generated){
      const discovery = {
        name: "Descoberta", icon: <Icon.Sparkle size={13}/>,
        desc: "Métricas detectadas automaticamente nos seus dados — sem assumir um tipo de planilha.",
        blocks: [
          { id:"disc-insights", kind:"insights", span:12, props:{ generated: generated.insights } },
          ...generated.kpis,
          ...generated.charts,
        ],
      };
      const out = { discovery: discovery };
      if(hasDatetimeProfile && all.advanced) out.advanced = all.advanced;
      return out;
    }
    // Base de vendas com seleção própria na tela de métricas: a primeira visão
    // é exatamente o que a pessoa marcou; as visões prontas continuam ao lado.
    if(metricPick && generated && (generated.kpis.length || generated.charts.length)){
      const selection = {
        name: "Sua seleção", icon: <Icon.Check size={13}/>,
        desc: "As métricas que você marcou antes de gerar o dashboard.",
        blocks: dashFitBlocks([
          { id:"sel-insights", kind:"insights", span:12, props:{ generated: generated.insights } },
          ...generated.kpis,
          ...generated.charts,
        ]),
      };
      return { selection: selection, ...all };
    }
    return all;
  };
  const presets = React.useMemo(buildPresets, [tweaks.accent, period, realAgg, generated, dataDrivenMode, hasDatetimeProfile, isUpload, metricPick]);
  const defaultViewKey = dataDrivenMode ? "discovery" : presets.selection ? "selection" : "overview";
  // Visão salva só volta se ainda existir e o plano ainda a liberar.
  const savedViewOk = !!(savedLayout && presets[savedLayout.viewKey] && !(presets[savedLayout.viewKey].badge === "Pro" && isFree));
  const [viewKey, setViewKey] = React.useState(()=> savedViewOk ? savedLayout.viewKey : defaultViewKey);

  // Initial blocks — unified layout. Falls back to the first available preset
  // so it never assumes "overview" exists (Descoberta mode has no overview).
  const initialBlocks = React.useMemo(()=>{
    const base = presets[defaultViewKey] || presets[Object.keys(presets)[0]];
    return ((base && base.blocks) || []).concat([{ id:"b-cta", kind:"cta", span:12 }]);
  }, [presets, defaultViewKey]);

  const [blocks, setBlocks] = React.useState(()=>
    (savedViewOk && Array.isArray(savedLayout.blocks) && savedLayout.blocks.length) ? savedLayout.blocks : initialBlocks);

  // Salva layout + narrativa (debounce). A última mudança pendente é gravada
  // mesmo se a pessoa sair do dashboard antes do timer.
  const onPersistRef = React.useRef(onPersist);
  onPersistRef.current = onPersist;
  const persistPendingRef = React.useRef(null);
  const persistInitRef = React.useRef(true);
  React.useEffect(()=>{
    if(persistInitRef.current){ persistInitRef.current = false; return undefined; }
    const payload = { layout: { viewKey, period, blocks }, narrative };
    persistPendingRef.current = payload;
    const t = setTimeout(()=>{
      persistPendingRef.current = null;
      if(onPersistRef.current) onPersistRef.current(payload);
    }, 700);
    return ()=> clearTimeout(t);
  }, [blocks, viewKey, period, narrative]);
  React.useEffect(()=> ()=>{
    if(persistPendingRef.current && onPersistRef.current) onPersistRef.current(persistPendingRef.current);
  }, []);

  // When the period changes, re-hydrate blocks from the active preset so chart
  // data follows. Mirrors the view-switch behavior: changing the data window
  // discards in-place edits, which is the expected trade-off.
  const periodInitRef = React.useRef(true);
  React.useEffect(()=>{
    if(periodInitRef.current){ periodInitRef.current = false; return; }
    const preset = presets[viewKey];
    if(preset) setBlocks([...preset.blocks, { id:"b-cta", kind:"cta", span:12 }]);
  }, [period]);

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
      setBlocks(bs => [...bs, { id, kind:"ranking", span:12, props:{ items: rankProduto, title: dataCols.product ? "Top " + dataCols.product : "Top produtos", measure: realAgg ? dataCols.value : undefined } }]);
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
      // Sem dados do usuário (entrada só pelo Tweaks) não há o que analisar: o
      // Free vê o Insights de exemplo borrado atrás do paywall. Com upload, o
      // Free também usa a IA real (1 análise/mês com conta; ver AINarrative).
      if(isFree && !isUpload){
        const backdrop = (
          <BlockShell editing={editing} kind="Análises da IA" onMove={(d)=>moveBlock(b.id,d)} onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)} span={b.span} resizeOptions={[6,8,12]}>
            <Insights tweaks={tweaks} onAddChart={addChartFromInsight} generated={b.props && b.props.generated}/>
          </BlockShell>
        );
        return (
          <div className="paywall-blur">
            <div className="pw-content">{backdrop}</div>
            <div className="pw-overlay">
              <div className="pw-card">
                <div style={{width:48, height:48, margin:"0 auto 12px", borderRadius:12, background:`linear-gradient(135deg, ${tweaks.accent}, var(--violet))`, color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Icon.Sparkle size={22}/>
                </div>
                <div style={{fontWeight:800, fontSize:18, letterSpacing:"-.01em", marginBottom:6}}>Desbloqueie a análise por IA</div>
                <div style={{fontSize:13, color:"var(--muted)", lineHeight:1.5, marginBottom:16}}>
                  Envie uma planilha para gerar um resumo executivo, insights e recomendações com a IA. O Free inclui 1 análise por mês; no Essencial são 50 e no Pro, 300.
                </div>
                <div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap"}}>
                  <button className="btn btn-primary" onClick={()=>setPaywallReason("insights")}><Icon.Crown size={14}/> Desbloquear análise por IA</button>
                  <button className="btn btn-ghost" onClick={()=>setPaywallReason("insights")}>Saber mais</button>
                </div>
                <div style={{display:"flex", justifyContent:"center", gap:14, marginTop:14, paddingTop:14, borderTop:"1px dashed var(--line-2)"}}>
                  <span style={{display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"var(--muted)"}}>
                    <Icon.Check size={11} stroke={3} color="#0a8a4a"/> Resumo executivo
                  </span>
                  <span style={{display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"var(--muted)"}}>
                    <Icon.Check size={11} stroke={3} color="#0a8a4a"/> Insights & recomendações
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
      // Real Gemini narrative when there's an upload to analyze; otherwise
      // (Tweaks-only entry, no data) keep the data-driven/demo Insights card.
      const inner = isUpload
        ? <AINarrative tweaks={tweaks} anon={!currentUser} limits={currentUser && currentUser.limits} live={{ data: narrative, loading: narrativeLoading, error: narrativeError, quota: narrativeQuota, focus: fileInfo && fileInfo.aiFocus, onReload: ()=>loadNarrative(true) }}/>
        : <Insights tweaks={tweaks} onAddChart={addChartFromInsight} generated={b.props && b.props.generated}/>;
      return (
        <BlockShell editing={editing} kind="Análises da IA" onMove={(d)=>moveBlock(b.id,d)} onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)} span={b.span} resizeOptions={[6,8,12]}>
          {inner}
        </BlockShell>
      );
    }
    if(b.kind === "ranking"){
      return <BlockShell editing={editing} kind="Ranking / Tabela" onMove={(d)=>moveBlock(b.id,d)} onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)} span={b.span} resizeOptions={[6,8,12]}>
        <RankingTable items={b.props.items} accent={tweaks.accent} title={b.props.title} measure={b.props.measure}/>
      </BlockShell>;
    }
    if(b.kind === "cta"){
      if(tweaks.plan === "pro") return null;
      return <BlockShell editing={editing} kind="Banner / CTA" onMove={(d)=>moveBlock(b.id,d)} onResize={(s)=>resizeBlock(b.id,s)} onDelete={()=>deleteBlock(b.id)} span={b.span} resizeOptions={[6,8,12]}>
        <div style={{padding:"18px 22px", borderRadius:16, background:"linear-gradient(90deg, #f5f8ff, white)", border:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:24, flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:14}}>
            <div style={{width:40, height:40, borderRadius:10, background:"var(--ink)", color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <Icon.Crown size={18}/>
            </div>
            <div>
              <div style={{fontWeight:700, fontSize:15}}>300 análises da IA por mês e bases de até 1 milhão de linhas</div>
              <div style={{fontSize:13, color:"var(--muted)"}}>Plano Pro · R$ 49,90/mês · cartão ou Pix</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={()=> window.__dashUpgrade?.()}>Ver planos <Icon.Arrow size={14}/></button>
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
      <Topbar onClose={onClose} tweaks={tweaks} fileInfo={fileInfo} currentUser={currentUser} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile}/>
      {/* #dash-export-root = o que vai para o PDF/PNG (dashboard-export.jsx).
          .no-export some na exportação; .export-only só aparece nela. */}
      <div id="dash-export-root" style={{maxWidth: 1480, margin: "0 auto", padding: "28px 24px 120px"}}>
        {/* Header */}
        <div className="rv" style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom: 22, gap:24, flexWrap:"wrap"}}>
          <div>
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
              <span className="chip" style={{background:"var(--brand-soft)", color:"var(--brand-2)"}}><Icon.Sparkle size={11}/> Gerado por IA</span>
              <span className="chip" style={{background:"#e7f7ef", color:"#0a8a4a"}}><span style={{width:6, height:6, borderRadius:"50%", background:"#0a8a4a"}}/> Atualizado</span>
              {editing && <span className="chip" style={{background:"var(--ink)", color:"white"}}><Icon.Bolt size={11}/> Modo edição</span>}
            </div>
            <h1 style={{margin:"0 0 4px", fontSize:34, fontWeight:800, letterSpacing:"-.02em"}}>{dataDrivenMode ? "Painel de descoberta" : "Visão geral de vendas"}</h1>
            <div style={{fontSize:13, color:"var(--muted)"}}>
              {fileInfo?.name || "vendas_exemplo.csv"} · {periodMeta.label} · {rowsForPeriod.toLocaleString("pt-BR")} de {totalRows.toLocaleString("pt-BR")} linhas
              {fileInfo?.isDemo && <span style={{marginLeft:6, fontWeight:600, color:"var(--warn)"}}>· Dados de demonstração · não são reais</span>}
            </div>
            <div className="export-only" style={{fontSize:12, color:"var(--muted)", marginTop:4}}>
              Exportado em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"})}
            </div>
          </div>
          {/* "Atualizar" saiu: não tinha ação (os dados vêm do arquivo enviado). */}
          <div className="no-export" style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
            <div className="seg">
              {[["7d","7d"],["30d","30d"],["90d","90d"],["all","Tudo"]].map(([k,n])=>(
                <button key={k} className={period===k?"on":""} onClick={()=>setPeriod(k)}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* View presets — Dashboards avançados */}
        <div className="rv no-export" style={{
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
          <div className="rv no-export" style={{
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
              <div key={b.kind === "kpi" ? `${b.id}::${period}` + (editing ? "" : "::" + String(b.props && b.props.value)) : b.id} data-block-id={b.id} data-kind={b.kind}
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
        <div className="export-only export-brand" style={{alignItems:"center", gap:8, marginTop:18, paddingTop:12, borderTop:"1px solid var(--line)", fontSize:12, color:"var(--muted)"}}>
          <Icon.Logo size={18}/> Gerado com {tweaks.brandName} · dashboards com IA
        </div>
      </div>

      {/* Floating action toolbar */}
      <div className="fab-bar" style={{transform: `translateX(-50%) translateY(${exportOpen ? 80 : 0}px)`}}>
        <button className={editing ? "active" : ""} onClick={()=>{ if(requirePro("edit")) return; setEditing(!editing); }} title={isFree ? "Editar (planos pagos)" : "Editar layout (E)"} aria-label={editing ? "Concluir edição" : "Editar layout"}>
          {isFree ? <><Icon.Lock size={14}/> <span className="fab-label">Editar</span></> : (editing ? <><Icon.Check size={14}/> <span className="fab-label">Concluir</span></> : <><Icon.Wand size={14}/> <span className="fab-label">Editar</span></>)}
        </button>
        <div style={{position:"relative"}}>
          <button onClick={()=>{ if(requirePro("add")) return; setPickerOpen(!pickerOpen); }} title={isFree ? "Adicionar (planos pagos)" : "Adicionar (A)"} aria-label="Adicionar bloco" className={pickerOpen?"active":""}>
            {isFree ? <Icon.Lock size={14}/> : <Icon.Plus size={14}/>} <span className="fab-label">Adicionar</span>
          </button>
          {pickerOpen && !isFree && (
            <AddPicker onPick={addBlock} onClose={()=>setPickerOpen(false)} accent={tweaks.accent} placement="above-center"/>
          )}
        </div>
        <div className="div"/>
        <button onClick={()=>{ if(requirePro("share")) return; setEditing(false); setPickerOpen(false); setShareOpen(true); }} title={tweaks.plan === "pro" ? "Compartilhar por link" : "Compartilhar por link (plano Pro)"} aria-label="Compartilhar por link">
          {tweaks.plan === "pro" ? <Icon.Share size={14}/> : <Icon.Lock size={14}/>} <span className="fab-label">Compartilhar</span>
        </button>
        <button onClick={()=>{ setEditing(false); setPickerOpen(false); setExportOpen(true); }} className="primary" title="Exportar (X)" aria-label="Exportar">
          <Icon.Download size={14}/> <span className="fab-label">Exportar</span>
        </button>
      </div>

      {exportOpen && <ExportModal onClose={()=>setExportOpen(false)} blocks={blocks} tweaks={tweaks} fileInfo={fileInfo}
        meta={{
          title: dataDrivenMode ? "Painel de descoberta" : "Visão geral de vendas",
          period: periodMeta.label,
          rows: rowsForPeriod.toLocaleString("pt-BR") + " linhas",
          aiSummary: narrative ? String(narrative.narrative || narrative.summary || narrative.rawText || "").slice(0, 400) : null,
        }}
        canExport={!isFree && !(currentUser && currentUser.limits && currentUser.limits.canExport === false)}
        canRemoveBranding={!!(currentUser && currentUser.limits ? currentUser.limits.removeBranding : tweaks.plan === "pro")}
        hasAI={!!narrative}
        onLocked={()=>{ setExportOpen(false); setPaywallReason("export"); }}/>}
      {shareOpen && <ShareModal onClose={()=>setShareOpen(false)} tweaks={tweaks} hasAI={!!narrative}
        defaultTitle={((dataDrivenMode ? "Painel de descoberta" : "Visão geral de vendas") + (fileInfo && fileInfo.name ? " · " + fileInfo.name : "")).slice(0, 120)}
        buildSnapshot={({ includeAI, branding })=> dashBuildShareSnapshot({
          blocks, accent: tweaks.accent, branding,
          aiSummary: includeAI && narrative ? String(narrative.narrative || narrative.summary || narrative.rawText || "").slice(0, 10000) : null,
          meta: {
            title: dataDrivenMode ? "Painel de descoberta" : "Visão geral de vendas",
            fileName: fileInfo && fileInfo.name ? String(fileInfo.name).slice(0, 200) : undefined,
            period: periodMeta.label,
            rows: rowsForPeriod,
            totalRows: totalRows,
          },
        })}/>}
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
    edit:     { t:"Editar o layout é um recurso pago", d:"Reorganizar blocos, redimensionar, mudar tipos, dimensões e cores fica disponível a partir do plano Essencial." },
    add:      { t:"Adicionar blocos é um recurso pago", d:"Criar novos KPIs, gráficos, ranking e blocos de insights fica disponível a partir do plano Essencial." },
    insights: { t:"Mais análises da IA nos planos pagos", d:"O Free inclui 1 análise por mês. No Essencial são 50 e no Pro, 300, com resumo executivo, insights e recomendações." },
    advanced: { t:"Visão avançada nos planos pagos", d:"Sazonalidade, vendedores e mix por categoria ficam disponíveis a partir do plano Essencial." },
    export:   { t:"Exportar é um recurso pago", d:"Baixe o dashboard em PDF ou PNG a partir do plano Essencial." },
    share:    { t:"Link público é do plano Pro", d:"Compartilhe o dashboard com quem não tem conta: um link de leitura que você desativa quando quiser." },
  }[reason] || { t:"Recurso pago", d:"Este recurso está disponível a partir do plano Essencial." };

  // O link público é só do Pro; o resto libera no Essencial.
  const proOnly = reason === "share";
  const features = proOnly ? [
    { i:<Icon.Share size={14}/>, n:"Link público de leitura", d:"sem conta para quem recebe" },
    { i:<Icon.Lock size={14}/>, n:"Desative quando quiser", d:"links gerenciados por você" },
    { i:<Icon.Sparkle size={14}/>, n:"300 análises da IA", d:"por mês" },
    { i:<Icon.Bars size={14}/>, n:"Bases de até 1 milhão", d:"de linhas" },
    { i:<Icon.Download size={14}/>, n:"Exportar sem a marca", d:"PDF/PNG limpos" },
    { i:<Icon.Wand size={14}/>, n:"Tudo do Essencial", d:"edição, visão avançada" },
  ] : [
    { i:<Icon.Wand size={14}/>, n:"Edição completa do layout", d:"drag-and-drop, tamanhos, ordem" },
    { i:<Icon.Plus size={14}/>, n:"Adicionar KPIs e gráficos", d:"barras, linha, área, donut, tabela" },
    { i:<Icon.Sparkle size={14}/>, n:"Análises da IA", d:"50/mês no Essencial · 300/mês no Pro" },
    { i:<Icon.Grid size={14}/>, n:"Visão avançada", d:"sazonalidade, vendedores, categorias" },
    { i:<Icon.Bars size={14}/>, n:"Bases maiores", d:"100 mil linhas · 1 milhão no Pro" },
    { i:<Icon.Lock size={14}/>, n:"Cartão ou Pix", d:"sem fidelidade" },
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
            <Icon.Crown size={11}/> {proOnly ? "Plano Pro" : "Planos pagos"}
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
              <div style={{fontSize:11, color:"var(--muted)", letterSpacing:".06em", textTransform:"uppercase", fontWeight:600}}>{proOnly ? "Pro" : "A partir do Essencial"}</div>
              <div style={{display:"flex", alignItems:"baseline", gap:4, marginTop:2}}>
                <span style={{fontSize:28, fontWeight:800, color:"var(--brand)", letterSpacing:"-.02em"}}>{proOnly ? "R$ 49,90" : "R$ 29,90"}</span>
                <span style={{fontSize:13, color:"var(--muted)"}}>/mês</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11, color:"var(--ink-2)", fontWeight:700}}>{proOnly ? "Cartão ou Pix" : "Pro: R$ 49,90/mês"}</div>
              <div style={{fontSize:11, color:"var(--muted)"}}>No anual, 2 meses grátis</div>
            </div>
          </div>
          <div style={{display:"flex", gap:8}}>
            <button className="btn btn-primary" style={{flex:1, justifyContent:"center", padding:"14px"}}
              onClick={()=>{ onClose(); window.__dashUpgrade?.(); }}>
              <Icon.Crown size={14}/> Ver planos
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

function RankingTable({ items, accent, title, sub, measure }){
  const ref = React.useRef(null);
  const [vis, setVis] = React.useState(false);
  React.useEffect(()=>{
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVis(true); }, {threshold: 0.2});
    if(ref.current) io.observe(ref.current);
    return ()=> io.disconnect();
  },[]);
  items = items || [];
  // Coluna só aparece se algum item tem o dado (antes: "—" em todas as linhas).
  const hasCat = items.some(p => p.c && p.c !== "—");
  const hasShare = items.some(p => p.s != null);
  const cols = "40px minmax(0, 2.2fr)" + (hasCat ? " minmax(0, 1fr)" : "") + " minmax(0, 1.6fr) minmax(90px, .9fr)";
  const money = (v)=>{
    const a = Math.abs(v);
    if(a >= 1e6) return "R$ " + (v/1e6).toLocaleString("pt-BR", {maximumFractionDigits:1}) + " mi";
    if(a >= 1e3) return "R$ " + (v/1e3).toLocaleString("pt-BR", {maximumFractionDigits:1}) + " mil";
    return "R$ " + Math.round(v).toLocaleString("pt-BR");
  };
  const initials = (n)=> String(n).split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase() || "#";
  return (
    <div ref={ref} className="chart-card lift" style={{
      opacity: vis?1:0, transform: vis?"none":"translateY(20px)", transition:"all .7s cubic-bezier(.2,.7,.2,1)"
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap"}}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{width:8, height:8, borderRadius:"50%", background:accent}}/>
            <span style={{fontWeight:700, fontSize:15}}>{title || "Top produtos"}</span>
          </div>
          <div style={{fontSize:12, color:"var(--muted)", marginTop:4}}>{sub || ("Os " + items.length + " itens com maior valor no período")}</div>
        </div>
        {measure && <span className="chip mono" style={{background:"var(--line-2)"}}>soma · {measure}</span>}
      </div>
      <div style={{overflowX:"auto"}}>
        <div style={{minWidth:520}}>
          <div style={{display:"grid", gridTemplateColumns:cols, gap:12, alignItems:"center", marginTop:10, padding:"0 0 8px"}}>
            {["#","Item"].concat(hasCat ? ["Categoria"] : [], [hasShare ? "Participação" : "Comparativo", "Valor"]).map((h,i,arr)=>(
              <div key={h} className="mono" style={{fontSize:10.5, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", textAlign: i===arr.length-1 ? "right":"left"}}>{h}</div>
            ))}
          </div>
          {items.map((p, i)=>(
            <div key={p.n + i} style={{
              display:"grid", gridTemplateColumns:cols, gap:12, alignItems:"center",
              padding:"11px 0", borderTop:"1px solid var(--line-2)",
              opacity: vis?1:0, transform: vis?"none":"translateX(10px)",
              transition:`all .5s ${i*0.08}s cubic-bezier(.2,.7,.2,1)`
            }}>
              <div className="mono" style={{fontSize:12.5, color: i < 3 ? "var(--ink)" : "var(--muted)", fontWeight: i < 3 ? 700 : 500}}>{String(i+1).padStart(2,"0")}</div>
              <div style={{display:"flex", alignItems:"center", gap:10, minWidth:0}}>
                <div style={{width:30, height:30, borderRadius:8, flexShrink:0, background:`color-mix(in oklch, ${accent} ${i === 0 ? 100 : 14}%, white)`, color: i === 0 ? "white" : accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11.5, fontWeight:700}}>{initials(p.n)}</div>
                <div style={{fontWeight:600, fontSize:13.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}} title={p.n}>{p.n}</div>
              </div>
              {hasCat && <div style={{fontSize:13, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.c}</div>}
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <div style={{flex:1, height:7, background:"var(--line-2)", borderRadius:99, overflow:"hidden"}}>
                  <div style={{
                    width: vis ? p.pct+"%" : "0%", height:"100%", borderRadius:99,
                    background: `linear-gradient(90deg, ${accent}, var(--violet))`,
                    transition:`width 1s ${0.3 + i*0.1}s cubic-bezier(.2,.7,.2,1)`
                  }}/>
                </div>
                {p.s != null && <span className="mono" style={{fontSize:11.5, color:"var(--muted)", minWidth:42, textAlign:"right"}}>{p.s.toLocaleString("pt-BR", {maximumFractionDigits:1})}%</span>}
              </div>
              <div className="ticker" style={{textAlign:"right", fontWeight:700, fontSize:13.5}}>{money(p.v)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Dashboard,
  // Usados pelo fluxo de envio (dashboard-flow.jsx).
  dashJsonToParsed, dashXlsxToParsed, dashEnsureXLSX, dashDecodeText, DASH_SAMPLE_JSON,
  // Exposed so App can drive a "Ver demonstração" flow without re-implementing
  // the CSV pipeline.
  dashParseCSV, dashParseNumber, dashParseDate, dashInferSchema, dashRowsToObjects, dashResolveColumns,
  dashFetchNarrative, AINarrative,
  DASH_SAMPLE_CSV,
  // Reusados pela página pública de link compartilhado (share-view.jsx).
  KPI, ChartCard, RankingTable,
});
