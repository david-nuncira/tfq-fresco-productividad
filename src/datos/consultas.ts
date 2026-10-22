// ============================================================
// Capa de consultas: envuelve las funciones RPC del servidor.
// Los totales y agregados se calculan SIEMPRE en la base de
// datos sobre todas las filas filtradas (nunca sobre la primera
// página devuelta).
// ============================================================

import { supabase } from '../lib/supabase'
import type {
  Calidad,
  ConflictoPar,
  EstadoDatos,
  EventoDetalle,
  FilaOperario,
  Filtros,
  LoteInfo,
  OpcionesFiltros,
  OperarioCatalogo,
  Productividad,
  PuntoDia,
  ResumenAgregado,
  RolOperario,
  TipoFecha,
  Ventana
} from '../lib/tipos'

function parametros(f: Filtros): Record<string, unknown> {
  return {
    desde: f.desde,
    hasta: f.hasta,
    tipo_fecha: f.tipoFecha,
    rol: f.rolOperario,
    operario: f.operario,
    finca: f.finca,
    variedad: f.variedad,
    tanque: f.tanque,
    liquido: f.liquido,
    tipo_bandeja: f.tipoBandeja,
    turno: f.turno
  }
}

async function rpc<T>(nombre: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nombre, params ?? {})
  if (error) throw new Error(error.message)
  return data as T
}

export function obtenerOpciones(): Promise<OpcionesFiltros> {
  return rpc<OpcionesFiltros>('fn_filtros')
}

export function obtenerResumen(f: Filtros): Promise<ResumenAgregado> {
  return rpc<ResumenAgregado>('fn_resumen', { p: parametros(f) })
}

export function obtenerPorDia(f: Filtros): Promise<PuntoDia[]> {
  return rpc<PuntoDia[]>('fn_por_dia', { p: parametros(f) })
}

export function obtenerPorOperario(f: Filtros): Promise<FilaOperario[]> {
  return rpc<FilaOperario[]>('fn_por_operario', { p: parametros(f) })
}

export function obtenerProductividad(f: Filtros): Promise<Productividad> {
  return rpc<Productividad>('fn_productividad', { p: parametros(f) })
}

export function obtenerVentana(f: Filtros): Promise<Ventana> {
  return rpc<Ventana>('fn_ventana', { p: parametros(f) })
}

export function obtenerEstadoDatos(): Promise<EstadoDatos> {
  return rpc<EstadoDatos>('fn_estado_datos')
}

export function obtenerCalidad(): Promise<Calidad> {
  return rpc<Calidad>('fn_calidad')
}

export function listarLotes(): Promise<LoteInfo[]> {
  return rpc<LoteInfo[]>('fn_lotes')
}

export function anularLote(loteId: string, motivo: string): Promise<void> {
  return rpc<void>('fn_anular_lote', { p_lote: loteId, p_motivo: motivo })
}

export function descartarLotePendiente(loteId: string): Promise<void> {
  return rpc<void>('fn_descartar_lote', { p_lote: loteId })
}

export function listarConflictos(): Promise<ConflictoPar[]> {
  return rpc<ConflictoPar[]>('fn_conflictos')
}

export type DecisionConflicto = 'mantener_existente' | 'aplicar_nuevo' | 'evento_independiente'

export function resolverConflicto(idConflicto: number, decision: DecisionConflicto, motivo: string): Promise<void> {
  return rpc<void>('fn_resolver_conflicto', { p_evento: idConflicto, p_decision: decision, p_motivo: motivo })
}

export interface FilaHoras {
  fecha: string
  codigo: string
  rol: RolOperario
  horas: number
}

export interface ResultadoHoras {
  insertadas: number
  actualizadas: number
  errores: { fila: number; error: string }[]
}

export function importarHoras(filas: FilaHoras[], nota: string): Promise<ResultadoHoras> {
  return rpc<ResultadoHoras>('fn_importar_horas', { p_filas: filas, p_nota: nota })
}

export function guardarConfig(clave: string, valor: unknown): Promise<void> {
  return rpc<void>('fn_guardar_config', { p_clave: clave, p_valor: valor })
}

