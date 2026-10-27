import { RUBROS, MODALIDADES, TIPOS, buscarRubro } from "./catalogo.js";
import { POR_PAGINA } from "./db.js";
import { esc, haceCuanto, plural } from "./util.js";

function layout({ titulo, descripcion, cuerpo, hayEjemplos = false }) {
  const tituloCompleto = titulo ? `${titulo} · ChapaTuWork` : "ChapaTuWork · Ofertas de trabajo en Perú";
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(tituloCompleto)}</title>
  <meta name="description" content="${esc(descripcion ?? "Ofertas de trabajo en todo el Perú, ordenadas por rubro.")}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#d9480f">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="wrap topbar-in">
      <a class="logo" href="/"><img src="/logo.svg" alt="" width="32" height="32"><span>Chapa<b>Tu</b>Work</span></a>
      <nav class="nav">
        <a href="/empleos">Empleos</a>
        <a href="/#rubros">Rubros</a>
      </nav>
    </div>
  </header>
  ${hayEjemplos ? `<div class="aviso"><div class="wrap">Estas ofertas son de ejemplo, para revisar el diseño. Todavía no hay fuentes reales conectadas.</div></div>` : ""}
  <main>
${cuerpo}
  </main>
  <footer class="pie">
    <div class="wrap">
      <p>ChapaTuWork reúne ofertas publicadas en otros sitios. Para postular, te llevamos a la página original de cada oferta.</p>
      <p>© ${new Date().getFullYear()} ChapaTuWork</p>
    </div>
  </footer>
</body>
</html>`;
}

function opciones(valores, seleccionado, vacio) {
  const items = valores.map(
    ([valor, texto]) => `<option value="${esc(valor)}"${valor === seleccionado ? " selected" : ""}>${esc(texto)}</option>`,
  );
  return `<option value="">${esc(vacio)}</option>${items.join("")}`;
}

function tarjeta(o) {
  const rubro = buscarRubro(o.rubro) ?? buscarRubro("otros");
  const lugar = [o.empresa, o.ubicacion ?? o.departamento].filter(Boolean).map(esc).join(" · ");
  const etiquetas = [MODALIDADES[o.modalidad], TIPOS[o.tipo], o.salario].filter(Boolean);
  return `<article class="oferta">
  <div class="oferta-cab">
    <a class="rubro" href="/rubro/${rubro.slug}">${esc(rubro.nombre)}</a>
    <time datetime="${esc(o.publicado_en)}">${esc(haceCuanto(o.publicado_en))}</time>
  </div>
  <h3>${esc(o.titulo)}</h3>
  ${lugar ? `<p class="lugar">${lugar}</p>` : ""}
  ${o.resumen ? `<p class="resumen">${esc(o.resumen)}</p>` : ""}
  <div class="oferta-pie">
    <ul class="etiquetas">${etiquetas.map((e) => `<li>${esc(e)}</li>`).join("")}${o.fuente === "ejemplo" ? `<li class="ejemplo">Ejemplo</li>` : ""}</ul>
    <a class="boton" href="/ir/${o.id}" target="_blank" rel="noopener nofollow">Más información <span aria-hidden="true">↗</span></a>
  </div>
