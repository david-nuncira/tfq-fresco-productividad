// ============================================================
// Parser del rango pegado desde Excel (TSV) o de un archivo
// TSV/TXT/CSV.
//
// Reglas clave:
//  - Respeta celdas entre comillas con tabulaciones y saltos de
//    línea internos (el encabezado real trae "N°<salto>BANDEJA").
//  - Los vacíos son ausencia de dato, nunca cero.
//  - Los códigos se tratan como texto (conservan ceros iniciales).
//  - Fechas solo dd/mm/aaaa explícitas.
//  - TIEMPO es una hora del día (ej. 20:35), jamás una duración.
//  - Conserva la fila original completa (crudo) para trazabilidad.
//  - Los valores pegados son DATOS: nunca se interpretan como
//    código ni se insertan como HTML.
// ============================================================

import { COLUMNAS, mapearEncabezados, normalizarTexto, type ClaveColumna, type MapeoEncabezados } from './columnas'
import { detectarSeparador, parseTabla } from './tsv'
import { sha256Hex } from '../lib/hash'

export interface Normalizada {
  fecha_produccion: string | null
  numero_produccion: string | null
  liquido: string | null
  fecha_cargue: string | null
  posicion: string | null
  tanque: string | null
  finca: string | null
  codigo_pasmador: string | null
  nombre_pasmador: string | null
  variedad: string | null
  numero_bandeja: string | null
  codigo_ensamblador: string | null
  nombre_ensamblador: string | null
  cabezas_conformes: number | null
  cabezas_no_conformes: number | null
  total_cabezas: number | null
  fecha_registro: string | null
  semana: number | null
  marca_registro: string | null
  tiempo_crudo: string | null
  tipo_bandeja: string | null
  ocupacion: number | null
}

export interface FilaImportable {
  filaOrigen: number
  clave: string
  huella: string
  crudo: string[]
  n: Normalizada
  advertencias: string[]
  cantidadesValidas: boolean
}

export interface FilaRechazada {
  filaOrigen: number
  motivo: string
  contenido: string
}

export interface ResultadoParseo {
  filas: FilaImportable[]
  rechazadas: FilaRechazada[]
  mapeo: MapeoEncabezados | null
  totalFilasDatos: number
  errorGeneral: string | null
}

// ---------- utilidades de normalización ----------

const RE_FECHA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
const RE_ENTERO = /^-?\d+$/
const RE_MARCA = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const RE_REF = /#[¡!]?REF/i

function esRef(s: string): boolean {
  return RE_REF.test(s)
}

