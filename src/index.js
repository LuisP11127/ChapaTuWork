import { MODALIDADES, RUBROS, TIPOS, buscarRubro } from "./catalogo.js";
import {
  datosInicio,
  estadisticas,
  listarDepartamentos,
  listarOfertas,
  registrarClic,
  registrarVista,
  resumenAtajos,
  resumenSemanal,
  sumarClic,
  urlDeOferta,
} from "./db.js";
import { GUIAS, REVISION_GUIAS_ISO } from "./guias.js";
import { hoyEnLima, normalizarOrigen } from "./util.js";
import { pagina404, paginaError, paginaInicio, paginaListado, paginaPanel, paginaResumen } from "./vistas.js";

// Las ofertas solo cambian al importar un archivo (y al pasar su fecha de
// cierre), así que las páginas se guardan en la caché de Cloudflare. Sin esto,
// cada visita, incluidas las de robots, lee la tabla entera en D1 y se agota
// el límite diario del plan gratuito.
const SEGUNDOS_PAGINA = 60 * 60;
// Copia de cada página para mostrar si D1 falla (por ejemplo, si se agota el límite).
const SEGUNDOS_RESPALDO = 7 * 24 * 60 * 60;

function html(cuerpo, status = 200) {
  return new Response(cuerpo, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function texto(param, max) {
  return (param ?? "").trim().slice(0, max);
}

// Solo deja pasar valores conocidos; lo demás se ignora.
function leerFiltros(params) {
  const rubro = params.get("rubro");
  const modalidad = params.get("modalidad");
  const tipo = params.get("tipo");
  return {
    q: texto(params.get("q"), 100),
    rubro: buscarRubro(rubro) ? rubro : "",
    departamento: texto(params.get("departamento"), 60),
    modalidad: Object.hasOwn(MODALIDADES, modalidad ?? "") ? modalidad : "",
    tipo: Object.hasOwn(TIPOS, tipo ?? "") ? tipo : "",
    sueldo: params.get("sueldo") === "alto" ? "alto" : "",
    cierre: params.get("cierre") === "pronto" ? "pronto" : "",
    nuevas: params.get("nuevas") === "1" ? "1" : "",
  };
}

function leerPagina(params) {
  const n = Number.parseInt(params.get("pagina") ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 1;
}

// Clave de caché con solo los parámetros válidos y en orden fijo, para que
// agregar parámetros inventados a la URL no obligue a consultar D1 de nuevo.
function claveCache(url, prefijo = "") {
  const ruta = url.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams();
  if (ruta === "/empleos" || ruta.startsWith("/rubro/")) {
    for (const [k, v] of Object.entries(leerFiltros(url.searchParams))) if (v) params.set(k, v);
    const pagina = leerPagina(url.searchParams);
    if (pagina > 1) params.set("pagina", String(pagina));
  }
  params.sort();
  const qs = params.toString();
  return new Request(`${url.origin}${prefijo}${ruta}${qs ? `?${qs}` : ""}`);
}

// Datos que se repiten en todas las páginas (departamentos, atajos), guardados
// en caché aparte para no recalcularlos en cada listado.
// La caché es una ayuda: si falla, se sigue sin ella en vez de mostrar un error.
async function buscarEnCache(clave) {
  try {
    return await caches.default.match(clave);
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

function guardarEnCache(ctx, clave, respuesta) {
  ctx.waitUntil(caches.default.put(clave, respuesta).catch((err) => console.error(err)));
}

async function enCache(ctx, url, nombre, calcular) {
  const clave = new Request(`${url.origin}/__datos/${nombre}`);
  const guardado = await buscarEnCache(clave);
  if (guardado) return guardado.json();
  const valor = await calcular();
  guardarEnCache(
    ctx,
    clave,
    new Response(JSON.stringify(valor), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${SEGUNDOS_PAGINA}` },
    }),
  );
  return valor;
}

function datosComunes(env, ctx, url) {
  return Promise.all([
    enCache(ctx, url, "departamentos", () => listarDepartamentos(env.DB)),
    enCache(ctx, url, "atajos", () => resumenAtajos(env.DB)),
  ]);
}

async function listado(env, ctx, url, rubroFijo) {
  const filtros = leerFiltros(url.searchParams);
  if (rubroFijo) filtros.rubro = rubroFijo;
  const pagina = leerPagina(url.searchParams);
  const [{ ofertas, total }, [departamentos, atajos]] = await Promise.all([
    listarOfertas(env.DB, filtros, pagina),
    datosComunes(env, ctx, url),
  ]);
  return html(paginaListado({ filtros, rubroFijo, ofertas, total, pagina, departamentos, atajos }));
}

function mapaDelSitio(url) {
  const hoy = hoyEnLima();
  const paginas = [
    ["/", hoy],
    ["/empleos", hoy],
    ...RUBROS.map((r) => [`/rubro/${r.slug}`, hoy]),
    ["/resumen-semanal", hoy],
    ["/guias", REVISION_GUIAS_ISO],
    ...GUIAS.map((g) => [`/guias/${g.slug}`, REVISION_GUIAS_ISO]),
    ["/privacidad", REVISION_GUIAS_ISO],
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map(([ruta, fecha]) => `  <url><loc>${url.origin}${ruta}</loc><lastmod>${fecha}</lastmod></url>`).join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

// Compara sin cortar en el primer carácter distinto, para no dar pistas sobre la clave.
function mismaClave(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let distinto = 0;
  for (let i = 0; i < a.length; i++) distinto |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return distinto === 0;
}

// Panel privado de estadísticas: /panel?clave=<PANEL_CLAVE>.
async function panel(env, url) {
  if (!mismaClave(url.searchParams.get("clave") ?? "", env.PANEL_CLAVE ?? "")) return html(pagina404(), 404);
  const respuesta = html(paginaPanel(await estadisticas(env.DB)));
  respuesta.headers.set("Cache-Control", "no-store");
  respuesta.headers.set("X-Robots-Tag", "noindex");
  return respuesta;
}

const ES_ROBOT = /bot|crawl|spider|slurp|headless|curl|wget|python|scanner|java\/|go-http|okhttp|axios/i;

// Recibe los avisos de public/medicion.js. Responde siempre 204 para no dar
// información a quien envíe datos inventados.
async function medir(request, env) {
  const vacio = new Response(null, { status: 204 });
  if (ES_ROBOT.test(request.headers.get("User-Agent") ?? "")) return vacio;
  const texto = await request.text();
  if (texto.length > 1000) return vacio;
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return vacio;
  }
  const ruta = typeof datos?.r === "string" && /^\/[^\s]{0,199}$/.test(datos.r) ? datos.r : null;
  if (!ruta) return vacio;
  const origen = normalizarOrigen(datos.o);
  if (datos.t === "vista") await registrarVista(env.DB, ruta, origen);
  else if (datos.t === "clic" && Number.isInteger(datos.id) && datos.id > 0) await registrarClic(env.DB, ruta, origen, datos.id);
  return vacio;
}

async function enrutar(request, env, ctx, url) {
  const ruta = url.pathname.replace(/\/+$/, "") || "/";

  if (ruta === "/medir" && request.method === "POST") return medir(request, env);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  if (ruta === "/") {
    const [datos, [departamentos, atajos]] = await Promise.all([datosInicio(env.DB), datosComunes(env, ctx, url)]);
    return html(paginaInicio({ ...datos, departamentos, atajos }));
  }

  if (ruta === "/empleos") return listado(env, ctx, url);

  const rubro = ruta.match(/^\/rubro\/([a-z-]+)$/);
  if (rubro) {
    return buscarRubro(rubro[1]) ? listado(env, ctx, url, rubro[1]) : html(pagina404(), 404);
  }

  if (ruta === "/resumen-semanal") {
    return html(paginaResumen({ ...(await resumenSemanal(env.DB)), hoy: hoyEnLima() }));
  }

  if (ruta === "/sitemap.xml") return mapaDelSitio(url);

  if (ruta === "/panel") return panel(env, url);

  // Redirige al sitio de postulación y cuenta el clic.
  const ir = ruta.match(/^\/ir\/(\d+)$/);
  if (ir) {
    const id = Number(ir[1]);
    const destino = await urlDeOferta(env.DB, id);
    if (!destino || !/^https?:\/\//i.test(destino)) return html(pagina404(), 404);
    ctx.waitUntil(sumarClic(env.DB, id));
    return new Response(null, { status: 302, headers: { Location: destino } });
  }

  return html(pagina404(), 404);
}

async function responder(request, env, ctx, url) {
  // workers.dev no tiene caché; ahí cada visita consulta D1.
  const usarCache =
    (request.method === "GET" || request.method === "HEAD") &&
    !/^\/(ir\/|panel|medir)/.test(url.pathname) &&
    !url.hostname.endsWith(".workers.dev");
  const clave = usarCache ? claveCache(url) : null;
  const claveRespaldo = usarCache ? claveCache(url, "/__respaldo") : null;

  if (clave) {
    const guardada = await buscarEnCache(clave);
    if (guardada) return guardada;
  }

  let respuesta;
  try {
    respuesta = await enrutar(request, env, ctx, url);
  } catch (err) {
    console.error(err);
    const respaldo = claveRespaldo && (await buscarEnCache(claveRespaldo));
    if (respaldo) return respaldo;
    return new Response(paginaError(), {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "3600" },
    });
  }

  if (!clave || (respuesta.status !== 200 && respuesta.status !== 404)) return respuesta;

  const cuerpo = await respuesta.text();
  const tipo = respuesta.headers.get("Content-Type") ?? "text/html; charset=utf-8";
  const conCache = (segundos) =>
    new Response(cuerpo, {
      status: respuesta.status,
      headers: { "Content-Type": tipo, "Cache-Control": `public, max-age=${segundos}` },
    });
  guardarEnCache(ctx, clave, conCache(SEGUNDOS_PAGINA));
  if (respuesta.status === 200) guardarEnCache(ctx, claveRespaldo, conCache(SEGUNDOS_RESPALDO));
  return conCache(SEGUNDOS_PAGINA);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Una sola dirección para el sitio: www.chapatuwork.com -> chapatuwork.com.
    if (url.hostname === "www.chapatuwork.com") {
      url.hostname = "chapatuwork.com";
      return Response.redirect(url.toString(), 301);
    }
    let respuesta = await responder(request, env, ctx, url);
    // La URL de pruebas en workers.dev no debe aparecer en buscadores.
    if (url.hostname.endsWith(".workers.dev")) {
      respuesta = new Response(respuesta.body, respuesta);
      respuesta.headers.set("X-Robots-Tag", "noindex");
    }
    return respuesta;
  },
};
