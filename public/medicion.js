// Medición propia: avisa al servidor qué página se vio y en qué oferta se hizo
// clic, junto con el sitio desde el que llegó la visita. No usa cookies; el
// origen se guarda en sessionStorage mientras dure la pestaña.
(() => {
  // Navegadores controlados por programas (pruebas, robots) se ignoran.
  if (navigator.webdriver) return;

  function origen() {
    try {
      const guardado = sessionStorage.getItem("ctw-origen");
      if (guardado) return guardado;
      // Enlaces con ?utm_source=whatsapp (u otro) marcan el origen a mano.
      let o = new URLSearchParams(location.search).get("utm_source") || "";
      if (!o && document.referrer) {
        const host = new URL(document.referrer).hostname;
        if (host !== location.hostname) o = host;
      }
      o = (o || "directo").toLowerCase().slice(0, 80);
      sessionStorage.setItem("ctw-origen", o);
      return o;
    } catch {
      return "desconocido";
    }
  }

  function enviar(datos) {
    try {
      navigator.sendBeacon("/medir", JSON.stringify(datos));
    } catch {
      // Sin medición si el navegador no lo permite.
    }
  }

  const o = origen();
  enviar({ t: "vista", r: location.pathname, o });

  document.addEventListener("click", (ev) => {
    const enlace = ev.target.closest && ev.target.closest('a[href^="/ir/"]');
    if (!enlace) return;
    const id = Number(enlace.getAttribute("href").split("/")[2]);
    if (id) enviar({ t: "clic", r: location.pathname, o, id });
  });
})();