export function guardarOperario(op: OperarioCatalogo): Promise<void> {
  return rpc<void>('fn_guardar_operario', {
    p_codigo: op.codigo,
    p_rol: op.rol,
    p_nombre: op.nombre_oficial,
    p_activo: op.activo
  })
}

export function listarOperariosCatalogo(): Promise<OperarioCatalogo[]> {
  return rpc<OperarioCatalogo[]>('fn_operarios_catalogo')
}

// ---------- detalle paginado y exportación ----------

const COLUMNA_FECHA: Record<TipoFecha, string> = {
  produccion: 'fecha_produccion',
  cargue: 'fecha_cargue',
  registro: 'fecha_registro'
}

function aplicarFiltrosDetalle(consulta: ReturnType<typeof baseDetalle>, f: Filtros, busqueda: string) {
  const col = COLUMNA_FECHA[f.tipoFecha]
  let q = consulta
  if (f.desde) q = q.gte(col, f.desde)
  if (f.hasta) q = q.lte(col, f.hasta)
  if (f.desde || f.hasta) q = q.not(col, 'is', null)
  if (f.finca) q = q.eq('finca', f.finca)
  if (f.variedad) q = q.eq('variedad', f.variedad)
  if (f.tanque) q = q.eq('tanque', f.tanque)
  if (f.liquido) q = q.eq('liquido', f.liquido)
  if (f.tipoBandeja) q = q.eq('tipo_bandeja', f.tipoBandeja)
  if (f.operario) {
    q = q.eq(f.rolOperario === 'pasmador' ? 'codigo_pasmador' : 'codigo_ensamblador', f.operario)
  }
  const b = busqueda.trim().replace(/[%,()]/g, ' ')
  if (b !== '') {
    q = q.or(
      [
        `numero_bandeja.ilike.%${b}%`,
        `numero_produccion.ilike.%${b}%`,
        `codigo_pasmador.ilike.%${b}%`,
        `codigo_ensamblador.ilike.%${b}%`,
        `nombre_pasmador.ilike.%${b}%`,
        `nombre_ensamblador.ilike.%${b}%`
      ].join(',')
    )
  }
  return q
}

function baseDetalle() {
  return supabase.from('v_eventos').select('*', { count: 'exact' })
}

export interface PaginaDetalle {
  filas: EventoDetalle[]
  total: number
}

export async function consultarDetalle(
  f: Filtros,
  busqueda: string,
  pagina: number,
  tamano: number
): Promise<PaginaDetalle> {
  const col = COLUMNA_FECHA[f.tipoFecha]
  const desde = pagina * tamano
  let q = aplicarFiltrosDetalle(baseDetalle(), f, busqueda)
  q = q.order(col, { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  const { data, error, count } = await q.range(desde, desde + tamano - 1)
  if (error) throw new Error(error.message)
  return { filas: (data ?? []) as unknown as EventoDetalle[], total: count ?? 0 }
}

const LIMITE_EXPORTACION = 100000
const PAGINA_EXPORTACION = 1000

/** Exporta TODAS las filas filtradas (paginando contra la base). */
export async function exportarDetalle(
  f: Filtros,
  busqueda: string,
  onProgreso?: (hechas: number, total: number) => void
): Promise<EventoDetalle[]> {
  const col = COLUMNA_FECHA[f.tipoFecha]
  const todas: EventoDetalle[] = []
  let total = Infinity
  for (let desde = 0; desde < total && desde < LIMITE_EXPORTACION; desde += PAGINA_EXPORTACION) {
    let q = aplicarFiltrosDetalle(baseDetalle(), f, busqueda)
    q = q.order(col, { ascending: false, nullsFirst: false }).order('id', { ascending: false })
    const { data, error, count } = await q.range(desde, desde + PAGINA_EXPORTACION - 1)
    if (error) throw new Error(error.message)
    if (count !== null && count !== undefined) total = count
    const filas = (data ?? []) as unknown as EventoDetalle[]
    todas.push(...filas)
    onProgreso?.(todas.length, Math.min(total, LIMITE_EXPORTACION))
    if (filas.length < PAGINA_EXPORTACION) break
  }
  return todas
}
