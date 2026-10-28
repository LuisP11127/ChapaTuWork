const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

const DIA = 24 * 60 * 60 * 1000;

export function haceCuanto(iso, ahora = Date.now()) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const dias = Math.floor((ahora - fecha.getTime()) / DIA);
  if (dias < 1) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? "hace 1 semana" : `hace ${semanas} semanas`;
  }
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

// Minúsculas, sin tildes y con espacios simples. Se usa para guardar y para
// buscar, así "Médico" y "medico" coinciden.
export function textoBuscable(...partes) {
  return partes
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Fecha de hoy en Lima (UTC-5), como AAAA-MM-DD.
export function hoyEnLima(ahora = Date.now()) {
  return new Date(ahora - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// cierra_en viene como AAAA-MM-DD. Devuelve null si no hay fecha.
export function textoCierre(cierraEn, ahora = Date.now()) {
  if (!cierraEn) return null;
  const dias = Math.round((Date.parse(cierraEn) - Date.parse(hoyEnLima(ahora))) / DIA);
  if (Number.isNaN(dias)) return null;
  if (dias <= 0) return { texto: "Cierra hoy", urgente: true };
  if (dias === 1) return { texto: "Cierra mañana", urgente: true };
  const fecha = new Date(`${cierraEn}T12:00:00Z`).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  return { texto: `Cierra el ${fecha}`, urgente: false };
}

export function plural(n, singular, pluralForma) {
  return `${n.toLocaleString("es-PE")} ${n === 1 ? singular : pluralForma}`;
}
