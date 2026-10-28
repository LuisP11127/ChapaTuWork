// Convierte un CSV de ofertas (ver datos/README.md) en SQL para D1.
//
//   node scripts/importar-csv.mjs ofertas.csv > ofertas.sql
//   node scripts/importar-csv.mjs ofertas.csv --sin-ejemplos > ofertas.sql
//
// Cada oferta se identifica por su enlace: si el mismo enlace vuelve a venir en
// otro CSV, se actualiza en lugar de duplicarse. Si el enlace es genérico (se
// repite en varias filas, como la búsqueda de Talento Perú), se identifica por
// enlace + título + entidad + ubicación + resumen.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DEPARTAMENTOS, MODALIDADES, RUBROS, TIPOS } from "../src/catalogo.js";
import { hoyEnLima, textoBuscable } from "../src/util.js";

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

// Los datos del Estado suelen venir en MAYÚSCULAS y sin tildes. Se pasan a
// "Tipo Título" respetando siglas y se reponen las tildes más comunes.
const MINUSCULAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "en", "para", "por", "a", "al", "con", "sin", "su", "un", "una"]);
const SIGLAS = new Set([
  "UGEL", "UTES", "AIRHSP", "CAS", "PNP", "MINSA", "ESSALUD", "SUNAT", "SUNARP", "RENIEC", "INPE", "SIS", "ONP",
  "OSCE", "MEF", "MINEDU", "INDECOPI", "SENASA", "SENAMHI", "OEFA", "SUCAMEC", "MIDIS", "MTPE", "MIMP", "MININTER",
  "MINDEF", "SERVIR", "SUNEDU", "DIRESA", "GERESA", "DRE", "UNSA", "UNMSM", "UNI", "PRONABEC", "FONCODES", "PRONIED",
  "OSINERGMIN", "OSIPTEL", "SUNASS", "SBS", "BCRP", "INEI", "JNE", "ONPE", "CEPLAN", "PCM", "INS", "INEN", "SIAF",
  "SIGA", "TI", "RRHH", "EPS", "SAC", "SRL", "EIRL", "CEM", "MC", "DEMUNA", "CETPRO", "IEP", "IE", "ODEC", "DIRIS",
]);
const TILDES = Object.fromEntries(
  ("médico médica técnico técnica público pública perú aérea área logística logístico informática informático " +
    "jurídico jurídica económico económica químico química práctica prácticas básico básica académico académica " +
    "enfermería psicólogo psicóloga psicología odontólogo odontóloga odontología biólogo bióloga biología físico física " +
    "ingeniería auditoría tecnología metodología estadística estadístico mecánico mecánica eléctrico eléctrica " +
    "electrónico electrónica crédito análisis clínico clínica quirúrgico pediatría ginecología radiología cardiología " +
    "neurología oftalmología traumatología anestesiología patología línea telefónico marítimo economía energía minería " +
    "geología topografía cartografía guía asesoría consultoría tesorería almacén pedagógico pedagógica policía " +
    "fiscalía médicos técnicos públicos prácticos jefatura árbitro régimen órgano órganos género gestión cuestión " +
    "ecografía nutrición múltiple" +
    // Lugares
    " huánuco junín martín apurímac áncash río ríos perú cañete túcume ayacucho callería morropón azángaro chachapoyas " +
    "tingo maría huancavelica pucallpa satipo")
    .split(" ")
    .filter((w) => /[áéíóú]/.test(w))
    .map((w) => [w.normalize("NFD").replace(/[̀-ͯ]/g, ""), w]),
);

function esMayusculas(s) {
  const letras = s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  return letras.length > 3 && letras.replace(/[^a-záéíóúüñ]/g, "").length / letras.length < 0.1;
}

