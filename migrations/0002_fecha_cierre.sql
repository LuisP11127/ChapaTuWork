-- Fecha límite para postular (AAAA-MM-DD). Pasada esa fecha, la oferta deja de mostrarse.
ALTER TABLE ofertas ADD COLUMN cierra_en TEXT;
