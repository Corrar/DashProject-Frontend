/* components/api.js — cliente da API Dash (backend próprio Asaas + auth JWT).
 *
 * CARREGAR ANTES dos componentes (em Dash.html), como <script> NORMAL
 * (NÃO type="text/babel") — é JS puro, sem JSX.
 *
 * Expõe window.DashAPI. Guarda o access token só em memória; o refresh token
 * vive num cookie httpOnly (mandado automaticamente via credentials:'include').
 * Faz auto-refresh transparente em 401.
 *
 * Config: window.__API_URL deve apontar pra base da API (ex.: a URL da Render).
 */
(function () {
  var BASE = (window.__API_URL || "").replace(/\/+$/, "");
  var accessToken = null;
  var listeners = new Set();

  function setToken(t) { accessToken = t || null; }
  function onAuthChange(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
  function emit(user) { listeners.forEach(function (fn) { try { fn(user); } catch (e) {} }); }

  // Tenta renovar o access token usando o cookie de refresh. Retorna bool.
  async function refresh() {
    try {
      var res = await fetch(BASE + "/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) { setToken(null); return false; }
      var data = await res.json();
      setToken(data.access_token);
      return true;
    } catch (e) { setToken(null); return false; }
  }

  // fetch base: anexa Bearer + cookie; em 401 tenta refresh 1x e repete.
  async function raw(path, opts, retry) {
    opts = opts || {};
    if (retry === undefined) retry = true;
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (accessToken) headers["Authorization"] = "Bearer " + accessToken;
    var res = await fetch(BASE + path, Object.assign({}, opts, { headers: headers, credentials: "include" }));
    if (res.status === 401 && retry && path !== "/auth/refresh") {
      if (await refresh()) return raw(path, opts, false);
    }
    return res;
  }

  // Helper JSON: parseia e, em erro, lança Error com .status e .data.
  async function json(path, opts) {
    var res = await raw(path, opts);
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error((data && data.error) || ("http_" + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.DashAPI = {
    // ── estado / eventos ────────────────────────────────────────────────
    onAuthChange: onAuthChange,
    isAuthenticated: function () { return !!accessToken; },

    // ── auth ────────────────────────────────────────────────────────────
    async signup(email, password, fullName) {
      var d = await json("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password, full_name: fullName || null }),
      });
      setToken(d.access_token);
      emit(d.user || null);
      return d.user;
    },
    async login(email, password) {
      var d = await json("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password }),
      });
      setToken(d.access_token);
      emit(d.user || null);
      return d.user;
    },
    async logout() {
      try { await json("/auth/logout", { method: "POST" }); }
      finally { setToken(null); emit(null); }
    },
    // Chamado no boot: se não há token em memória, tenta refresh (sessão via
    // cookie). Retorna o perfil completo (/me) ou null se não logado.
    async me() {
      if (!accessToken && !(await refresh())) { emit(null); return null; }
      try {
        var u = await json("/me");
        emit(u);
        return u;
      } catch (e) {
        if (e.status === 401) { setToken(null); emit(null); return null; }
        throw e;
      }
    },
    verifyEmail: function (token) {
      return json("/auth/verify-email", { method: "POST", body: JSON.stringify({ token: token }) });
    },
    requestReset: function (email) {
      return json("/auth/request-reset", { method: "POST", body: JSON.stringify({ email: email }) });
    },
    resetPassword: function (token, password) {
      return json("/auth/reset", { method: "POST", body: JSON.stringify({ token: token, password: password }) });
    },

    // ── billing (Asaas) ─────────────────────────────────────────────────
    // plan: 'essencial' | 'pro'    method: 'card' | 'pix'
    // 'card' = assinatura recorrente; 'pix' = entrada avulsa (boleto fica nas
    // renovações geradas pelo job no backend). Redireciona pro checkout do Asaas.
    async checkout(plan, method) {
      var d = await json("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: plan, method: method || "card" }),
      });
      if (d && d.url) { window.location.href = d.url; }
      return d;
    },
    // Cancela a assinatura (cartão). O downgrade pra free vem pelo webhook.
    cancel: function () { return json("/billing/cancel", { method: "POST" }); },

    // ── ferramenta paga (IA) ────────────────────────────────────────────
    // payload: { datasetName, columns:[{name,type?}], sampleRows:[{}], question? }
    // 402 = plano insuficiente · 429 = quota de IA do mês excedida.
    analyze: function (payload) {
      return json("/tools/analyze", { method: "POST", body: JSON.stringify(payload) });
    },
  };
})();
