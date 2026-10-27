-- Ofertas de trabajo. Cada oferta viene de una fuente externa y enlaza a su
-- página original de postulación.
CREATE TABLE ofertas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  fuente           TEXT    NOT NULL,             -- de dónde salió: 'careerjet', 'remotive', 'ejemplo', ...
  fuente_id        TEXT    NOT NULL,             -- id de la oferta en esa fuente
  titulo           TEXT    NOT NULL,
  empresa          TEXT,
  ubicacion        TEXT,                         -- texto libre: 'Miraflores, Lima'
  departamento     TEXT,                         -- normalizado: 'Lima', 'Arequipa', ...
  rubro            TEXT    NOT NULL DEFAULT 'otros',
  modalidad        TEXT,                         -- 'presencial' | 'hibrido' | 'remoto'
  tipo             TEXT,                         -- 'tiempo-completo' | 'medio-tiempo' | 'practicas' | 'temporal'
  salario          TEXT,                         -- tal como lo publica la fuente
  resumen          TEXT,
  url_postulacion  TEXT    NOT NULL,
  publicado_en     TEXT    NOT NULL,             -- ISO 8601
  activo           INTEGER NOT NULL DEFAULT 1,   -- 0 cuando la oferta ya no aparece en la fuente
  clics            INTEGER NOT NULL DEFAULT 0,
  creado_en        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (fuente, fuente_id)
);

CREATE INDEX idx_ofertas_activas ON ofertas (activo, publicado_en DESC);
CREATE INDEX idx_ofertas_rubro ON ofertas (rubro, activo, publicado_en DESC);
CREATE INDEX idx_ofertas_departamento ON ofertas (departamento, activo);
