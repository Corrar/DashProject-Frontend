/* components/pwa.js — app instalável (PWA). JS puro, carregado como o api.js.
 *
 * Registra o service worker (sw.js) e guarda o evento de instalação do
 * navegador para o botão "Instalar o app" do Painel. Expõe window.DashPWA:
 *
 *   DashPWA.status()    "installed" | "available" | "ios" | "manual"
 *                       installed = já abriu como app; available = o navegador
 *                       deixa instalar por botão (Chrome, Edge, Android);
 *                       ios = Safari (instala pelo menu Compartilhar);
 *                       manual = outros (menu do navegador, se suportar).
 *   DashPWA.install()   abre o pedido de instalação → "accepted" | "dismissed" | "unavailable"
 *   DashPWA.onChange(fn) avisa quando o status muda (devolve a função de cancelar)
 *   DashPWA.standalone() true quando está rodando como app instalado
 */
(function () {
  var deferred = null;
  var installed = false;
  var listeners = new Set();

  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function standalone() {
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
        window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  function isIOS() {
    var ua = window.navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  // Não chama preventDefault: o navegador continua oferecendo a instalação do
  // jeito dele (ícone na barra de endereço, aviso no Android) para qualquer
  // visitante; o evento fica guardado para o botão do Painel.
  window.addEventListener("beforeinstallprompt", function (e) { deferred = e; emit(); });
  window.addEventListener("appinstalled", function () {
    installed = true; deferred = null; emit();
    window.dashTrack && window.dashTrack("app_instalado");
  });

  var local = /^(localhost|127\.|\[::1\])/.test(window.location.hostname);
  if ("serviceWorker" in navigator && (window.location.protocol === "https:" || local)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    });
  }

  window.DashPWA = {
    standalone: standalone,
    status: function () {
      if (installed || standalone()) return "installed";
      if (deferred) return "available";
      if (isIOS()) return "ios";
      return "manual";
    },
    install: function () {
      if (!deferred) return Promise.resolve("unavailable");
      var ev = deferred;
      deferred = null;
      return ev.prompt().then(function () { return ev.userChoice; })
        .then(function (c) { emit(); return (c && c.outcome) || "dismissed"; })
        .catch(function () { emit(); return "unavailable"; });
    },
    onChange: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; },
  };
})();