/** dd/mm/aaaa -> aaaa-mm-dd (ISO) o null si no es una fecha real. */
export function fechaISO(s: string): string | null {
  const m = RE_FECHA.exec(s.trim())
  if (!m) return null
  const d = Number(m[1])
  const mes = Number(m[2])
  const a = Number(m[3])
  if (a < 2000 || a > 2100 || mes < 1 || mes > 12 || d < 1 || d > 31) return null
  const fecha = new Date(Date.UTC(a, mes - 1, d))
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== d) return null
  return `${String(a).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function entero(s: string): number | null {
  const t = s.trim().replace(/\s/g, '')
  if (!RE_ENTERO.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) ? n : null
}

function decimal(s: string): number | null {
  let t = s.trim().replace(/\s/g, '')
  if (t === '') return null
  // acepta 0.06 y 0,06 (un solo separador decimal)
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Texto para columnas de catálogo/código: mayúsculas y espacios colapsados.
 *  El valor original se conserva en `crudo`. */
function textoCodigo(s: string): string | null {
  const t = normalizarTexto(s)
  return t === '' ? null : t
}

/** Texto libre (nombres): solo recorta y colapsa espacios. */
function textoLibre(s: string): string | null {
  const t = s.replace(/\s+/g, ' ').trim()
  return t === '' ? null : t
}

/** Hora del día HH:MM[:SS] -> HH:MM:SS, o null. */
function marcaHora(s: string): string | null {
  const m = RE_MARCA.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  const seg = m[3] === undefined ? 0 : Number(m[3])
  if (h > 23 || min > 59 || seg > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

// ---------- identidad y huella ----------

/** Componente de la clave de identidad: texto normalizado o vacío. */
function comp(valor: string | null): string {
  return valor === null ? '' : normalizarTexto(valor)
}

/**
 * Clave de identidad del evento, validada contra el archivo real:
 *   fecha de producción + n° de producción + tanque + posición + n° bandeja.
 * TIEMPO y FECHA quedan FUERA a propósito: así una corrección de hora
 * se detecta como conflicto del mismo evento y no crea otro evento.
 */
export function claveEvento(n: Normalizada): string {
  return [
    n.fecha_produccion ?? '',
    comp(n.numero_produccion),
    comp(n.tanque),
    comp(n.posicion),
    comp(n.numero_bandeja)
  ].join('|')
}

/** Huella del contenido completo: SHA-256 de todas las celdas originales
 *  (recortadas). Si cualquier celda cambia, la huella cambia. */
export async function huellaFila(crudo: string[]): Promise<string> {
  return sha256Hex(crudo.map((c) => c.trim()).join('\u001f'))
}

// ---------- parseo principal ----------

function cederTurno(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function parsearTexto(
  texto: string,
  onProgreso?: (procesadas: number, total: number) => void
): Promise<ResultadoParseo> {
  const vacio: ResultadoParseo = {
    filas: [],
    rechazadas: [],
    mapeo: null,
    totalFilasDatos: 0,
    errorGeneral: null
  }

  const limpio = texto.replace(/^﻿/, '')
  if (limpio.trim() === '') {
    return { ...vacio, errorGeneral: 'No se recibió contenido. Copie el rango desde Excel (incluido el encabezado) y péguelo aquí.' }
  }

  // El tokenizador propio maneja comillas, tabulaciones y saltos de
  // línea dentro de celdas (ver src/importador/tsv.ts).
  const separador = detectarSeparador(limpio)
  const tabla = parseTabla(limpio, separador)
  if (tabla.length === 0) {
    return { ...vacio, errorGeneral: 'No se pudo interpretar el contenido pegado.' }
  }

  // Primera fila = encabezados.
  const encabezados = tabla[0].map((c) => String(c ?? ''))
  if (encabezados.length < 5) {
    return {
      ...vacio,
      errorGeneral:
        'El contenido no parece un rango de Excel con tabulaciones. Copie el rango completo con su fila de encabezados.'
    }
  }

  const mapeo = mapearEncabezados(encabezados)
  if (mapeo.faltantes.length > 0) {
    return {
      ...vacio,
      mapeo,
      errorGeneral:
        'Faltan columnas requeridas en el encabezado: ' +
        mapeo.faltantes.join(', ') +
        '. Verifique que copió la fila de títulos completa.'
    }
  }

  const filas: FilaImportable[] = []
  const rechazadas: FilaRechazada[] = []
  const totalFilasDatos = tabla.length - 1

  const idx = mapeo.indice
  const celda = (fila: string[], c: ClaveColumna): string => {
    const i = idx[c]
    if (i === undefined || i >= fila.length) return ''
    return String(fila[i] ?? '')
  }

  const nombreTitulo = (c: ClaveColumna): string => COLUMNAS.find((d) => d.clave === c)?.titulo ?? c

  for (let f = 1; f < tabla.length; f++) {
    const filaOrigen = f + 1 // numeración humana: encabezado = fila 1
    const cruda = tabla[f].map((c) => String(c ?? ''))

    if (f % 500 === 0) {
      onProgreso?.(f, totalFilasDatos)
      await cederTurno()
    }

    // Fila totalmente vacía: se ignora sin contarla como rechazo.
    if (cruda.every((c) => c.trim() === '')) continue

    // Encabezado repetido (pegados sucesivos).
    if (normalizarTexto(cruda[0] ?? '') === 'FECHA DE PRODUCCION') {
      rechazadas.push({ filaOrigen, motivo: 'Encabezado repetido dentro de los datos', contenido: cruda.join('\t').slice(0, 300) })
      continue
    }

    const advertencias: string[] = []

    // ---- normalización campo a campo ----
    const vFechaProd = celda(cruda, 'fecha_produccion').trim()
    const fecha_produccion = vFechaProd === '' ? null : fechaISO(vFechaProd)
    if (vFechaProd !== '' && fecha_produccion === null) {
      advertencias.push('Fecha de producción no válida (se conserva el texto original)')
    }

    const vFechaCargue = celda(cruda, 'fecha_cargue').trim()
    const fecha_cargue = vFechaCargue === '' ? null : fechaISO(vFechaCargue)
    if (vFechaCargue !== '' && fecha_cargue === null) {
      advertencias.push('Fecha de cargue no válida (se conserva el texto original)')
    }

    const vFechaReg = celda(cruda, 'fecha_registro').trim()
    const fecha_registro = vFechaReg === '' ? null : fechaISO(vFechaReg)
    if (vFechaReg !== '' && fecha_registro === null) {
      advertencias.push('Columna FECHA no válida (se conserva el texto original)')
    }

    // #¡REF! en cualquier columna conocida
    for (const def of COLUMNAS) {
      const v = celda(cruda, def.clave)
      if (v !== '' && esRef(v)) {
        advertencias.push(`Error #¡REF! de Excel en ${def.titulo}`)
      }
    }

    const numero_produccion = textoCodigo(celda(cruda, 'numero_produccion'))
    const liquido = textoCodigo(celda(cruda, 'liquido'))
    const posicion = textoCodigo(celda(cruda, 'posicion'))
    const tanque = textoCodigo(celda(cruda, 'tanque'))
    const finca = textoCodigo(celda(cruda, 'finca'))
    const variedad = textoCodigo(celda(cruda, 'variedad'))
    const tipo_bandeja = textoCodigo(celda(cruda, 'tipo_bandeja'))
    const codigo_pasmador = textoCodigo(celda(cruda, 'codigo_pasmador'))
    const codigo_ensamblador = textoCodigo(celda(cruda, 'codigo_ensamblador'))
    const nombre_pasmador = textoLibre(celda(cruda, 'nombre_pasmador'))
    const nombre_ensamblador = textoLibre(celda(cruda, 'nombre_ensamblador'))
    const numero_bandeja = textoCodigo(celda(cruda, 'numero_bandeja'))

    const vCC = celda(cruda, 'cabezas_conformes').trim()
    const vCNC = celda(cruda, 'cabezas_no_conformes').trim()
    const vTC = celda(cruda, 'total_cabezas').trim()
    const cabezas_conformes = vCC === '' ? null : entero(vCC)
    const cabezas_no_conformes = vCNC === '' ? null : entero(vCNC)
    const total_cabezas = vTC === '' ? null : entero(vTC)
    if (vCC !== '' && cabezas_conformes === null) advertencias.push('CABEZAS CONFORMES no numérico')
    if (vCNC !== '' && cabezas_no_conformes === null) advertencias.push('CABEZAS NO CONFORMES no numérico')
    if (vTC !== '' && total_cabezas === null) advertencias.push('TOTAL DE CABEZAS no numérico')
    if (cabezas_conformes !== null && cabezas_conformes < 0) advertencias.push('CABEZAS CONFORMES negativo')
    if (cabezas_no_conformes !== null && cabezas_no_conformes < 0) advertencias.push('CABEZAS NO CONFORMES negativo')

    const vSemana = celda(cruda, 'semana').trim()
    const semana = vSemana === '' ? null : entero(vSemana)

    const vTiempo = celda(cruda, 'tiempo').trim()
    const tiempo_crudo = vTiempo === '' ? null : vTiempo
    const marca_registro = vTiempo === '' ? null : marcaHora(vTiempo)

    // Coherencia TIEMPO vs HORA:MINUTO (solo advertencia, nunca horas trabajadas)
    const vHora = celda(cruda, 'hora').trim()
    const vMin = celda(cruda, 'minuto').trim()
    const hNum = vHora === '' ? null : entero(vHora)
    const mNum = vMin === '' ? null : entero(vMin)
    if (marca_registro !== null && hNum !== null && mNum !== null) {
      const hm = `${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')}`
      if (marca_registro.slice(0, 5) !== hm) {
        advertencias.push('Marca de hora inconsistente: TIEMPO no coincide con HORA:MINUTO')
      }
    }

    // Coherencia DIA/MES/AÑO vs FECHA
    const dNum = entero(celda(cruda, 'dia').trim() || 'x')
    const mesNum = entero(celda(cruda, 'mes').trim() || 'x')
    const aNum = entero(celda(cruda, 'ano').trim() || 'x')
    if (fecha_registro !== null && dNum !== null && mesNum !== null && aNum !== null) {
      const comp2 = `${String(aNum).padStart(4, '0')}-${String(mesNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`
      if (comp2 !== fecha_registro) {
        advertencias.push('DIA/MES/AÑO no coincide con la columna FECHA')
      }
    }

    const vOcu = celda(cruda, 'ocupacion').trim()
    const ocupacion = vOcu === '' ? null : decimal(vOcu)
    if (vOcu !== '' && ocupacion === null) advertencias.push('OCUPACIÓN no numérica')

    const n: Normalizada = {
      fecha_produccion,
      numero_produccion,
      liquido,
      fecha_cargue,
      posicion,
      tanque,
      finca,
      codigo_pasmador,
      nombre_pasmador,
      variedad,
      numero_bandeja,
      codigo_ensamblador,
      nombre_ensamblador,
      cabezas_conformes,
      cabezas_no_conformes,
      total_cabezas,
      fecha_registro,
      semana,
      marca_registro,
      tiempo_crudo,
      tipo_bandeja,
      ocupacion
    }

    // ---- reglas de rechazo ----
    const sinCantidades = cabezas_conformes === null && cabezas_no_conformes === null && total_cabezas === null

    if (numero_bandeja === null && sinCantidades) {
      rechazadas.push({
        filaOrigen,
        motivo: 'Fila de plantilla: sin n° de bandeja y sin cantidades',
        contenido: cruda.join('\t').slice(0, 300)
      })
      continue
    }

    if (
      fecha_produccion === null &&
      numero_produccion === null &&
      tanque === null &&
      posicion === null &&
      numero_bandeja === null
    ) {
      rechazadas.push({
        filaOrigen,
        motivo: 'Sin datos de identificación del evento',
        contenido: cruda.join('\t').slice(0, 300)
      })
      continue
    }

    // ---- advertencias de aptitud por indicador (no rechazan) ----
    if (numero_bandeja === null) {
      advertencias.push('Sin n° de bandeja: cuenta como evento, no como bandeja física')
    }
    if (fecha_produccion === null) {
      advertencias.push('Sin fecha de producción válida: excluida de vistas por esa fecha')
    }
    if (codigo_ensamblador === null) {
      advertencias.push('Sin código de ensamblador')
    }
    if (fecha_registro === null) {
      advertencias.push('Sin columna FECHA (registro)')
    }

    let cantidadesValidas = false
    if (cabezas_conformes !== null && cabezas_no_conformes !== null && cabezas_conformes >= 0 && cabezas_no_conformes >= 0) {
      if () {
        cantidadesValidas = true
      } else {
        advertencias.push('total_cabezas !== null && cabezas_conformes + cabezas_no_conformes === total_cabezas')
      }
    } else {
      advertencias.push('Cantidades incompletas: excluida de la suma de cabezas')
    }

    const clave = claveEvento(n)
    const huella = await huellaFila(cruda)

    filas.push({ filaOrigen, clave, huella, crudo: cruda, n, advertencias, cantidadesValidas })
  }

  onProgreso?.(totalFilasDatos, totalFilasDatos)

  return { filas, rechazadas, mapeo, totalFilasDatos, errorGeneral: null }
}