function capitalizar(s) {
  if (!esMayusculas(s)) return s;
  let primera = true;
  return s.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+/g, (palabra) => {
    const esPrimera = primera;
    primera = false;
    let p = palabra.toLowerCase();
    if (!esPrimera && MINUSCULAS.has(p)) return p;
    if (palabra.includes(".") || SIGLAS.has(palabra) || /^[IVX]+$/.test(palabra) || !/[AEIOUÁÉÍÓÚ]/.test(palabra)) return palabra;
    if (TILDES[p]) p = TILDES[p];
    else p = p.replace(/cion$/, "ción").replace(/sion$/, "sión").replace(/logia$/, "logía").replace(/grafia$/, "grafía");
    return p[0].toUpperCase() + p.slice(1);
  });
}

// "S/. 5,500.00" -> "S/ 5,500"; "S/. 1,494.19" -> "S/ 1,494.19".
function salario(s) {
  const m = s.match(/^S\/\.?\s*([\d,]+)(\.\d{2})?$/);
  if (!m) return s;
  return `S/ ${m[1]}${m[2] && m[2] !== ".00" ? m[2] : ""}`;
}

// Primer monto del texto, como número. null si no hay o si no es razonable
// para un sueldo mensual (suelen ser errores como "S/ 001").
function salarioNumero(s) {
  const m = s.match(/(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, "") + (m[2] ?? ""));
  return n >= 300 && n <= 30000 ? n : null;
}

// Talento Perú publica el resumen como "Convocatoria <régimen>-<n.°> para
// <PUESTO>; <n> vacante en <ENTIDAD>." El puesto y la entidad ya se muestran
// aparte, así que se deja solo el régimen, el número y las vacantes.
const REGIMENES = {
  "D.LEG 1057 - DETERMINADO (NECESIDAD TRANSITORIA)": "CAS a plazo determinado (necesidad transitoria)",
  "D.LEG 1057 - DETERMINADO (SUPLENCIA)": "CAS a plazo determinado (suplencia)",
  "D.LEG 1057 - INDETERMINADO": "CAS a plazo indeterminado",
  276: "Régimen D. Leg. 276",
  728: "Régimen D. Leg. 728",
  "DOCENTES UNIVERSITARIOS LEY 30220": "Docencia universitaria (Ley 30220)",
  "JUECES LEY 29277": "Carrera judicial (Ley 29277)",
};

