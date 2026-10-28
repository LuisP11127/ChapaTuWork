# ChapaTuWork

Portal de ofertas de trabajo en Perú, ordenadas por rubro. Cada oferta enlaza
a su página original para postular.

Publicado en https://chapatuwork.com. Corre como un solo Cloudflare Worker:

- `src/`: el Worker. Arma las páginas en el servidor y lee las ofertas de D1.
  - `index.js`: rutas (`/`, `/empleos`, `/rubro/:slug`, `/ir/:id`).
  - `vistas.js`: HTML de cada página.
  - `db.js`: consultas a la base de datos.
  - `catalogo.js`: rubros, modalidades y tipos de empleo.
- `public/`: archivos estáticos (CSS, ícono).
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
