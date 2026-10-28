# Cargar ofertas a mano

Las ofertas se cargan con un archivo CSV (o Excel guardado como CSV) que usa
las columnas de `plantilla-ofertas.csv`. Cada oferta se identifica por su
enlace: si vuelves a subir una oferta con el mismo enlace, se actualiza en vez
de duplicarse.

Una oferta se muestra hasta su `fecha_cierre`. Si no tiene fecha de cierre, se
muestra durante 30 días desde su `fecha_publicacion`.

## Columnas

| Columna | Obligatoria | Qué poner |
|---|---|---|
| `titulo` | Sí | Nombre del puesto. |
| `empresa` | No | Empresa o institución que contrata. |
| `ubicacion` | No | Distrito o ciudad, como lo publica la oferta. |
| `departamento` | No | Uno de los 24 departamentos o Callao (ver lista abajo). |
| `rubro` | No | Uno de los rubros de la lista abajo. Si queda vacío, va a "Otros". |
| `modalidad` | No | Presencial, Híbrido o Remoto. |
| `tipo` | No | Tiempo completo, Medio tiempo, Prácticas o Temporal. |
| `salario` | No | Tal como aparece, por ejemplo `S/ 2,500` o `S/ 2,000 – 2,800`. |
| `resumen` | No | Una o dos frases propias sobre el puesto o los requisitos (máximo 400 caracteres). |
| `url_postulacion` | Sí | Enlace a la oferta original, empezando con `https://`. |
| `fecha_publicacion` | No | AAAA-MM-DD o DD/MM/AAAA. Si queda vacía, se usa la fecha de carga. |
| `fecha_cierre` | No | Último día para postular, AAAA-MM-DD o DD/MM/AAAA. |

**Rubros:** Administración y oficina, Ventas y comercial, Atención al cliente,
Tecnología y sistemas, Contabilidad y finanzas, Marketing y comunicaciones,
Recursos humanos, Ingeniería, Construcción y mantenimiento, Producción y
operarios, Logística y transporte, Salud, Educación, Hotelería, restaurantes y
turismo, Legal, Otros.

**Departamentos:** Amazonas, Áncash, Apurímac, Arequipa, Ayacucho, Cajamarca,
Callao, Cusco, Huancavelica, Huánuco, Ica, Junín, La Libertad, Lambayeque,
Lima, Loreto, Madre de Dios, Moquegua, Pasco, Piura, Puno, San Martín, Tacna,
Tumbes, Ucayali.

## Importar

```bash
node scripts/importar-csv.mjs ofertas.csv > ofertas.sql
```

El script avisa qué filas se omitieron o tienen valores que no reconoce.
Con `--sin-ejemplos` además borra las ofertas de ejemplo. Con `--reemplazar`
el archivo se toma como la lista completa: las ofertas cargadas antes que no
vengan en él dejan de mostrarse. El SQL resultante se
aplica a la base de datos D1 `chapatuwork`.
