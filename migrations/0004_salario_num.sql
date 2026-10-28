-- Sueldo mensual como número (el primero que aparece en "salario"), para
-- comparar con el promedio. NULL si no trae un monto razonable
-- (entre S/ 300 y S/ 30 000); fuera de eso suelen ser errores de digitación.
ALTER TABLE ofertas ADD COLUMN salario_num REAL;

UPDATE ofertas
SET salario_num = CAST(REPLACE(REPLACE(REPLACE(salario, 'S/.', ''), 'S/', ''), ',', '') AS REAL)
WHERE salario IS NOT NULL;

UPDATE ofertas SET salario_num = NULL WHERE salario_num < 300 OR salario_num > 30000;
