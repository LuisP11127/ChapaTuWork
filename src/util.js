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

export function plural(n, singular, pluralForma) {
  return `${n.toLocaleString("es-PE")} ${n === 1 ? singular : pluralForma}`;
}
