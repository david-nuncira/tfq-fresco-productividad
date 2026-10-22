// ============================================================
// Subida de filas al servidor por lotes, con reintentos y
// posibilidad de cancelar/descartar sin dejar datos a medias.
//
// Garantías (ver supabase/esquema.sql):
//  - Las filas se insertan asociadas a un lote en estado
//    'pendiente'. Los indicadores SOLO cuentan lotes
//    'confirmados', así que una importación interrumpida nunca
//    publica datos parciales.
//  - La clasificación nueva/duplicada/conflicto la decide el
//    SERVIDOR (fn_importar) con bloqueos por clave, por lo que
//    dos importaciones simultáneas no duplican eventos.
// ============================================================

import { supabase } from '../lib/supabase'
import { analizarInternos } from './internos'
import type { FilaImportable } from './parser'

export { analizarInternos }

const TAMANO_LOTE_CLASIFICACION = 1000
const TAMANO_LOTE_IMPORTACION = 400
const REINTENTOS = 3

export interface ConteoClasificacion {
  nuevas: number
  duplicadas: number
  conflictos: number
}

export interface ErrorFila {
  fila: number
  error: string
}

export interface ResultadoImportacion {
  loteId: string
  nuevas: number
  duplicadas: number
  conflictos: number
  errores: ErrorFila[]
}

function filaAPayload(f: FilaImportable) {
  return {
    c: f.clave,
    h: f.huella,
    f: f.filaOrigen,
    crudo: f.crudo,
    n: f.n,
    adv: f.advertencias,
    cv: f.cantidadesValidas
  }
}

async function rpcConReintentos<T>(nombre: string, params: Record<string, unknown>): Promise<T> {
  let ultimoError: Error | null = null
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    const { data, error } = await supabase.rpc(nombre, params)
    if (!error) return data as T
    ultimoError = new Error(error.message)
    // No reintentar errores de permisos o de validación.
    if (/permiso|autoriza|no existe|inválid|invalid/i.test(error.message)) break
    await new Promise((r) => setTimeout(r, 800 * intento))
  }
  throw ultimoError ?? new Error('Error de comunicación con la base de datos')
}

/**
 * Clasificación previa (solo lectura): cuántas filas serían nuevas,
 * duplicadas o conflictos. Combina las repeticiones internas del
 * pegado con la comparación contra la base.
 */
export async function clasificarFilas(
  filas: FilaImportable[],
  onProgreso?: (hechas: number, total: number) => void
): Promise<ConteoClasificacion> {
  const { unicas, duplicadasInternas, conflictosInternos } = analizarInternos(filas)
  const total = unicas.length
  const conteo: ConteoClasificacion = {
    nuevas: 0,
    duplicadas: duplicadasInternas,
    conflictos: conflictosInternos
  }
  for (let i = 0; i < total; i += TAMANO_LOTE_CLASIFICACION) {
    const trozo = unicas.slice(i, i + TAMANO_LOTE_CLASIFICACION).map((f) => ({ c: f.clave, h: f.huella }))
    const r = await rpcConReintentos<{ nuevas: number; duplicadas: number; conflictos: number }>('fn_clasificar', {
      p_filas: trozo
    })
    conteo.nuevas += r.nuevas
    conteo.duplicadas += r.duplicadas
    conteo.conflictos += r.conflictos
    onProgreso?.(Math.min(i + TAMANO_LOTE_CLASIFICACION, total), total)
  }
  return conteo
}

export interface OpcionesImportacion {
  origen: 'pegado' | 'archivo'
  nombreOrigen: string | null
  rechazadasCliente: number
  filasRecibidas: number
  onProgreso?: (hechas: number, total: number) => void
  debeCancelar?: () => boolean
}

/**
 * Ejecuta la importación completa:
 * 1) crea el lote (pendiente), 2) sube las filas por trozos con
 * reintentos, 3) confirma el lote. Si se cancela o falla, el lote
 * queda pendiente y puede reanudarse (re-pegando lo mismo) o
 * descartarse desde "Importaciones".
 */
export async function ejecutarImportacion(
  filas: FilaImportable[],
  opciones: OpcionesImportacion
): Promise<ResultadoImportacion> {
  const loteId = await rpcConReintentos<string>('fn_crear_lote', {
    p_origen: opciones.origen,
    p_nombre: opciones.nombreOrigen,
    p_filas_recibidas: opciones.filasRecibidas,
    p_rechazadas_cliente: opciones.rechazadasCliente
  })

  const resultado: ResultadoImportacion = { loteId, nuevas: 0, duplicadas: 0, conflictos: 0, errores: [] }
  const total = filas.length

  for (let i = 0; i < total; i += TAMANO_LOTE_IMPORTACION) {
    if (opciones.debeCancelar?.()) {
      throw new ImportacionCancelada(loteId, resultado)
    }
    const trozo = filas.slice(i, i + TAMANO_LOTE_IMPORTACION).map(filaAPayload)
    const r = await rpcConReintentos<{
      nuevas: number
      duplicadas: number
      conflictos: number
      errores: ErrorFila[] | null
    }>('fn_importar', { p_lote: loteId, p_filas: trozo, p_bloque: i / TAMANO_LOTE_IMPORTACION })
    resultado.nuevas += r.nuevas
    resultado.duplicadas += r.duplicadas
    resultado.conflictos += r.conflictos
    if (r.errores) resultado.errores.push(...r.errores)
    opciones.onProgreso?.(Math.min(i + TAMANO_LOTE_IMPORTACION, total), total)
  }  if (resultado.errores.length > 0) {
    const detalle = resultado.errores.slice(0, 5).map((e) => `fila ${e.fila}: ${e.error}`).join('; ')
    throw new Error(`${resultado.errores.length} filas no pudieron guardarse. Primeros errores: ${detalle}. El lote sigue pendiente y no cuenta en los indicadores.`)
  }

  await rpcConReintentos('fn_confirmar_lote', { p_lote: loteId })
  return resultado
}

export class ImportacionCancelada extends Error {
  loteId: string
  parcial: ResultadoImportacion
  constructor(loteId: string, parcial: ResultadoImportacion) {
    super('Importación cancelada por el usuario')
    this.loteId = loteId
    this.parcial = parcial
  }
}

/** Descarta un lote pendiente (elimina sus filas no confirmadas). */
export async function descartarLote(loteId: string): Promise<void> {
  await rpcConReintentos('fn_descartar_lote', { p_lote: loteId })
}
