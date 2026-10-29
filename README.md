# ChapaTuWork

Portal de ofertas de trabajo en Perú, ordenadas por rubro. Cada oferta enlaza
a su página original para postular.

Publicado en https://chapatuwork.com. Corre como un solo Cloudflare Worker:

- `src/`: el Worker. Arma las páginas en el servidor y lee las ofertas de D1.
  - `index.js`: rutas (`/`, `/empleos`, `/rubro/:slug`, `/ir/:id`,
    `/resumen-semanal`, `/sitemap.xml`, `/medir`, `/panel`).
  - `vistas.js`: HTML de cada página.
  - `db.js`: consultas a la base de datos.
  - `catalogo.js`: rubros, modalidades y tipos de empleo.
  - `guias.js`: lista de guías (título y descripción).
- `contenido/`: texto de las guías y de la página de privacidad.
- `scripts/generar-paginas.mjs`: convierte `contenido/` en páginas estáticas
  dentro de `public/` (`node scripts/generar-paginas.mjs`).
- `scripts/importar-csv.mjs`: convierte un CSV de ofertas en SQL (ver `datos/`).
- `public/`: archivos estáticos (CSS, ícono, guías generadas, `medicion.js`).
- `migrations/`: esquema de la base de datos D1 `chapatuwork`.
- `seed/ejemplos.sql`: ofertas inventadas para revisar el diseño.

## Desarrollo local

```bash
npm install
npm run db:migrate:local
npm run db:ejemplos:local
npm run dev
```

El sitio queda en http://localhost:8787.

## Pendiente

- Tarea programada diaria que traiga ofertas de fuentes externas.
- Borrar las ofertas de ejemplo (`DELETE FROM ofertas WHERE fuente = 'ejemplo'`)
  cuando haya fuentes reales.

## Medición

`public/medicion.js` envía a `/medir` cada página vista y cada clic en
"Más información", con el sitio de origen de la visita. Se guarda en la tabla
`eventos` (sin IP ni datos personales). Las estadísticas de los últimos 30 días
están en `/panel?clave=…`; la clave es el secreto `PANEL_CLAVE` del Worker
(en local, en `.dev.vars`).

Para atribuir visitas de canales que no envían el sitio de origen (como
WhatsApp), comparte enlaces con `?utm_source=whatsapp`.

