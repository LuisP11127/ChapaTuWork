import { RUBROS, MODALIDADES, TIPOS, buscarRubro } from "./catalogo.js";
import { POR_PAGINA } from "./db.js";
import { GUIAS } from "./guias.js";
import { esc, haceCuanto, plural, textoCierre } from "./util.js";

// También la usa scripts/generar-paginas.mjs para las páginas estáticas (guías, privacidad).
export function layout({ titulo, descripcion, cuerpo, hayEjemplos = false }) {
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
  <script defer src="/medicion.js"></script>
</head>
<body>
  <header class="topbar">
    <div class="wrap topbar-in">
      <a class="logo" href="/"><img src="/logo.svg" alt="" width="32" height="32"><span>Chapa<b>Tu</b>Work</span></a>
      <nav class="nav">
        <a href="/empleos">Empleos</a>
        <a href="/#rubros">Rubros</a>
        <a href="/guias">Guías</a>
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
      <p class="pie-enlaces"><a href="/guias">Guías</a> · <a href="/resumen-semanal">Resumen semanal</a> · <a href="/privacidad">Privacidad</a></p>
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
  const cierre = textoCierre(o.cierra_en);
  // Talento Perú no tiene enlaces por convocatoria; el botón lleva a su buscador.
  const boton = o.url_postulacion?.startsWith("https://app.servir.gob.pe/") ? "Buscar en Talento Perú" : "Más información";
  return `<article class="oferta">
  <div class="oferta-cab">
    <a class="rubro" href="/rubro/${rubro.slug}">${esc(rubro.nombre)}</a>
    <time datetime="${esc(o.publicado_en)}">${esc(haceCuanto(o.publicado_en))}</time>
  </div>
  <h3>${esc(o.titulo)}</h3>
  ${lugar ? `<p class="lugar">${lugar}</p>` : ""}
  ${o.resumen ? `<p class="resumen">${esc(o.resumen)}</p>` : ""}
  <div class="oferta-pie">
    <ul class="etiquetas">${cierre ? `<li class="cierre${cierre.urgente ? " urgente" : ""}">${esc(cierre.texto)}</li>` : ""}${etiquetas.map((e) => `<li>${esc(e)}</li>`).join("")}${o.fuente === "ejemplo" ? `<li class="ejemplo">Ejemplo</li>` : ""}</ul>
    <a class="boton" href="/ir/${o.id}" target="_blank" rel="noopener nofollow">${boton} <span aria-hidden="true">↗</span></a>
  </div>
</article>`;
}

function listaOfertas(ofertas) {
  return `<div class="ofertas">${ofertas.map(tarjeta).join("\n")}</div>`;
}

