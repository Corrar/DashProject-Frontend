/* components/py-worker.js — Web Worker que roda o motor pandas (engine/dash_engine.py)
 * dentro do Pyodide (Python compilado para WebAssembly).
 *
 * Por que um worker: carregar o Pyodide e tratar 100 mil linhas leva alguns
 * segundos; no thread principal isso congelaria a tela. Aqui a UI segue fluida.
 *
 * Os dados nunca saem do navegador: o worker só baixa o runtime (Pyodide +
 * numpy + pandas) do CDN, uma vez, e o navegador guarda em cache.
 *
 * Protocolo (postMessage):
 *   → { type:"warm", engineUrl }                 começa a carregar
 *   → { type:"run", id, payload }                payload = JSON string p/ dash_engine.run
 *   ← { type:"status", status:"loading"|"ready"|"failed", error? }
 *   ← { type:"result", id, json }                json = string devolvida pelo Python
 *   ← { type:"error", id, error }
 */
/* global importScripts, loadPyodide */
var PYODIDE_VERSION = "0.27.7"; // Python 3.12 · numpy 2.0.2 · pandas 2.2.3 (testado em engine/tests)
var PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

var booting = null;
var runFn = null;

function boot(engineUrl) {
  if (booting) return booting;
  self.postMessage({ type: "status", status: "loading" });
  booting = (async function () {
    importScripts(PYODIDE_BASE + "pyodide.js");
    var py = await loadPyodide({ indexURL: PYODIDE_BASE });
    await py.loadPackage(["numpy", "pandas"]);
    var res = await fetch(engineUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error("motor indisponível (" + res.status + ")");
    var src = await res.text();
    py.FS.mkdirTree("/home/pyodide/dash");
    py.FS.writeFile("/home/pyodide/dash/dash_engine.py", src);
    py.runPython("import sys\nif '/home/pyodide/dash' not in sys.path: sys.path.insert(0, '/home/pyodide/dash')");
    runFn = py.pyimport("dash_engine").run;
    self.postMessage({ type: "status", status: "ready" });
  })();
  booting.catch(function (e) {
    self.postMessage({ type: "status", status: "failed", error: String((e && e.message) || e) });
  });
  return booting;
}

self.onmessage = async function (ev) {
  var msg = ev.data || {};
  if (msg.type === "warm") {
    boot(msg.engineUrl).catch(function () {});
    return;
  }
  if (msg.type === "run") {
    try {
      await boot(msg.engineUrl);
      // run() nunca lança: devolve {"ok":false,...} e o front cai para o motor JS.
      var out = await runFn(msg.payload);
      self.postMessage({ type: "result", id: msg.id, json: String(out) });
    } catch (e) {
      self.postMessage({ type: "error", id: msg.id, error: String((e && e.message) || e) });
    }
  }
};
