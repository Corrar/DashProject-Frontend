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
  //
  // Single-flight: o backend ROTACIONA o refresh e trata reapresentação de um
  // token já revogado como roubo (revoga todas as sessões do usuário). Duas
  // chamadas simultâneas com o mesmo cookie — boot do App + ?upgrade=ok, ou
  // duas requisições que tomam 401 juntas — derrubavam a sessão. Todas as
  // chamadas concorrentes reaproveitam a mesma promessa.
  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async function () {
      try {
        var res = await fetch(BASE + "/auth/refresh", { method: "POST", credentials: "include" });
        if (!res.ok) { setToken(null); return false; }
        var data = await res.json();
        setToken(data.access_token);
        return true;
      } catch (e) { setToken(null); return false; }
      finally { refreshing = null; }
    })();
    return refreshing;
  }

  var PUBLIC_AUTH = /^\/auth\/(login|signup|logout|refresh|request-reset|reset|verify-email)\b/;

  // fetch base: anexa Bearer + cookie; em 401 tenta refresh 1x e repete.
  async function raw(path, opts, retry) {
    opts = opts || {};
    if (retry === undefined) retry = true;
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (accessToken) headers["Authorization"] = "Bearer " + accessToken;
    var res = await fetch(BASE + path, Object.assign({}, opts, { headers: headers, credentials: "include" }));
    // Rotas públicas de /auth (login com senha errada, logout…) respondem 401
    // por motivo próprio — não é token expirado, então não gastam um refresh.
    // /auth/resend-verification exige login e renova normalmente.
    if (res.status === 401 && retry && !PUBLIC_AUTH.test(path)) {
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
    // plan: 'essencial' | 'pro'    method: 'card' | 'pix'    cycle: 'monthly' | 'yearly'
    // 'card' = assinatura recorrente; 'pix' = entrada avulsa (boleto fica nas
    // renovações geradas pelo job no backend). Redireciona pro checkout do Asaas.
    async checkout(plan, method, cycle) {
      var d = await json("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: plan, method: method || "card", cycle: cycle === "yearly" ? "yearly" : "monthly" }),
      });
      if (d && d.url) { window.location.href = d.url; }
      return d;
    },
    // Troca de tier e/ou ciclo na assinatura do cartão. Upgrade: na hora;
    // downgrade e troca de ciclo: na próxima cobrança.
    // Resolve em { ok, plan, cycle, effective: 'now'|'next_cycle' }.
    changePlan: function (plan, cycle) {
      var body = { plan: plan };
      if (cycle) body.cycle = cycle;
      return json("/billing/change-plan", { method: "POST", body: JSON.stringify(body) });
    },
    // Cancela a assinatura (cartão). A renovação para e o acesso segue até o fim
    // do período pago. Resolve em { ok, accessUntil }.
    cancel: function () { return json("/billing/cancel", { method: "POST" }); },

    // ── conta (perfil, segurança, LGPD) ─────────────────────────────────
    resendVerification: function () { return json("/auth/resend-verification", { method: "POST" }); },
    updateProfile: function (fullName) {
      return json("/me", { method: "PATCH", body: JSON.stringify({ fullName: fullName || null }) });
    },
    // Troca a senha e encerra as outras sessões. Resolve em { ok, revoked }.
    changePassword: function (current, next) {
      return json("/me/password", { method: "POST", body: JSON.stringify({ current: current, next: next }) });
    },
    listSessions: function () { return json("/me/sessions"); },
    revokeSession: function (id) { return json("/me/sessions/" + encodeURIComponent(id), { method: "DELETE" }); },
    revokeOtherSessions: function () { return json("/me/sessions/revoke-others", { method: "POST" }); },
    aiUsage: function () { return json("/me/ai-usage"); },
    joinWaitlist: function (feature, source) {
      return json("/me/waitlist", { method: "POST", body: JSON.stringify({ feature: feature, source: source || null }) });
    },
    // Tudo o que o servidor guarda da conta (portabilidade, LGPD).
    exportData: function () { return json("/me/export"); },
    // Exclui a conta: o backend cancela a assinatura e apaga os dados. Encerra a sessão local.
    async deleteAccount(password) {
      var d = await json("/me", { method: "DELETE", body: JSON.stringify({ password: password, confirm: "EXCLUIR" }) });
      setToken(null); emit(null);
      return d;
    },
    billingHistory: function () { return json("/billing/history"); },

    // ── links públicos (Pro) ────────────────────────────────────────────
    // payload = retrato do dashboard (blocos com valores agregados, sem linhas
    // do arquivo). 402 = plano sem links públicos · 409 limite_links.
    createShare: function (title, payload) {
      return json("/share", { method: "POST", body: JSON.stringify({ title: title, payload: payload }) });
    },
    listShares: function () { return json("/share"); },
    revokeShare: function (slug) {
      return json("/share/" + encodeURIComponent(slug), { method: "DELETE" });
    },
    // Público: abre sem login (404 se desativado ou se o dono saiu do Pro).
    getShare: function (slug) { return json("/share/" + encodeURIComponent(slug)); },

    // ── análise por IA (cota mensal: Free 1 · Essencial 50 · Pro 300) ────
    // payload: { datasetName, columns:[{name,type?}], sampleRows:[{}], question? }
    // 401 = sem sessão · 429 = quota de IA do mês excedida.
    analyze: function (payload) {
      return json("/tools/analyze", { method: "POST", body: JSON.stringify(payload) });
    },
  };
})();