export function paginaInicio({ conteo, total, recientes, departamentos, atajos }) {
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
      ${botonesAtajos({ atajos })}
    </div>
  </section>

  <section class="wrap seccion" id="rubros">
    <h2>Rubros</h2>
    <div class="rubros">${rubros}</div>
  </section>

  <section class="wrap seccion">
    <div class="seccion-cab">
      <h2>Guías para postular</h2>
      <a href="/guias">Ver todas</a>
    </div>
    <div class="guias">
      ${GUIAS.map((g) => `<a class="guia-card" href="/guias/${g.slug}"><span class="guia-titulo">${esc(g.titulo)}</span><span class="guia-desc">${esc(g.descripcion)}</span></a>`).join("")}
      <a class="guia-card" href="/resumen-semanal"><span class="guia-titulo">Resumen semanal de convocatorias por región</span><span class="guia-desc">Ofertas nuevas de los últimos 7 días en cada departamento y las que cierran pronto.</span></a>
    </div>
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

// Botones rápidos debajo del total. Cada uno es un filtro que se puede combinar.
const ATAJOS = [
  { clave: "sueldo", valor: "alto", texto: "Sueldo mayor al promedio", titulo: "Ofertas con sueldo mayor al promedio" },
  { clave: "cierre", valor: "pronto", texto: "Cierran pronto", titulo: "Cierran pronto" },
  { clave: "nuevas", valor: "1", texto: "Nuevas", titulo: "Ofertas nuevas" },
];

function soles(n) {
  return `S/ ${Math.round(n).toLocaleString("es-PE")}`;
}

function notaAtajo(a, atajos) {
  if (a.clave === "sueldo") return atajos.promedio ? `Sueldo mayor a ${soles(atajos.promedio)} al mes, el promedio de las ofertas que publican sueldo.` : "";
  if (a.clave === "cierre") return "Cierran hoy, mañana o pasado mañana.";
  return "Publicadas en los últimos 3 días.";
}

// En la portada llevan al listado y muestran cuántas ofertas hay; en el
// listado se activan o desactivan sobre los filtros actuales.
function botonesAtajos({ atajos, base = "/empleos", filtros = null }) {
  // Un atajo que incluiría todas las ofertas no filtra nada; se oculta salvo que
  // ya esté activo (para poder quitarlo).
  const visibles = ATAJOS.filter((a) => filtros?.[a.clave] || atajos[a.clave] < atajos.total);
  const botones = visibles.map((a) => {
    const activo = filtros?.[a.clave];
    const href = filtros ? enlacePagina(base, { ...filtros, [a.clave]: activo ? "" : a.valor }, 1) : `/empleos?${a.clave}=${a.valor}`;
    const extra = filtros ? (activo ? ` <span aria-hidden="true">×</span>` : "") : ` <span class="atajo-n">${atajos[a.clave].toLocaleString("es-PE")}</span>`;
    return `<a class="atajo${activo ? " activo" : ""}" href="${esc(href)}" title="${esc(notaAtajo(a, atajos))}">${esc(a.texto)}${extra}</a>`;
  });
  return `<nav class="atajos" aria-label="Atajos">${botones.join("")}</nav>`;
}

function enlacePagina(base, filtros, pagina) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);
  if (pagina > 1) params.set("pagina", String(pagina));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function paginaListado({ filtros, rubroFijo, ofertas, total, pagina, departamentos, atajos }) {
  const rubro = rubroFijo ? buscarRubro(rubroFijo) : filtros.rubro ? buscarRubro(filtros.rubro) : null;
  const atajosActivos = ATAJOS.filter((a) => filtros[a.clave]);
  const titulo = rubro
    ? rubro.nombre
    : filtros.q
      ? `Resultados para “${filtros.q}”`
      : (atajosActivos[0]?.titulo ?? "Todas las ofertas");
  const base = rubroFijo ? `/rubro/${rubroFijo}` : "/empleos";
  // En /rubro/:slug el rubro va en la ruta, no en la query.
  const filtrosUrl = rubroFijo ? { ...filtros, rubro: "" } : filtros;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = Object.values(filtros).some(Boolean);
  // Solo cuenta los filtros del formulario; los atajos se ven aparte.
  const activos = ["q", "rubro", "departamento", "modalidad", "tipo"].filter((k) => filtrosUrl[k]).length;

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
          ${atajosActivos.map((a) => `<input type="hidden" name="${a.clave}" value="${a.valor}">`).join("")}
        </div>
      </form>
    </details>
    <script>if (matchMedia("(min-width: 900px)").matches) document.querySelector(".filtros-caja").open = true;</script>
    <section>
      <div class="listado-cab">
        ${rubro ? `<p class="migas"><a href="/#rubros">Rubros</a> /</p>` : ""}
        <h1>${esc(titulo)}</h1>
        <p class="total">${plural(total, "oferta", "ofertas")}</p>
        ${botonesAtajos({ atajos, base, filtros: filtrosUrl })}
        ${atajosActivos.map((a) => notaAtajo(a, atajos)).filter(Boolean).map((n) => `<p class="nota">${esc(n)}</p>`).join("")}
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

function fechaCorta(d) {
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "long", timeZone: "UTC" });
}

