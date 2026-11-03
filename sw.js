/* sw.js — service worker do Dash (app instalável / PWA).
 *
 * O que ele faz:
 *  - Guarda a "casca" do app (index.html, componentes, ícones) para abrir
 *    rápido e funcionar como app instalado.
 *  - Arquivos do próprio site: REDE PRIMEIRO, cache só se a rede falhar. Assim
 *    um deploy novo vale na hora (misturar .jsx antigo com novo quebraria o app).
 *  - React/Babel/SheetJS/html-to-image do CDN têm versão fixa na URL: CACHE
 *    PRIMEIRO. Fontes do Google: devolve o cache e atualiza por trás.
 *
 * O que ele NUNCA faz (privacidade e segurança):
 *  - Não toca na API (login, conta, IA, links): passa direto, sem cache.
 *  - Não guarda URLs com token (?reset=, ?verify=, ?s=): a página sempre é
 *    guardada como "/" e só ela.
 *  - Não intercepta o Pyodide (cdn.jsdelivr.net): o worker do motor pandas
 *    baixa direto, com a CSP dele.
 * A CSP deste arquivo é própria (vercel.json): connect-src só nas origens abaixo.
 */
var VERSION = "dash-v1";
var SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
var PINNED_CDN = ["https://unpkg.com", "https://cdn.sheetjs.com"];
var FONTS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(SHELL); })
      .catch(function () {})            // sem rede na instalação: segue sem a casca
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function put(key, res) {
  if (!res || !res.ok || (res.type !== "basic" && res.type !== "cors")) return res;
  var copy = res.clone();
  caches.open(VERSION).then(function (c) { c.put(key, copy); }).catch(function () {});
  return res;
}

function networkFirst(req, key) {
  return fetch(req)
    .then(function (res) { return put(key || req, res); })
    .catch(function () {
      return caches.match(key || req).then(function (hit) { return hit || Response.error(); });
    });
}

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) { return put(req, res); });
  });
}

function staleWhileRevalidate(req) {
  return caches.match(req).then(function (hit) {
    var fresh = fetch(req).then(function (res) { return put(req, res); }).catch(function () { return hit; });
    return hit || fresh;
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf("/_vercel/") === 0) return;          // métricas da Vercel
    if (req.mode === "navigate") {
      // Qualquer navegação vira a chave "/": nunca guarda ?reset=, ?verify=, ?s=.
      event.respondWith(networkFirst(req, "/"));
      return;
    }
    event.respondWith(networkFirst(req));
    return;
  }
  if (PINNED_CDN.indexOf(url.origin) !== -1) { event.respondWith(cacheFirst(req)); return; }
  if (FONTS.indexOf(url.origin) !== -1) { event.respondWith(staleWhileRevalidate(req)); return; }
  // Todo o resto (API do Dash, Pyodide, outros) passa direto, sem cache.
});
