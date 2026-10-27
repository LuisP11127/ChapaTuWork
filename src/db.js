export const POR_PAGINA = 20;

// Arma el WHERE a partir de filtros ya validados (ver leerFiltros en index.js).
function condiciones(f) {
  const cond = ["activo = 1"];
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
    const like = `%${f.q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    cond.push("(titulo LIKE ? ESCAPE '\\' OR empresa LIKE ? ESCAPE '\\' OR resumen LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  return { where: cond.join(" AND "), params };
}

export async function listarOfertas(db, filtros, pagina) {
  const { where, params } = condiciones(filtros);
  const [lista, total] = await db.batch([
    db
      .prepare(`SELECT * FROM ofertas WHERE ${where} ORDER BY publicado_en DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...params, POR_PAGINA, (pagina - 1) * POR_PAGINA),
    db.prepare(`SELECT COUNT(*) AS n FROM ofertas WHERE ${where}`).bind(...params),
  ]);
  return { ofertas: lista.results, total: total.results[0].n };
}

export async function datosInicio(db) {
  const [porRubro, recientes] = await db.batch([
    db.prepare("SELECT rubro, COUNT(*) AS n FROM ofertas WHERE activo = 1 GROUP BY rubro"),
    db.prepare("SELECT * FROM ofertas WHERE activo = 1 ORDER BY publicado_en DESC, id DESC LIMIT 8"),
  ]);
  const conteo = Object.fromEntries(porRubro.results.map((r) => [r.rubro, r.n]));
  const total = porRubro.results.reduce((s, r) => s + r.n, 0);
  return { conteo, total, recientes: recientes.results };
}

export async function listarDepartamentos(db) {
  const { results } = await db
    .prepare("SELECT DISTINCT departamento FROM ofertas WHERE activo = 1 AND departamento IS NOT NULL ORDER BY departamento")
    .all();
  return results.map((r) => r.departamento);
}

export function urlDeOferta(db, id) {
  return db.prepare("SELECT url_postulacion FROM ofertas WHERE id = ?").bind(id).first("url_postulacion");
}

export function sumarClic(db, id) {
  return db.prepare("UPDATE ofertas SET clics = clics + 1 WHERE id = ?").bind(id).run();
}
