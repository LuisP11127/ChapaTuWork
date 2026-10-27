// Convierte un CSV de ofertas (ver datos/README.md) en SQL para D1.
//
//   node scripts/importar-csv.mjs ofertas.csv > ofertas.sql
//   node scripts/importar-csv.mjs ofertas.csv --sin-ejemplos > ofertas.sql
//
// Cada oferta se identifica por su enlace: si el mismo enlace vuelve a venir en
// otro CSV, se actualiza en lugar de duplicarse.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DEPARTAMENTOS, MODALIDADES, RUBROS, TIPOS } from "../src/catalogo.js";
import { hoyEnLima } from "../src/util.js";

const normalizar = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function leerTexto(ruta) {
  const bytes = readFileSync(ruta);
  let texto;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Excel en Windows suele guardar el CSV en Windows-1252.
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  return texto.replace(/^﻿/, "");
}

function parsearCsv(texto) {
  const primeraLinea = texto.slice(0, texto.indexOf("\n") >>> 0);
  const sep = (primeraLinea.match(/;/g) ?? []).length > (primeraLinea.match(/,/g) ?? []).length ? ";" : ",";
  const filas = [];
  let fila = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        comillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      comillas = true;
    } else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

const COLUMNAS = {
  titulo: ["titulo", "puesto", "cargo"],
  empresa: ["empresa", "institucion", "entidad"],
  ubicacion: ["ubicacion", "lugar", "distrito", "ciudad"],
  departamento: ["departamento", "region"],
  rubro: ["rubro", "categoria", "area"],
  modalidad: ["modalidad"],
  tipo: ["tipo", "tipo de empleo", "jornada", "contrato"],
  salario: ["salario", "sueldo", "remuneracion"],
  resumen: ["resumen", "descripcion", "requisitos"],
  url_postulacion: ["url postulacion", "url", "enlace", "link", "postulacion"],
  publicado_en: ["fecha publicacion", "publicado", "fecha"],
  cierra_en: ["fecha cierre", "cierre", "cierra", "fecha limite"],
};

function mapearEncabezados(encabezados) {
  const indices = {};
  encabezados.forEach((h, i) => {
    const n = normalizar(h);
    for (const [col, alias] of Object.entries(COLUMNAS)) {
      if (indices[col] === undefined && alias.includes(n)) indices[col] = i;
    }
  });
  return indices;
}

function buscarEn(valor, opciones) {
  const n = normalizar(valor);
  if (!n) return "";
  return opciones.find(([, ...nombres]) => nombres.some((x) => normalizar(x) === n))?.[0] ??
    opciones.find(([, ...nombres]) => nombres.some((x) => normalizar(x).startsWith(n) || n.startsWith(normalizar(x))))?.[0] ??
    null;
}

const OPC_RUBROS = RUBROS.map((r) => [r.slug, r.slug, r.nombre]);
const OPC_MODALIDADES = Object.entries(MODALIDADES).map(([k, v]) => [k, k, v]);
const OPC_TIPOS = [
  ...Object.entries(TIPOS).map(([k, v]) => [k, k, v]),
  ["medio-tiempo", "part time", "parcial"],
  ["practicas", "practicas preprofesionales", "practicas profesionales", "practicante"],
  ["temporal", "por proyecto", "suplencia"],
  ["tiempo-completo", "full time", "completo"],
];
const OPC_DEPARTAMENTOS = [...DEPARTAMENTOS.map((d) => [d, d]), ["Lima", "Lima Metropolitana", "Lima Provincias"], ["Áncash", "Ancash"]];

// Acepta AAAA-MM-DD, DD/MM/AAAA, DD-MM-AAAA y números de fecha de Excel.
function fecha(valor) {
  const v = String(valor ?? "").trim();
  if (!v) return "";
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{5}$/.test(v)) return new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000).toISOString().slice(0, 10);
  return null;
}

