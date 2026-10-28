import { textoBuscable } from "./util.js";

export const POR_PAGINA = 20;

// Una oferta se muestra hasta su fecha de cierre (hora de Lima). Si no tiene
// fecha de cierre, se muestra durante 30 días desde que se publicó.
const VIGENTE = `activo = 1 AND (CASE
  WHEN cierra_en IS NOT NULL THEN cierra_en >= date('now', '-5 hours')
  ELSE publicado_en >= date('now', '-5 hours', '-30 days')
END)`;

// Atajos de la portada y del listado. Fechas en hora de Lima: "cierran pronto"
// es hoy, mañana o pasado mañana; "nuevas", publicadas en los últimos 3 días.
const PROMEDIO = `(SELECT AVG(salario_num) FROM ofertas WHERE ${VIGENTE} AND salario_num IS NOT NULL)`;
const SUELDO_ALTO = `salario_num > ${PROMEDIO}`;
const CIERRA_PRONTO = `cierra_en IS NOT NULL AND cierra_en <= date('now', '-5 hours', '+2 days')`;
const NUEVA = `publicado_en >= date('now', '-5 hours', '-2 days')`;

// Arma el WHERE a partir de filtros ya validados (ver leerFiltros en index.js).
function condiciones(f) {
  const cond = [VIGENTE];
  const params = [];
  if (f.rubro) {
    cond.push("rubro = ?");
    params.push(f.rubro);
  }
  if (f.departamento) {
    cond.push("departamento = ?");
    params.push(f.departamento);
  }
  if (f.modalidad) {
    cond.push("modalidad = ?");
    params.push(f.modalidad);
  }
  if (f.tipo) {
    cond.push("tipo = ?");
    params.push(f.tipo);
  }
  if (f.q) {
    const like = `%${textoBuscable(f.q).replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    cond.push("texto_busqueda LIKE ? ESCAPE '\\'");
    params.push(like);
  }
  if (f.sueldo) cond.push(SUELDO_ALTO);
  if (f.cierre) cond.push(CIERRA_PRONTO);
  if (f.nuevas) cond.push(NUEVA);
  return { where: cond.join(" AND "), params };
}

function orden(f) {
  if (f.cierre) return "cierra_en ASC, publicado_en DESC, id DESC";
  if (f.sueldo) return "salario_num DESC, publicado_en DESC, id DESC";
  return "publicado_en DESC, id DESC";
}

export async function listarOfertas(db, filtros, pagina) {
  const { where, params } = condiciones(filtros);
  const [lista, total] = await db.batch([
    db
      .prepare(`SELECT * FROM ofertas WHERE ${where} ORDER BY ${orden(filtros)} LIMIT ? OFFSET ?`)
      .bind(...params, POR_PAGINA, (pagina - 1) * POR_PAGINA),
    db.prepare(`SELECT COUNT(*) AS n FROM ofertas WHERE ${where}`).bind(...params),
  ]);
  return { ofertas: lista.results, total: total.results[0].n };
}

export async function datosInicio(db) {
  const [porRubro, recientes] = await db.batch([
    db.prepare(`SELECT rubro, COUNT(*) AS n FROM ofertas WHERE ${VIGENTE} GROUP BY rubro`),
    db.prepare(`SELECT * FROM ofertas WHERE ${VIGENTE} ORDER BY publicado_en DESC, id DESC LIMIT 8`),
  ]);
  const conteo = Object.fromEntries(porRubro.results.map((r) => [r.rubro, r.n]));
  const total = porRubro.results.reduce((s, r) => s + r.n, 0);
  return { conteo, total, recientes: recientes.results };
}

// Cuántas ofertas hay en cada atajo y el sueldo promedio (soles al mes).
export function resumenAtajos(db) {
  return db
    .prepare(
      `SELECT ${PROMEDIO} AS promedio,
        COALESCE(SUM(CASE WHEN ${SUELDO_ALTO} THEN 1 ELSE 0 END), 0) AS sueldo,
        COALESCE(SUM(CASE WHEN ${CIERRA_PRONTO} THEN 1 ELSE 0 END), 0) AS cierre,
        COALESCE(SUM(CASE WHEN ${NUEVA} THEN 1 ELSE 0 END), 0) AS nuevas
      FROM ofertas WHERE ${VIGENTE}`,
    )
    .first();
}

export async function listarDepartamentos(db) {
  const { results } = await db
    .prepare(`SELECT DISTINCT departamento FROM ofertas WHERE ${VIGENTE} AND departamento IS NOT NULL ORDER BY departamento`)
    .all();
  return results.map((r) => r.departamento);
}

export function urlDeOferta(db, id) {
  return db.prepare("SELECT url_postulacion FROM ofertas WHERE id = ?").bind(id).first("url_postulacion");
}

export function sumarClic(db, id) {
  return db.prepare("UPDATE ofertas SET clics = clics + 1 WHERE id = ?").bind(id).run();
}
