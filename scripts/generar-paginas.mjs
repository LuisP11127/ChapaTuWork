// Genera las páginas estáticas (guías y privacidad) en public/ a partir de
// contenido/. Cloudflare las sirve directamente, sin pasar por el Worker ni
// por D1.
//
//   node scripts/generar-paginas.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GUIAS, REVISION_GUIAS } from "../src/guias.js";
import { esc } from "../src/util.js";
import { layout } from "../src/vistas.js";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
const escribir = (ruta, html) => {
  const url = new URL(`../public/${ruta}`, import.meta.url);
  mkdirSync(new URL(".", url), { recursive: true });
  writeFileSync(url, html);
  console.log(`public/${ruta}`);
};

function tarjetaGuia(g) {
  return `<a class="guia-card" href="/guias/${g.slug}">
      <span class="guia-titulo">${esc(g.titulo)}</span>
      <span class="guia-desc">${esc(g.descripcion)}</span>
    </a>`;
}

escribir(
  "guias.html",
  layout({
    titulo: "Guías para buscar trabajo",
    descripcion: "Guías para postular al Estado y a empresas privadas en Perú: convocatorias CAS, regímenes laborales y cómo armar tu CV.",
    cuerpo: `
  <div class="wrap articulo">
    <h1>Guías para buscar trabajo</h1>
    <p class="entrada">Explicaciones prácticas para postular en el Perú, con las normas y fuentes que las respaldan.</p>
    <div class="guias">
    ${GUIAS.map(tarjetaGuia).join("\n    ")}
      <a class="guia-card" href="/resumen-semanal">
        <span class="guia-titulo">Resumen semanal de convocatorias por región</span>
        <span class="guia-desc">Cuántas ofertas nuevas hubo en cada departamento esta semana, en qué rubros y cuáles cierran pronto.</span>
      </a>
    </div>
  </div>`,
  }),
);

for (const g of GUIAS) {
  const otras = GUIAS.filter((x) => x.slug !== g.slug);
  escribir(
    `guias/${g.slug}.html`,
    layout({
      titulo: g.titulo,
      descripcion: g.descripcion,
      cuerpo: `
  <article class="wrap articulo">
    <p class="migas"><a href="/guias">Guías</a> /</p>
    <h1>${esc(g.titulo)}</h1>
    <p class="revision">Última revisión: ${esc(REVISION_GUIAS)}</p>
${leer(`contenido/guias/${g.slug}.html`)}
    <p class="aviso-legal">Esta guía es informativa. Las bases de cada convocatoria y las normas vigentes prevalecen sobre lo que se dice aquí.</p>
    <aside class="relacionadas">
      <h2>Otras guías</h2>
      <div class="guias">
      ${otras.map(tarjetaGuia).join("\n      ")}
      </div>
    </aside>
  </article>`,
    }),
  );
}

escribir(
  "privacidad.html",
  layout({
    titulo: "Privacidad",
    descripcion: "Qué datos registra ChapaTuWork y cómo se usan.",
    cuerpo: `
  <article class="wrap articulo">
    <h1>Privacidad</h1>
    <p class="revision">Última actualización: ${esc(REVISION_GUIAS)}</p>
${leer("contenido/privacidad.html")}
  </article>`,
  }),
);