</article>`;
}

function listaOfertas(ofertas) {
  return `<div class="ofertas">${ofertas.map(tarjeta).join("\n")}</div>`;
}

export function paginaInicio({ conteo, total, recientes, departamentos }) {
  const rubros = RUBROS.map((r) => {
    const n = conteo[r.slug] ?? 0;
    return `<a class="rubro-card${n ? "" : " vacio"}" href="/rubro/${r.slug}">
      <span class="rubro-nombre">${esc(r.nombre)}</span>
      <span class="rubro-n">${plural(n, "oferta", "ofertas")}</span>
    </a>`;
  }).join("\n");

  const cuerpo = `
  <section class="hero">
    <div class="wrap">
      <h1>Encuentra trabajo en todo el Perú</h1>
      <p>Ofertas de distintos portales en un solo lugar, ordenadas por rubro.</p>
      <form class="buscador" action="/empleos" method="get" role="search">
        <label class="sr" for="q">Puesto o empresa</label>
        <input id="q" name="q" type="search" placeholder="Puesto, empresa o palabra clave" autocomplete="off">
        <label class="sr" for="departamento">Departamento</label>
        <select id="departamento" name="departamento">${opciones(departamentos.map((d) => [d, d]), "", "Todo el Perú")}</select>
        <button type="submit">Buscar</button>
      </form>
      <p class="hero-total">${plural(total, "oferta disponible", "ofertas disponibles")}</p>
    </div>
  </section>

  <section class="wrap seccion" id="rubros">
    <h2>Rubros</h2>
    <div class="rubros">${rubros}</div>
  </section>

  <section class="wrap seccion">
    <div class="seccion-cab">
      <h2>Ofertas recientes</h2>
      <a href="/empleos">Ver todas</a>
    </div>
    ${recientes.length ? listaOfertas(recientes) : `<p class="vacio-msg">Todavía no hay ofertas publicadas.</p>`}
  </section>`;

  return layout({ cuerpo, hayEjemplos: recientes.some((o) => o.fuente === "ejemplo") });
}

function enlacePagina(base, filtros, pagina) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);
  if (pagina > 1) params.set("pagina", String(pagina));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function paginaListado({ filtros, rubroFijo, ofertas, total, pagina, departamentos }) {
  const rubro = rubroFijo ? buscarRubro(rubroFijo) : filtros.rubro ? buscarRubro(filtros.rubro) : null;
  const titulo = rubro ? rubro.nombre : filtros.q ? `Resultados para “${filtros.q}”` : "Todas las ofertas";
  const base = rubroFijo ? `/rubro/${rubroFijo}` : "/empleos";
  // En /rubro/:slug el rubro va en la ruta, no en la query.
  const filtrosUrl = rubroFijo ? { ...filtros, rubro: "" } : filtros;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = Object.values(filtros).some(Boolean);
  const activos = Object.values(filtrosUrl).filter(Boolean).length;

  const paginacion =
    paginas > 1
      ? `<nav class="paginacion" aria-label="Paginación">
      ${pagina > 1 ? `<a href="${esc(enlacePagina(base, filtrosUrl, pagina - 1))}">← Anterior</a>` : `<span></span>`}
      <span>Página ${pagina} de ${paginas}</span>
      ${pagina < paginas ? `<a href="${esc(enlacePagina(base, filtrosUrl, pagina + 1))}">Siguiente →</a>` : `<span></span>`}
    </nav>`
      : "";

  const cuerpo = `
  <div class="wrap listado">
    <details class="filtros-caja"${activos ? " open" : ""}>
      <summary>Filtrar${activos ? ` (${activos})` : ""}</summary>
      <form class="filtros" action="/empleos" method="get">
        <label>Palabra clave
          <input name="q" type="search" value="${esc(filtros.q)}" placeholder="Puesto o empresa">
        </label>
        <label>Rubro
          <select name="rubro">${opciones(RUBROS.map((r) => [r.slug, r.nombre]), rubro?.slug ?? "", "Todos")}</select>
        </label>
        <label>Departamento
          <select name="departamento">${opciones(departamentos.map((d) => [d, d]), filtros.departamento, "Todo el Perú")}</select>
        </label>
        <label>Modalidad
          <select name="modalidad">${opciones(Object.entries(MODALIDADES), filtros.modalidad, "Cualquiera")}</select>
        </label>
        <label>Tipo de empleo
          <select name="tipo">${opciones(Object.entries(TIPOS), filtros.tipo, "Cualquiera")}</select>
        </label>
        <div class="filtros-acciones">
          <button type="submit">Aplicar</button>
          ${hayFiltros || rubroFijo ? `<a href="/empleos">Limpiar</a>` : ""}
        </div>
      </form>
    </details>
    <script>if (matchMedia("(min-width: 900px)").matches) document.querySelector(".filtros-caja").open = true;</script>
    <section>
      <div class="listado-cab">
        ${rubro ? `<p class="migas"><a href="/#rubros">Rubros</a> /</p>` : ""}
        <h1>${esc(titulo)}</h1>
        <p class="total">${plural(total, "oferta", "ofertas")}</p>
      </div>
      ${ofertas.length ? listaOfertas(ofertas) : `<p class="vacio-msg">No encontramos ofertas con esos filtros. Prueba quitando alguno.</p>`}
      ${paginacion}
    </section>
  </div>`;

  return layout({
    titulo: rubro ? `Empleos de ${rubro.nombre}` : "Empleos",
    descripcion: rubro ? `Ofertas de trabajo de ${rubro.nombre} en Perú.` : undefined,
    cuerpo,
    hayEjemplos: ofertas.some((o) => o.fuente === "ejemplo"),
  });
}

export function pagina404() {
  return layout({
    titulo: "Página no encontrada",
    cuerpo: `<div class="wrap mensaje"><h1>No encontramos esta página</h1><p><a href="/empleos">Ver las ofertas de trabajo</a></p></div>`,
  });
}

export function paginaError() {
  return layout({
    titulo: "Error",
    cuerpo: `<div class="wrap mensaje"><h1>Algo salió mal</h1><p>Intenta de nuevo en unos minutos.</p></div>`,
  });
}
