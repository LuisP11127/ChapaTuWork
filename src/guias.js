// Guías publicadas. El contenido de cada una está en contenido/guias/<slug>.html
// y scripts/generar-paginas.mjs lo convierte en public/guias/<slug>.html.
// El Worker usa esta lista para la portada y el mapa del sitio.
export const GUIAS = [
  {
    slug: "como-postular-a-un-cas",
    titulo: "Cómo postular a una convocatoria CAS, paso a paso",
    descripcion: "Dónde encontrar convocatorias del Estado, qué documentos preparar, cómo son las etapas de evaluación y los errores que te dejan fuera.",
  },
  {
    slug: "regimenes-276-728-cas",
    titulo: "Regímenes 276, 728 y CAS: qué son y en qué se diferencian",
    descripcion: "Qué significa cada régimen laboral del Estado, qué beneficios da y cómo leer lo que dice la convocatoria.",
  },
  {
    slug: "como-armar-tu-cv",
    titulo: "Cómo armar un CV que pase el primer filtro",
    descripcion: "Estructura, formato y ejemplos para empresas privadas y para convocatorias del Estado.",
  },
];

export const REVISION_GUIAS = "29 de octubre de 2026";
export const REVISION_GUIAS_ISO = "2026-10-29";
