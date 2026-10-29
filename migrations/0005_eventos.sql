-- Visitas a páginas y clics en "Más información", enviados por el navegador
-- (los robots que no ejecutan JavaScript no aparecen). No se guardan IP ni
-- datos personales. El título de la oferta se copia para conservar el dato
-- aunque la oferta se borre después.
CREATE TABLE eventos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo           TEXT    NOT NULL,           -- 'vista' | 'clic'
  ruta           TEXT    NOT NULL,           -- página donde ocurrió
  origen         TEXT    NOT NULL,           -- de dónde llegó la visita: 'google', 'facebook', 'directo', ...
  oferta_id      INTEGER,                    -- solo en clics
  oferta_titulo  TEXT,
  creado_en      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_eventos_fecha ON eventos (creado_en);
