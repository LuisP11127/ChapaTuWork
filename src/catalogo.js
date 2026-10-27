// Valores fijos que usan los filtros y las fichas de oferta.

export const RUBROS = [
  { slug: "administracion", nombre: "Administración y oficina" },
  { slug: "ventas", nombre: "Ventas y comercial" },
  { slug: "atencion-al-cliente", nombre: "Atención al cliente" },
  { slug: "tecnologia", nombre: "Tecnología y sistemas" },
  { slug: "contabilidad-finanzas", nombre: "Contabilidad y finanzas" },
  { slug: "marketing", nombre: "Marketing y comunicaciones" },
  { slug: "recursos-humanos", nombre: "Recursos humanos" },
  { slug: "ingenieria", nombre: "Ingeniería" },
  { slug: "construccion", nombre: "Construcción y mantenimiento" },
  { slug: "produccion", nombre: "Producción y operarios" },
  { slug: "logistica", nombre: "Logística y transporte" },
  { slug: "salud", nombre: "Salud" },
  { slug: "educacion", nombre: "Educación" },
  { slug: "hoteleria-gastronomia", nombre: "Hotelería, restaurantes y turismo" },
  { slug: "legal", nombre: "Legal" },
  { slug: "otros", nombre: "Otros" },
];

export const MODALIDADES = {
  presencial: "Presencial",
  hibrido: "Híbrido",
  remoto: "Remoto",
};

export const TIPOS = {
  "tiempo-completo": "Tiempo completo",
  "medio-tiempo": "Medio tiempo",
  practicas: "Prácticas",
  temporal: "Temporal / por proyecto",
};

const rubrosPorSlug = new Map(RUBROS.map((r) => [r.slug, r]));

export function buscarRubro(slug) {
  return rubrosPorSlug.get(slug) ?? null;
}
