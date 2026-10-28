-- Título, entidad, ubicación y resumen en minúsculas y sin tildes, para que
-- buscar "medico" encuentre "Médico".
ALTER TABLE ofertas ADD COLUMN texto_busqueda TEXT;