// filas: [{ departamento, rubro, nuevas, cierran }]; proximas: hasta 3 ofertas por departamento.
export function paginaResumen({ filas, proximas, hoy }) {
  const fin = new Date(`${hoy}T12:00:00Z`);
  const inicio = new Date(fin.getTime() - 6 * 24 * 60 * 60 * 1000);
  const periodo = `del ${fechaCorta(inicio)} al ${fechaCorta(fin)}`;

  const regiones = new Map();
  for (const f of filas) {
    const nombre = f.departamento || "Sin departamento indicado";
    const r = regiones.get(nombre) ?? { nombre, departamento: f.departamento, nuevas: 0, cierran: 0, rubros: [] };
    r.nuevas += f.nuevas;
    r.cierran += f.cierran;
    r.rubros.push({ rubro: buscarRubro(f.rubro) ?? buscarRubro("otros"), n: f.nuevas });
    regiones.set(nombre, r);
  }
  // Las ofertas sin departamento van al final.
  const lista = [...regiones.values()].sort((a, b) => (!a.departamento - !b.departamento) || b.nuevas - a.nuevas);
  const total = lista.reduce((s, r) => s + r.nuevas, 0);

  let cuerpo;
  if (!total) {
    cuerpo = `<p class="vacio-msg">No hay convocatorias nuevas en los últimos 7 días (${periodo}). Vuelve pronto: el resumen se actualiza solo cuando se publican ofertas.</p>`;
  } else {
    const destacadas = lista
      .filter((r) => r.departamento)
      .slice(0, 3)
      .map((r) => `${esc(r.nombre)} (${r.nuevas.toLocaleString("es-PE")})`);
    const intro = `<p class="entrada">${periodo[0].toUpperCase() + periodo.slice(1)} se publicaron ${plural(total, "oferta nueva", "ofertas nuevas")} que siguen abiertas${destacadas.length ? `. Los departamentos con más ofertas fueron ${destacadas.join(", ").replace(/, ([^,]*)$/, " y $1")}` : ""}.</p>`;
    const secciones = lista.map((r) => {
      const rubros = r.rubros
        .sort((a, b) => b.n - a.n)
        .slice(0, 4)
        .map((x) => `${esc(x.rubro.nombre)} (${x.n})`)
        .join(", ");
      const cierran = proximas.filter((p) => p.departamento === r.departamento);
      const enlace = r.departamento ? `/empleos?departamento=${encodeURIComponent(r.departamento)}` : "/empleos";
      return `<section class="region" id="${esc(textoAncla(r.nombre))}">
      <h2>${esc(r.nombre)}</h2>
      <p class="cifras">${plural(r.nuevas, "oferta nueva", "ofertas nuevas")} · ${plural(r.cierran, "cierra", "cierran")} en los próximos 7 días</p>
      <p>Rubros con más ofertas: ${rubros}.</p>
      ${
        cierran.length
          ? `<p>Cierran primero:</p><ul>${cierran
              .map((p) => `<li><a href="/ir/${p.id}" rel="nofollow noopener" target="_blank">${esc(p.titulo)}</a>${p.empresa ? ` · ${esc(p.empresa)}` : ""} · ${esc(textoCierre(p.cierra_en)?.texto ?? "")}</li>`)
              .join("")}</ul>`
          : ""
      }
      <p><a href="${esc(enlace)}">Ver todas las ofertas${r.departamento ? ` en ${esc(r.nombre)}` : ""}</a></p>
    </section>`;
    });
    cuerpo = intro + secciones.join("\n");
  }

  return layout({
    titulo: "Resumen semanal de convocatorias por región",
    descripcion: "Ofertas de trabajo nuevas de los últimos 7 días en cada departamento del Perú, por rubro, y las que cierran pronto.",
    cuerpo: `
  <div class="wrap articulo">
    <p class="migas"><a href="/guias">Guías</a> /</p>
    <h1>Resumen semanal de convocatorias por región</h1>
    <p class="revision">Últimos 7 días: ${periodo}. Se actualiza solo con cada publicación.</p>
    ${cuerpo}
  </div>`,
  });
}

function textoAncla(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function tablaSimple(encabezados, filas) {
  if (!filas.length) return `<p class="vacio-msg">Todavía no hay datos.</p>`;
  return `<div class="tabla-envoltura"><table><thead><tr>${encabezados.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

export function paginaPanel({ porDia, porOrigen, ofertas, paginas }) {
  const vistas = porDia.reduce((s, d) => s + d.vistas, 0);
  const clics = porDia.reduce((s, d) => s + d.clics, 0);
  return layout({
    titulo: "Estadísticas",
    cuerpo: `
  <div class="wrap articulo panel">
    <h1>Estadísticas de los últimos 30 días</h1>
    <p class="revision">Solo cuentan navegadores reales: los robots que no ejecutan JavaScript no aparecen. Los días están en hora de Lima.</p>
    <div class="cifras-grandes">
      <div class="cifra"><b>${vistas.toLocaleString("es-PE")}</b>páginas vistas</div>
      <div class="cifra"><b>${clics.toLocaleString("es-PE")}</b>clics en ofertas</div>
    </div>
    <h2>De dónde llegan las visitas</h2>
    ${tablaSimple(["Origen", "Páginas vistas", "Clics en ofertas"], porOrigen.map((o) => [o.origen, o.vistas, o.clics]))}
    <h2>Ofertas con más clics</h2>
    ${tablaSimple(["Oferta", "Clics"], ofertas.map((o) => [o.oferta_titulo ?? `Oferta ${o.oferta_id}`, o.clics]))}
    <h2>Páginas más vistas</h2>
    ${tablaSimple(["Página", "Vistas"], paginas.map((p) => [p.ruta, p.vistas]))}
    <h2>Por día</h2>
    ${tablaSimple(["Día", "Páginas vistas", "Clics"], porDia.map((d) => [d.dia, d.vistas, d.clics]))}
  </div>`,
  });
}
