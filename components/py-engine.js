/* components/py-engine.js — ponte entre a UI e o motor pandas (Pyodide em Web Worker).
 *
 * Carregar como <script> NORMAL (não text/babel), antes dos componentes, como o api.js.
 * Expõe window.DashPy:
 *
 *   DashPy.warm()                 começa a baixar o runtime (idempotente). O UploadView
 *                                 chama ao abrir, então quando a pessoa escolhe o arquivo
 *                                 o motor costuma já estar pronto.
 *   DashPy.status()               "idle" | "loading" | "ready" | "failed" | "unsupported"
 *   DashPy.onStatus(fn)           assina mudanças de status (devolve a função de cancelar)
 *   DashPy.analyze(payload, opt)  → Promise<fileInfo parcial | null>. null = use o motor
 *                                 JavaScript (motor indisponível, base grande demais,
 *                                 timeout ou erro). Nunca rejeita.
 *
 * O motor JS (dashboard.jsx / dashboard-discovery.jsx) continua sendo o fallback:
 * se o Pyodide não carregar (rede, CSP, navegador antigo), nada quebra.
 */
(function () {
  // URL absoluta: dentro do worker, um caminho relativo resolveria a partir de
  // components/ (onde está o py-worker.js), não da raiz do site.
  var ENGINE_URL = new URL("engine/dash_engine.py", document.baseURI).href;
  var WORKER_URL = "components/py-worker.js";
  // Acima disso o pandas no WebAssembly fica lento demais para a UX; o motor JS assume.
  var MAX_ROWS = 200000;
  var BOOT_TIMEOUT_MS = 45000; // 1ª carga baixa ~10 MB; depois vem do cache
  var RUN_TIMEOUT_MS = 60000;

  var worker = null;
  var status = "idle";
  var lastError = null;
  var listeners = new Set();
  var pending = new Map();
  var seq = 0;
  var readyWaiters = [];

  function setStatus(s, err) {
    status = s;
    if (err) lastError = err;
    listeners.forEach(function (fn) { try { fn(s); } catch (e) {} });
    if (s === "ready" || s === "failed") {
      var ws = readyWaiters; readyWaiters = [];
      ws.forEach(function (w) { w(s === "ready"); });
    }
  }

  function ensureWorker() {
    if (worker || status === "unsupported" || status === "failed") return worker;
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
      setStatus("unsupported");
      return null;
    }
    try {
      worker = new Worker(WORKER_URL);
    } catch (e) {
      setStatus("failed", String(e && e.message || e));
      return null;
    }
    worker.onmessage = function (ev) {
      var m = ev.data || {};
      if (m.type === "status") { setStatus(m.status, m.error); return; }
      var p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.type === "result") p.resolve(m.json);
      else p.resolve(null);
    };
    worker.onerror = function (e) {
      setStatus("failed", (e && e.message) || "erro no worker");
      pending.forEach(function (p) { clearTimeout(p.timer); p.resolve(null); });
      pending.clear();
    };
    return worker;
  }

  function warm() {
    var w = ensureWorker();
    if (w && status === "idle") {
      setStatus("loading");
      w.postMessage({ type: "warm", engineUrl: ENGINE_URL });
    }
  }

  function waitReady(ms) {
    if (status === "ready") return Promise.resolve(true);
    if (status === "failed" || status === "unsupported") return Promise.resolve(false);
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(false); } }, ms);
      readyWaiters.push(function (ok) { if (!done) { done = true; clearTimeout(t); resolve(ok); } });
    });
  }

  function runRaw(payload) {
    var w = ensureWorker();
    if (!w) return Promise.resolve(null);
    var id = ++seq;
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { pending.delete(id); resolve(null); }, RUN_TIMEOUT_MS);
      pending.set(id, { resolve: resolve, timer: timer });
      w.postMessage({ type: "run", id: id, payload: JSON.stringify(payload), engineUrl: ENGINE_URL });
    });
  }

  // "AAAA-MM-DD" → Date LOCAL (mesma convenção do dashParseDate: meia-noite local,
  // senão o fuso UTC−3 joga cada ponto para o dia anterior).
  function localDate(s) {
    if (!s) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    var dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Resultado do Python → partes do fileInfo no formato que o Dashboard já consome.
  function toFileInfo(r) {
    var header = r.header, cols = r.columns, n = r.rows;
    var isDate = {};
    (r.schema || []).forEach(function (c) { if (c.type === "date") isDate[c.name] = true; });
    var data = new Array(n);
    for (var i = 0; i < n; i++) {
      var o = {};
      for (var j = 0; j < header.length; j++) {
        var h = header[j], v = cols[h][i];
        o[h] = isDate[h] ? localDate(v) : v;
      }
      data[i] = o;
    }
    return {
      rows: n,
      cols: header.length,
      schema: r.schema,
      profiles: r.profiles,
      data: data,
      engine: {
        name: "pandas",
        version: r.engineVersion,
        pandas: r.pandasVersion,
        roles: r.roles,
        salesShape: !!r.salesShape,
        quality: r.quality,
        insights: r.insights || [],
        highlights: r.highlights || [],
        summary: r.summary || "",
        facts: r.facts || [],
      },
    };
  }

  // payload: { kind:"matrix", matrix:[[...]] } ou { kind:"json", text }.
  // opt.rows: número de linhas (para o corte de MAX_ROWS); opt.waitMs: quanto
  // esperar o runtime carregar antes de desistir e usar o motor JS.
  async function analyze(payload, opt) {
    opt = opt || {};
    try {
      if (opt.rows != null && opt.rows > MAX_ROWS) return null;
      warm();
      var ok = await waitReady(opt.waitMs != null ? opt.waitMs : BOOT_TIMEOUT_MS);
      if (!ok) return null;
      var json = await runRaw(payload);
      if (!json) return null;
      var r = JSON.parse(json);
      if (!r || !r.ok) return null;
      return toFileInfo(r);
    } catch (e) {
      return null;
    }
  }

  window.DashPy = {
    warm: warm,
    status: function () { return status; },
    lastError: function () { return lastError; },
    onStatus: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; },
    analyze: analyze,
    MAX_ROWS: MAX_ROWS,
  };
})();
