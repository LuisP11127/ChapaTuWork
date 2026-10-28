import { MODALIDADES, TIPOS, buscarRubro } from "./catalogo.js";
import { datosInicio, listarDepartamentos, listarOfertas, sumarClic, urlDeOferta } from "./db.js";
import { pagina404, paginaError, paginaInicio, paginaListado } from "./vistas.js";

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
  };
}

function leerPagina(params) {
  const n = Number.parseInt(params.get("pagina") ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 1;
}

async function listado(env, url, rubroFijo) {
  const filtros = leerFiltros(url.searchParams);
  if (rubroFijo) filtros.rubro = rubroFijo;
  const pagina = leerPagina(url.searchParams);
  const [{ ofertas, total }, departamentos] = await Promise.all([
    listarOfertas(env.DB, filtros, pagina),
    listarDepartamentos(env.DB),
  ]);
  return html(paginaListado({ filtros, rubroFijo, ofertas, total, pagina, departamentos }));
}

async function enrutar(request, env, ctx, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const ruta = url.pathname.replace(/\/+$/, "") || "/";

  if (ruta === "/") {
    const [datos, departamentos] = await Promise.all([datosInicio(env.DB), listarDepartamentos(env.DB)]);
    return html(paginaInicio({ ...datos, departamentos }));
  }

  if (ruta === "/empleos") return listado(env, url);

  const rubro = ruta.match(/^\/rubro\/([a-z-]+)$/);
  if (rubro) {
    return buscarRubro(rubro[1]) ? listado(env, url, rubro[1]) : html(pagina404(), 404);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Una sola dirección para el sitio: www.chapatuwork.com -> chapatuwork.com.
    if (url.hostname === "www.chapatuwork.com") {
      url.hostname = "chapatuwork.com";
      return Response.redirect(url.toString(), 301);
    }
    let respuesta;
    try {
      respuesta = await enrutar(request, env, ctx, url);
    } catch (err) {
      console.error(err);
      respuesta = html(paginaError(), 500);
    }
    // La URL de pruebas en workers.dev no debe aparecer en buscadores.
    if (url.hostname.endsWith(".workers.dev")) {
      respuesta = new Response(respuesta.body, respuesta);
      respuesta.headers.set("X-Robots-Tag", "noindex");
    }
    return respuesta;
  },
};
