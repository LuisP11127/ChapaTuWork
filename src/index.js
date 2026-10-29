import { MODALIDADES, TIPOS, buscarRubro } from "./catalogo.js";
import { datosInicio, listarDepartamentos, listarOfertas, resumenAtajos, sumarClic, urlDeOferta } from "./db.js";
import { pagina404, paginaError, paginaInicio, paginaListado } from "./vistas.js";

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
async function enCache(ctx, url, nombre, calcular) {
  const clave = new Request(`${url.origin}/__datos/${nombre}`);
  const guardado = await caches.default.match(clave);
  if (guardado) return guardado.json();
  const valor = await calcular();
  ctx.waitUntil(
    caches.default.put(
      clave,
      new Response(JSON.stringify(valor), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${SEGUNDOS_PAGINA}` },
      }),
    ),
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

async function enrutar(request, env, ctx, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const ruta = url.pathname.replace(/\/+$/, "") || "/";

  if (ruta === "/") {
    const [datos, [departamentos, atajos]] = await Promise.all([datosInicio(env.DB), datosComunes(env, ctx, url)]);
    return html(paginaInicio({ ...datos, departamentos, atajos }));
  }

  if (ruta === "/empleos") return listado(env, ctx, url);

  const rubro = ruta.match(/^\/rubro\/([a-z-]+)$/);
  if (rubro) {
    return buscarRubro(rubro[1]) ? listado(env, ctx, url, rubro[1]) : html(pagina404(), 404);
  }

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
  const usarCache = (request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/ir/") && !url.hostname.endsWith(".workers.dev");
  const clave = usarCache ? claveCache(url) : null;
  const claveRespaldo = usarCache ? claveCache(url, "/__respaldo") : null;

  if (clave) {
    const guardada = await caches.default.match(clave);
    if (guardada) return guardada;
  }

  let respuesta;
  try {
    respuesta = await enrutar(request, env, ctx, url);
  } catch (err) {
    console.error(err);
    const respaldo = claveRespaldo && (await caches.default.match(claveRespaldo));
    if (respaldo) return respaldo;
    return new Response(paginaError(), {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "3600" },
    });
  }

  if (!clave || (respuesta.status !== 200 && respuesta.status !== 404)) return respuesta;

  const cuerpo = await respuesta.text();
  const conCache = (segundos) =>
    new Response(cuerpo, {
      status: respuesta.status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": `public, max-age=${segundos}` },
    });
  ctx.waitUntil(caches.default.put(clave, conCache(SEGUNDOS_PAGINA)));
  if (respuesta.status === 200) ctx.waitUntil(caches.default.put(claveRespaldo, conCache(SEGUNDOS_RESPALDO)));
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