function resumirTalentoPeru(resumen) {
  const m = resumen.match(/^Convocatoria (.+)-([^-\s]*) para .+; (\d+) vacantes? en .+\.$/);
  if (!m) return null;
  const [, regimen, numero, vacantes] = m;
  const partes = [REGIMENES[regimen] ?? capitalizar(regimen)];
  if (numero) partes.push(`Convocatoria N.° ${numero}`);
  partes.push(vacantes === "1" ? "1 vacante" : `${vacantes} vacantes`);
  return { resumen: partes.join(" · "), temporal: /DETERMINADO \(/.test(regimen) };
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
  const avisos = new Map(); // mensaje -> números de fila
  const avisar = (mensaje, linea) => avisos.set(mensaje, [...(avisos.get(mensaje) ?? []), linea]);
  const valores = [];
  const vistos = new Set();
  const col = (f, c) => (idx[c] === undefined ? "" : (f[idx[c]] ?? "").trim());
  const usosDeUrl = new Map();
  for (const f of filas) usosDeUrl.set(col(f, "url_postulacion"), (usosDeUrl.get(col(f, "url_postulacion")) ?? 0) + 1);

  filas.forEach((f, i) => {
    const linea = i + 2;
    const titulo = col(f, "titulo");
    const url = col(f, "url_postulacion");
    if (!titulo || !/^https?:\/\/\S+$/i.test(url)) {
      avisar("Se omite: falta el título o el enlace no es válido", linea);
      return;
    }
    const clave =
      usosDeUrl.get(url) > 1
        ? [url, titulo, col(f, "empresa"), col(f, "ubicacion"), col(f, "resumen")].join("\u0000")
        : url;
    if (vistos.has(clave)) {
      avisar("Se omite: repite una oferta de una fila anterior", linea);
      return;
    }
    vistos.add(clave);

    const elegir = (c, opciones, porDefecto) => {
      const v = col(f, c);
      const r = buscarEn(v, opciones);
      if (v && r === null) avisar(`${c} "${v}" no se reconoce; se deja ${porDefecto ? `"${porDefecto}"` : "vacío"}`, linea);
      return r || porDefecto;
    };
    const leerFecha = (c, porDefecto) => {
      const r = fecha(col(f, c));
      if (r === null) avisar(`${c} "${col(f, c)}" no es una fecha válida; se ignora`, linea);
      return r || porDefecto;
    };

    const fila = {
      fuente: "manual",
      fuente_id: createHash("sha1").update(clave).digest("hex").slice(0, 16),
      titulo: capitalizar(titulo),
      empresa: capitalizar(col(f, "empresa")),
      ubicacion: capitalizar(col(f, "ubicacion")),
      departamento: elegir("departamento", OPC_DEPARTAMENTOS, ""),
      rubro: elegir("rubro", OPC_RUBROS, "otros"),
      modalidad: elegir("modalidad", OPC_MODALIDADES, ""),
      tipo: elegir("tipo", OPC_TIPOS, ""),
      salario: salario(col(f, "salario")),
      resumen: col(f, "resumen").slice(0, 400),
      url_postulacion: url,
      publicado_en: leerFecha("publicado_en", hoy),
      cierra_en: leerFecha("cierra_en", ""),
    };
    const talento = resumirTalentoPeru(fila.resumen);
    if (talento) {
      fila.resumen = talento.resumen;
      if (!fila.tipo && talento.temporal) fila.tipo = "temporal";
    }
    // Si el texto trae un monto pero no es razonable, no se muestra.
    if (/\d/.test(fila.salario) && salarioNumero(fila.salario) === null) {
      avisar(`salario "${fila.salario}" no parece un sueldo mensual; se deja vacío`, linea);
      fila.salario = "";
    }
    fila.texto_busqueda = textoBuscable(fila.titulo, fila.empresa, fila.ubicacion, fila.resumen);
    fila.salario_num = salarioNumero(fila.salario);
    if (fila.cierra_en && fila.cierra_en < hoy) {
      avisar("Se omite: la fecha de cierre ya pasó", linea);
      return;
    }
    valores.push(`(${Object.values(fila).map(sql).join(", ")})`);
  });

  // D1 limita el tamaño de cada sentencia, así que se inserta por lotes.
  const campos = ["fuente", "fuente_id", "titulo", "empresa", "ubicacion", "departamento", "rubro", "modalidad", "tipo", "salario", "resumen", "url_postulacion", "publicado_en", "cierra_en", "texto_busqueda", "salario_num"];
  const actualizar = campos.filter((c) => !["fuente", "fuente_id"].includes(c)).map((c) => `${c} = excluded.${c}`);
  const salida = [];
  if (opciones.includes("--sin-ejemplos")) salida.push("DELETE FROM ofertas WHERE fuente = 'ejemplo';");
  for (let i = 0; i < valores.length; i += 100) {
    salida.push(
      `INSERT INTO ofertas (${campos.join(", ")}) VALUES\n${valores.slice(i, i + 100).join(",\n")}\n` +
        `ON CONFLICT (fuente, fuente_id) DO UPDATE SET ${actualizar.join(", ")}, activo = 1, ` +
        `actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now');`,
    );
  }
  process.stdout.write(salida.join("\n") + "\n");
  for (const [mensaje, lineas] of avisos) {
    const muestra = lineas.slice(0, 8).join(", ") + (lineas.length > 8 ? ", …" : "");
    console.error(`${mensaje}: ${lineas.length} fila(s) (${muestra})`);
  }
  console.error(`${valores.length} ofertas listas para importar, ${filas.length - valores.length} omitidas.`);
}

principal();
