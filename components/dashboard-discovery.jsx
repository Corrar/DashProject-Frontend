/* ─────────────────── Data-driven discovery layer ───────────────────
 * Pure functions (no JSX, no React) that let the product adapt to ANY
 * spreadsheet instead of assuming a sales shape. The pipeline is:
 *
 *   dashProfileColumns(header, rawRows)  → profile per column (pattern + stats)
 *   dashSuggestMetrics(profiles, rows)   → ranked metric suggestions
 *   dashGenerateBlocks(profiles, metrics)→ { kpis, charts, insights } blocks
 *   dashPresetCompat(profiles)           → which legacy presets still make sense
 *
 * Guiding principle: the PATTERN is decided by the values, never by the
 * column name. A matching name only NUDGES confidence (+0.1), it can never
 * be the sole trigger for a pattern. See CLAUDE.md §1 / the design doc.
 *
 * Loaded BEFORE dashboard.jsx in Dash.html. The parse helpers it needs
 * (dashParseNumber / dashParseDate) live in dashboard.jsx and load AFTER
 * this file — that's fine because they are only ever read at *call* time
 * (during profiling, long after page load), never at module-eval time.
 * Local fallbacks below keep this file usable in isolation (e.g. Node).
 */

/* ── parse helpers (prefer the battle-tested ones from dashboard.jsx) ── */
function _localNum(v){
  if(v == null) return null;
  let s = String(v).trim(); if(!s) return null;
  s = s.replace(/R\$|US\$|\$|€|£|%/g, "").replace(/\s| /g, "");
  const neg = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/^[+\-]/, "");
  if(!/^[\d.,]+$/.test(s)) return null;
  const hasDot = s.includes("."), hasComma = s.includes(",");
  let norm;
  if(hasDot && hasComma){
    norm = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g,"").replace(",",".") : s.replace(/,/g,"");
  } else if(hasComma){
    const p = s.split(","); norm = (p.length===2 && p[1].length<=2) ? s.replace(",",".") : s.replace(/,/g,"");
  } else if(hasDot){
    const q = s.split("."); norm = (q.length===2 && q[1].length<=2) ? s : s.replace(/\./g,"");
  } else norm = s;
  const n = parseFloat(norm);
  if(!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
function _localDate(v){
  if(v == null) return null;
  const s = String(v).trim(); if(!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(m){ const y = m[3].length===2 ? 2000+Number(m[3]) : Number(m[3]); return new Date(y, Number(m[2])-1, Number(m[1])); }
  return null;
}
function _asNum(v){
  if(typeof v === "number") return Number.isFinite(v) ? v : null;
  const f = (typeof window !== "undefined" && window.dashParseNumber) || _localNum;
  return f(v);
}
function _asDate(v){
  if(v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const f = (typeof window !== "undefined" && window.dashParseDate) || _localDate;
  return f(v);
}
function _round2(x){ return Math.round(x*100)/100; }

/* Tokens treated as positive/boolean. Used by boolean detection + % positivo. */
const DISC_BOOLSET = {"sim":1,"não":1,"nao":1,"true":1,"false":1,"yes":1,"no":1,"y":1,"n":1,"1":1,"0":1,"t":1,"f":1,"verdadeiro":1,"falso":1,"v":1,"ativo":1,"inativo":1,"pago":1};
const DISC_POSSET  = {"sim":1,"true":1,"yes":1,"y":1,"1":1,"verdadeiro":1,"v":1,"t":1,"ativo":1,"pago":1};
/* Money-ish name terms. They only BOOST confidence — never trigger a pattern. */
const DISC_MON = /receita|fatur|custo|preç|preco|montante|gmv|revenue|price|amount|sal[aá]rio|ticket|valor|venda/;

/* Profile a single column from its raw (string) values.
 * Pattern resolution order: datetime → boolean → identifier →
 * (number) scale → percent → monetary → continuous →
 * (string) multi_value → freetext → category_low → category_high. */
function dashProfileColumn(name, values){
  const lname = String(name || "").toLowerCase();
  const nameHas = (re)=> re.test(lname);

  const raw = (values || []).map(v => v == null ? null : String(v).trim());
  const total = raw.length;
  const present = raw.filter(s => s != null && s !== "");
  const nullCount = total - present.length;
  const nullRatio = total ? nullCount/total : 0;

  const uniqSet = {}; present.forEach(s => { uniqSet[s] = 1; });
  const uniqueKeys = Object.keys(uniqSet);
  const uniqueCount = uniqueKeys.length;
  const uniqueRatio = present.length ? uniqueCount/present.length : 0;
  const sampleValues = present.slice(0, 3);

  // Numeric / date signals.
  const nums = [];
  present.forEach(s => { const n = _asNum(s); if(n != null && isFinite(n)) nums.push(n); });
  const numericRatio = present.length ? nums.length/present.length : 0;
  let dateCount = 0; present.forEach(s => { if(_asDate(s)) dateCount++; });
  const dateRatio = present.length ? dateCount/present.length : 0;

  // Stats over the parsed numbers.
  let min = null, max = null, sum = 0, avg = null, median = null;
  if(nums.length){
    const sorted = nums.slice().sort((a,b)=>a-b);
    min = sorted[0]; max = sorted[sorted.length-1];
    sum = nums.reduce((a,b)=>a+b, 0);
    avg = sum/nums.length;
    const mid = Math.floor(sorted.length/2);
    median = sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
  }

  // Shape hints.
  const hasCurrency = present.some(s => /R\$|US\$|\$|€|£/.test(s));
  const hasPercent  = present.some(s => /%/.test(s));
  const ints = nums.length > 0 && nums.every(n => Number.isInteger(n));
  const avgLen = present.length ? present.reduce((a,s)=>a+s.length, 0)/present.length : 0;
  const twoDecRatio = present.length
    ? present.filter(s => /[.,]\d{2}$/.test(s.replace(/[R$\s%€£]/g, ""))).length/present.length
    : 0;
  // Highest share of cells carrying an embedded list delimiter (, ; |).
  let multiRatio = 0;
  [",", ";", "|"].forEach(d => {
    const re = d === "|" ? /\|\s*\S/ : new RegExp("\\" + d + "\\s*\\S");
    const r = present.length ? present.filter(s => re.test(s)).length/present.length : 0;
    if(r > multiRatio) multiRatio = r;
  });

  const baseType = dateRatio >= 0.85 ? "date" : numericRatio >= 0.85 ? "number" : "string";

  // ID disambiguation: distinguishing a numeric ID from a numeric measure is
  // impossible from values alone, so a numeric identifier needs a code-like
  // shape (leading zeros / fixed width) or an id-ish name. String IDs need a
  // code shape (A001, SKU-12) or id-ish name — so person names don't get
  // mistaken for identifiers.
  const codeLikeStr = present.length > 0 && present.every(s => /^[A-Za-z]{0,5}[-_]?\d{2,}$/.test(s));
  const hasLeadingZero = present.some(s => /^0\d+/.test(s));
  const lenSet = {}; present.forEach(s => { lenSet[s.length] = 1; });
  const fixedWidth = Object.keys(lenSet).length === 1 && present.length > 0 && present[0].length >= 4;
  const nameId = nameHas(/(^|_)id($|_)|c[oó]d|sku|cpf|cnpj|matric|numero|num_|_num|pedido|nota|protocolo/);

  const boost = (m)=> m ? 0.1 : 0;
  const clamp = (c)=> Math.max(0, Math.min(0.98, c));
  let pattern, confidence, scaleRange = null;

  if(baseType === "date"){
    pattern = "datetime";
    confidence = clamp(dateRatio + boost(nameHas(/data|date|dia|created|criad|carimbo|timestamp|hora/)));
  } else if(uniqueCount === 2 && uniqueKeys.every(k => DISC_BOOLSET[String(k).toLowerCase()] === 1)){
    pattern = "boolean";
    confidence = clamp(0.85 + boost(nameHas(/flag|ativo|inativo|status|aprov|pago|^is_|resp|mist/)));
  } else if(uniqueRatio > 0.95 && !hasCurrency && !hasPercent &&
            ((baseType === "number" && ints && (nameId || hasLeadingZero || fixedWidth)) ||
             (baseType === "string" && (nameId || codeLikeStr)))){
    pattern = "identifier";
    confidence = clamp(0.78 + boost(nameId));
  } else if(baseType === "number"){
    if(ints && uniqueCount >= 3 && uniqueCount <= 11 && min >= 0 && max <= 10 && (max - min) >= 2){
      pattern = "scale"; scaleRange = [min, max];
      confidence = clamp(0.72 + boost(nameHas(/nota|escala|rating|score|nps|satisf|aval|estrela/)));
    } else if(hasPercent){
      pattern = "percent";
      confidence = clamp(0.85 + boost(nameHas(/%|pct|perc|taxa|convers|rate/)));
    } else if(min >= 0 && max <= 1){
      // Ratio form (0..1) is a pure-data percent signal.
      pattern = "percent";
      confidence = clamp(0.6 + boost(nameHas(/%|pct|perc|taxa|convers|rate|propor|ratio/)));
    } else if(min >= 0 && max <= 100 && nameHas(/%|pct|perc|taxa|convers|rate/)){
      // 0..100 is ambiguous (age, score, qty); the brief sanctions the name as
      // the disambiguator here. This is the ONLY place a name participates in
      // triggering a pattern, and only on top of a bounded-range data signal.
      pattern = "percent"; confidence = 0.62;
    } else if(hasCurrency){
      pattern = "monetary";
      confidence = clamp(0.85 + boost(nameHas(DISC_MON)));
    } else if(avg > 100 && twoDecRatio >= 0.4){
      pattern = "monetary";
      confidence = clamp(0.65 + boost(nameHas(DISC_MON)));
    } else {
      pattern = "continuous";
      confidence = clamp(0.6 + boost(nameHas(/qtd|quant|total|count|num|idade|peso|volume|estoque|valor|preç|preco/)));
    }
  } else {
    if(multiRatio >= 0.3){
      pattern = "multi_value";
      confidence = clamp(0.68 + boost(nameHas(/tag|opç|opc|modalidad|categor|lista|multipl/)));
    } else if(uniqueRatio > 0.8 && avgLen > 50){
      pattern = "freetext"; confidence = 0.72;
    } else if(uniqueCount <= 20){
      pattern = "category_low"; confidence = clamp(0.78 - (uniqueCount > 12 ? 0.06 : 0));
    } else if(uniqueCount <= 100){
      pattern = "category_high"; confidence = 0.66;
    } else {
      pattern = "freetext"; confidence = 0.55;
    }
  }

  return {
    name: name,
    baseType: baseType,
    pattern: pattern,
    stats: {
      min: min, max: max, sum: sum, avg: avg, median: median,
      uniqueCount: uniqueCount, uniqueRatio: _round2(uniqueRatio),
      nullCount: nullCount, nullRatio: _round2(nullRatio),
      sampleValues: sampleValues
    },
    confidence: _round2(confidence),
    hints: { hasCurrency: hasCurrency, hasPercent: hasPercent, scaleRange: scaleRange }
  };
}

/* Profile every column. Mirrors dashInferSchema's (header, rawRows) shape so
 * it can run on the same parsed CSV (raw strings — currency/percent symbols
 * still intact, which dashRowsToObjects would have stripped). */
function dashProfileColumns(header, rawRows){
  return (header || []).map((name, idx) => {
    const values = (rawRows || []).map(r => r[idx]);
    return dashProfileColumn(name, values);
  });
}

/* Suggest ranked metrics from profiles. Higher priority = more relevant.
 * Priorities follow the design doc table (monetary sum 100 … count 50). */
function dashSuggestMetrics(profiles, rows){
  const metrics = [];
  const dt = (profiles || []).find(p => p.pattern === "datetime");
  const add = (m)=> metrics.push(m);

  (profiles || []).forEach(p => {
    switch(p.pattern){
      case "monetary":
        add({ kind:"sum", columns:{ primary:p.name }, label:"Total de "+p.name, priority:100, format:"currency" });
        if(dt) add({ kind:"trend", columns:{ primary:p.name, secondary:dt.name }, label:"Evolução de "+p.name, priority:95, format:"currency" });
        add({ kind:"avg", columns:{ primary:p.name }, label:"Média de "+p.name, priority:65, format:"currency" });
        break;
      case "continuous":
        add({ kind:"sum", columns:{ primary:p.name }, label:"Soma de "+p.name, priority:60, format:"number" });
        if(dt) add({ kind:"trend", columns:{ primary:p.name, secondary:dt.name }, label:"Evolução de "+p.name, priority:95, format:"number" });
        break;
      case "scale":
        add({ kind:"avg", columns:{ primary:p.name }, label:"Média de "+p.name, priority:80, format:"scale" });
        add({ kind:"distribution", columns:{ primary:p.name }, label:"Distribuição de "+p.name, priority:68, format:"number" });
        break;
      case "boolean":
        add({ kind:"percent_positive", columns:{ primary:p.name }, label:"% positivo · "+p.name, priority:75, format:"percent" });
        break;
      case "category_low":
        add({ kind:"top_n", columns:{ primary:p.name }, label:"Top "+p.name, priority:85, format:"number" });
        add({ kind:"distribution", columns:{ primary:p.name }, label:"Distribuição por "+p.name, priority:68, format:"number" });
        break;
      case "category_high":
        add({ kind:"top_n", columns:{ primary:p.name }, label:"Top 10 · "+p.name, priority:72, format:"number" });
        break;
      case "multi_value":
        add({ kind:"frequency_by_item", columns:{ primary:p.name }, label:"Frequência · "+p.name, priority:70, format:"number" });
        break;
      case "identifier":
        add({ kind:"count_unique", columns:{ primary:p.name }, label:p.name+" únicos", priority:90, format:"number" });
        break;
      default: break;
    }
  });
  // Universal fallback so any sheet gets at least one metric.
  add({ kind:"count", columns:{ primary:null }, label:"Total de registros", priority:50, format:"number" });

  // Sort by priority desc, then dedup by kind+primary (keeps the highest).
  const seen = {}, out = [];
  metrics.sort((a,b)=> b.priority - a.priority).forEach(m => {
    const key = m.kind + "|" + (m.columns.primary || "");
    if(seen[key]) return;
    seen[key] = 1; out.push(m);
  });
  return out;
}

/* ── aggregation helpers (work on raw OR typed rows) ── */
function _sum(rows, key){ let s = 0; (rows||[]).forEach(r => { const v = _asNum(r[key]); if(v != null) s += v; }); return s; }
function _avg(rows, key){ let s = 0, n = 0; (rows||[]).forEach(r => { const v = _asNum(r[key]); if(v != null){ s += v; n++; } }); return n ? s/n : 0; }
function _countUnique(rows, key){ const set = {}; (rows||[]).forEach(r => { const v = r[key]; if(v != null && v !== "") set[String(v)] = 1; }); return Object.keys(set).length; }
function _pctPositive(rows, key){
  let pos = 0, tot = 0;
  (rows||[]).forEach(r => { const v = r[key]; if(v == null || v === "") return; tot++; if(DISC_POSSET[String(v).toLowerCase()]) pos++; });
  return tot ? Math.round(pos/tot*100) : 0;
}
function _groupCount(rows, key){
  const map = {};
  (rows||[]).forEach(r => { let k = r[key]; if(k == null || k === "") return; k = String(k); map[k] = (map[k]||0)+1; });
  return Object.keys(map).map(k => ({ l:k, v:map[k] })).sort((a,b)=> b.v - a.v);
}
function _freqItems(rows, key){
  const map = {};
  (rows||[]).forEach(r => {
    const v = r[key]; if(v == null || v === "") return;
    String(v).split(/[,;|]/).forEach(part => { const s = part.trim(); if(!s) return; map[s] = (map[s]||0)+1; });
  });
  return Object.keys(map).map(k => ({ l:k, v:map[k] })).sort((a,b)=> b.v - a.v);
}
function _monthly(rows, valueKey, dateKey){
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const map = {};
  (rows||[]).forEach(r => {
    const d = _asDate(r[dateKey]); if(!d) return;
    const v = _asNum(r[valueKey]); if(v == null) return;
    const key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2, "0");
    map[key] = (map[key]||0) + v;
  });
  return Object.keys(map).sort().map(k => ({ l: meses[parseInt(k.slice(5), 10)-1] || k.slice(5), v: map[k] }));
}
function _short(label){ const s = String(label); return s.length > 14 ? s.slice(0,13)+"…" : s; }
function _fmt(v, format){
  if(v == null || isNaN(v)) return "—";
  if(format === "currency"){
    const a = Math.abs(v);
    if(a >= 1e6) return "R$ " + (v/1e6).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "M";
    if(a >= 1e3) return "R$ " + (v/1e3).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "k";
    return "R$ " + Math.round(v).toLocaleString("pt-BR");
  }
  if(format === "percent") return v.toLocaleString("pt-BR", {maximumFractionDigits:1}) + "%";
  if(format === "scale")   return v.toLocaleString("pt-BR", {maximumFractionDigits:1});
  return Math.round(v).toLocaleString("pt-BR");
}
function _kpiSub(kind){
  return ({ sum:"soma no período", avg:"média no período", count:"registros no período",
            count_unique:"valores distintos", percent_positive:"respostas positivas" })[kind] || "";
}

/* Build renderable blocks from suggested metrics. Output uses the SAME schema
 * the Dashboard already consumes ({ id, kind, span, props }) so editing,
 * drag-and-drop, resize, paywall and export keep working untouched. */
function dashGenerateBlocks(profiles, metrics, rows){
  rows = rows || [];
  const PAL = ["#2f6bff","#0a8a4a","#7a5cff","#ff7849","#ff5e93","#0b1020"];
  const dt = (profiles || []).find(p => p.pattern === "datetime");
  const kpis = [], charts = [], usedCols = {};
  let nKpi = 0, nChart = 0;
  const track = (col)=> { if(col) usedCols[col] = 1; };

  (metrics || []).forEach(m => {
    const col = m.columns.primary;
    if(["sum","avg","count","count_unique","percent_positive"].indexOf(m.kind) >= 0){
      if(nKpi >= 4) return;
      let value = 0, spark = [];
      if(m.kind === "sum") value = _sum(rows, col);
      else if(m.kind === "avg") value = _avg(rows, col);
      else if(m.kind === "count") value = rows.length;
      else if(m.kind === "count_unique") value = _countUnique(rows, col);
      else if(m.kind === "percent_positive") value = _pctPositive(rows, col);
      if(dt && m.kind === "sum"){ spark = _monthly(rows, col, dt.name).map(d => d.v); }
      if(spark.length < 2) spark = [(value||0)*0.6, (value||0)*0.8, value||0];
      kpis.push({ id:"g-kpi-"+nKpi, kind:"kpi", span:3, props:{
        label: m.label, value: value,
        format: m.format === "currency" ? "brl" : m.format === "percent" ? "pct" : m.format === "scale" ? "scale" : "int",
        delta:"—", deltaDir:"up", sub: _kpiSub(m.kind), data: spark, color: PAL[nKpi % PAL.length]
      }});
      nKpi++; track(col);
    } else if(m.kind === "trend"){
      if(nChart >= 6 || !dt) return;
      const data = _monthly(rows, col, dt.name);
      if(data.length < 2) return;
      charts.push({ id:"g-chart-"+nChart, kind:"chart", span:8, props:{
        title: m.label, sub:"Evolução por mês", type:"area", dim: dt.name, agg:"sum",
        color: PAL[0], height:280, data: data
      }});
      nChart++; track(col); track(dt.name);
    } else if(m.kind === "top_n"){
      if(nChart >= 6) return;
      const g = _groupCount(rows, col).slice(0, 8);
      if(!g.length) return;
      charts.push({ id:"g-chart-"+nChart, kind:"chart", span:6, props:{
        title: m.label, sub:"Por frequência de registros", type:"bar", dim: col, agg:"count",
        color: PAL[1], height:260, data: g.map(d => ({ l:_short(d.l), v:d.v }))
      }});
      nChart++; track(col);
    } else if(m.kind === "distribution"){
      if(nChart >= 6) return;
      const gd = _groupCount(rows, col).slice(0, 6);
      if(!gd.length) return;
      charts.push({ id:"g-chart-"+nChart, kind:"chart", span:4, props:{
        title: m.label, sub:"Participação", type:"donut", dim: col, agg:"count",
        color: PAL[2], height:260, data: gd.map(d => ({ l:_short(d.l), v:d.v }))
      }});
      nChart++; track(col);
    } else if(m.kind === "frequency_by_item"){
      if(nChart >= 6) return;
      const fi = _freqItems(rows, col).slice(0, 8);
      if(!fi.length) return;
      charts.push({ id:"g-chart-"+nChart, kind:"chart", span:6, props:{
        title: m.label, sub:"Itens mais citados", type:"bar", dim: col, agg:"count",
        color: PAL[3], height:260, data: fi.map(d => ({ l:_short(d.l), v:d.v }))
      }});
      nChart++; track(col);
    }
  });

  const insights = _genInsights(profiles, rows);
  const confs = [];
  (profiles || []).forEach(p => { if(usedCols[p.name]) confs.push(p.confidence); });
  const overallConfidence = confs.length ? _round2(confs.reduce((a,b)=>a+b, 0)/confs.length) : 0;

  return { overallConfidence: overallConfidence, kpis: kpis, charts: charts, insights: insights };
}

/* Generate plain-language insight cards in the shape <Insights> already
 * consumes ({ cat, t, d, tag, ev, conf }). cat ∈ catMeta keys in dashboard.jsx. */
function _genInsights(profiles, rows){
  const out = [];
  const find = (pat)=> (profiles || []).find(p => p.pattern === pat);
  const dt = find("datetime");

  const mon = find("monetary");
  if(mon){
    const tot = _sum(rows, mon.name);
    out.push({ cat:"comparison", t:"Total de "+mon.name, tag:"Total", ev:_fmt(tot, "currency"),
      d:"Soma de "+mon.name+" em "+rows.length+" registros"+(dt ? ", com evolução temporal disponível." : "."),
      conf: Math.round(mon.confidence*100) });
  }
  const cat = find("category_low");
  if(cat){
    const g = _groupCount(rows, cat.name);
    if(g.length){
      const top = g[0], totc = g.reduce((a,b)=>a+b.v, 0);
      const pct = totc ? Math.round(top.v/totc*100) : 0;
      out.push({ cat:"comparison", t:'"'+top.l+'" lidera '+cat.name, tag:cat.name, ev:top.v+" de "+totc,
        d:"Categoria mais frequente, "+pct+"% dos registros.", conf: Math.round(cat.confidence*100) });
    }
  }
  const sc = find("scale");
  if(sc){
    const av = _avg(rows, sc.name);
    const mx = (sc.hints.scaleRange && sc.hints.scaleRange[1]) || 5;
    out.push({ cat:"trend", t:"Média de "+sc.name+": "+_fmt(av, "scale"), tag:"Escala", ev:_fmt(av, "scale")+" / "+mx,
      d:"Numa escala até "+mx+", a média das respostas é "+_fmt(av, "scale")+".", conf: Math.round(sc.confidence*100) });
  }
  const bo = find("boolean");
  if(bo){
    const pp = _pctPositive(rows, bo.name);
    out.push({ cat:"comparison", t:pp+"% positivo em "+bo.name, tag:"Booleano", ev:pp+"%",
      d:"Proporção de respostas positivas na coluna "+bo.name+".", conf: Math.round(bo.confidence*100) });
  }
  out.push({ cat:"trend", t:rows.length.toLocaleString("pt-BR")+" registros analisados", tag:"Cobertura",
    ev:(profiles||[]).length+" colunas", d:"Base com "+(profiles||[]).length+" colunas detectadas automaticamente.", conf:90 });

  const risky = (profiles || []).filter(p => p.stats.nullRatio > 0.2);
  if(risky.length){
    const r = risky[0];
    out.push({ cat:"risk", risk:true, t:"Dados faltantes em "+r.name, tag:"Qualidade", ev:r.stats.nullCount+" vazias",
      d:Math.round(r.stats.nullRatio*100)+"% das células estão vazias — pode enviesar as métricas.", conf:80 });
  }
  return out.slice(0, 6);
}

/* Which legacy sales presets still make sense for this dataset. Drives the
 * conditional preset bar in Commit 2 — a survey CSV shows only "Descoberta". */
function dashPresetCompat(profiles){
  profiles = profiles || [];
  const has = (pat)=> profiles.some(p => p.pattern === pat);
  const cats = profiles.filter(p => p.pattern === "category_low" || p.pattern === "category_high");
  const catName = (re)=> cats.some(p => re.test(String(p.name).toLowerCase()));

  const monetary = has("monetary");
  const datetime = has("datetime");
  const region  = catName(/regi|estado|^uf$|uf_|cidade|munic|state|local|pais|país/);
  const product = catName(/produt|item|sku|servic|serviç|modelo|curso|categoria/);
  const channel = catName(/canal|channel|origem|fonte|source|m[ií]dia|plataforma/);

  return {
    discovery: true,
    salesShape: !!(monetary && datetime && (region || product || channel || cats.length > 0)),
    region:  !!region,
    product: !!product,
    channel: !!channel,
    advanced: !!(monetary && datetime),
  };
}

Object.assign(window, {
  // canonical names
  dashProfileColumn, dashProfileColumns, dashSuggestMetrics, dashGenerateBlocks, dashPresetCompat,
  // short aliases for console / tests
  dashProfile: dashProfileColumn,
  dashProfiles: dashProfileColumns,
  dashSuggest: dashSuggestMetrics,
  dashGenerate: dashGenerateBlocks,
});