const sql = (v) => (v === "" || v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

function principal() {
  const [ruta, ...opciones] = process.argv.slice(2);
  if (!ruta) {
    console.error("Uso: node scripts/importar-csv.mjs archivo.csv [--sin-ejemplos] > salida.sql");
    process.exit(1);
  }
  const [encabezados, ...filas] = parsearCsv(leerTexto(ruta));
  const idx = mapearEncabezados(encabezados);
  for (const obligatoria of ["titulo", "url_postulacion"]) {
    if (idx[obligatoria] === undefined) {
      console.error(`Falta la columna "${obligatoria}". Encabezados encontrados: ${encabezados.join(" | ")}`);
      process.exit(1);
    }
  }

  const hoy = hoyEnLima();
  const avisos = [];
  const valores = [];
  const vistos = new Set();

  filas.forEach((f, i) => {
    const linea = i + 2;
    const col = (c) => (idx[c] === undefined ? "" : (f[idx[c]] ?? "").trim());
    const titulo = col("titulo");
    const url = col("url_postulacion");
    if (!titulo || !/^https?:\/\/\S+$/i.test(url)) {
      avisos.push(`Fila ${linea}: se omite (falta el título o el enlace no es válido).`);
      return;
    }
    if (vistos.has(url)) {
      avisos.push(`Fila ${linea}: se omite, el enlace ya apareció en otra fila.`);
      return;
    }
    vistos.add(url);

    const elegir = (c, opciones, porDefecto) => {
      const v = col(c);
      const r = buscarEn(v, opciones);
      if (v && r === null) avisos.push(`Fila ${linea}: ${c} "${v}" no se reconoce; se deja ${porDefecto ? `"${porDefecto}"` : "vacío"}.`);
      return r || porDefecto;
    };
    const leerFecha = (c, porDefecto) => {
      const r = fecha(col(c));
      if (r === null) avisos.push(`Fila ${linea}: ${c} "${col(c)}" no es una fecha válida; se ignora.`);
      return r || porDefecto;
    };

    const fila = {
      fuente: "manual",
      fuente_id: createHash("sha1").update(url).digest("hex").slice(0, 16),
      titulo,
      empresa: col("empresa"),
      ubicacion: col("ubicacion"),
      departamento: elegir("departamento", OPC_DEPARTAMENTOS, ""),
      rubro: elegir("rubro", OPC_RUBROS, "otros"),
      modalidad: elegir("modalidad", OPC_MODALIDADES, ""),
      tipo: elegir("tipo", OPC_TIPOS, ""),
      salario: col("salario"),
      resumen: col("resumen").slice(0, 400),
      url_postulacion: url,
      publicado_en: leerFecha("publicado_en", hoy),
      cierra_en: leerFecha("cierra_en", ""),
    };
    if (fila.cierra_en && fila.cierra_en < hoy) avisos.push(`Fila ${linea}: la fecha de cierre ya pasó; no se mostrará.`);
    valores.push(`(${Object.values(fila).map(sql).join(", ")})`);
  });

  const campos = ["fuente", "fuente_id", "titulo", "empresa", "ubicacion", "departamento", "rubro", "modalidad", "tipo", "salario", "resumen", "url_postulacion", "publicado_en", "cierra_en"];
  const actualizar = campos.filter((c) => !["fuente", "fuente_id"].includes(c)).map((c) => `${c} = excluded.${c}`);
  const salida = [];
  if (opciones.includes("--sin-ejemplos")) salida.push("DELETE FROM ofertas WHERE fuente = 'ejemplo';");
  if (valores.length) {
    salida.push(
      `INSERT INTO ofertas (${campos.join(", ")}) VALUES\n${valores.join(",\n")}\n` +
        `ON CONFLICT (fuente, fuente_id) DO UPDATE SET ${actualizar.join(", ")}, activo = 1, ` +
        `actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');`,
    );
  }
  process.stdout.write(salida.join("\n") + "\n");
  for (const a of avisos) console.error(a);
  console.error(`${valores.length} ofertas listas para importar, ${filas.length - valores.length} omitidas.`);
}

principal();
