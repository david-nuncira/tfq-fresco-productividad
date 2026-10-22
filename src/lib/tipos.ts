// ============================================================
// Tipos compartidos de la aplicación
// ============================================================

export type Rol = 'admin' | 'analista' | 'lector'

export interface Perfil {
  id: string
  correo: string | null
  nombre: string | null
  rol: Rol
}

export type RolOperario = 'pasmador' | 'ensamblador'

/** Qué columna de fecha del Excel se usa para filtrar/agrupar. */
export type TipoFecha = 'produccion' | 'cargue' | 'registro'

export const NOMBRE_TIPO_FECHA: Record<TipoFecha, string> = {
  produccion: 'Fecha de producción',
  cargue: 'Fecha de cargue',
  registro: 'FECHA (columna de registro, etapa sin confirmar)'
}

export interface Filtros {
  desde: string | null
  hasta: string | null
  tipoFecha: TipoFecha
  rolOperario: RolOperario
  operario: string | null
  finca: string | null
  variedad: string | null
  tanque: string | null
  liquido: string | null
  tipoBandeja: string | null
  turno: string | null
}

export interface OperarioOpcion {
  codigo: string
  nombre: string | null
}

export interface ConfigEtapaMarca {
  confirmada: boolean
  etapa: string | null
  nota: string | null
}

export interface Turno {
  nombre: string
  inicio: string
  fin: string
}

export interface RangoFechas {
  min: string | null
  max: string | null
}

export interface OpcionesFiltros {
  fincas: string[]
  variedades: string[]
  tanques: string[]
  liquidos: string[]
  tipos_bandeja: string[]
  pasmadores: OperarioOpcion[]
  ensambladores: OperarioOpcion[]
  fechas: {
    produccion: RangoFechas
    cargue: RangoFechas
    registro: RangoFechas
  }
  turnos: { definidos: boolean; lista: Turno[] }
  etapa_marca: ConfigEtapaMarca
}

export interface ResumenAgregado {
  bandejas: number
  bandejas_fisicas: number
  eventos_sin_bandeja: number
  conformes: number
  no_conformes: number
  cabezas: number
  pct_conformidad: number | null
  dias: number
  operarios: number
  exclusiones: {
    sin_fecha: number
    cantidades_invalidas: number
  }
}

export interface PuntoDia {
  fecha: string
  bandejas: number
  conformes: number
  no_conformes: number
}

export interface FilaOperario {
  codigo: string
  nombre_oficial: string | null
  nombres: string[]
  bandejas: number
  conformes: number
  no_conformes: number
  cabezas: number
  pct_conformidad: number | null
  dias: number
}

export interface ProductividadOperario {
  codigo: string
  nombre: string | null
  bandejas: number
  cabezas: number
  horas: number
  bandejas_hora: number | null
  cabezas_hora: number | null
}

export interface ProductividadGeneral {
  bandejas: number
  cabezas: number
  horas: number
  bandejas_hora: number | null
  cabezas_hora: number | null
}

export interface Productividad {
  disponible: boolean
  motivo: string | null
  general: ProductividadGeneral | null
  operarios: ProductividadOperario[]
  exclusiones: { eventos_sin_horas: number; registros_horas: number } | null
}

export interface VentanaFila {
  codigo: string
  fecha: string
  primera: string
  ultima: string
  marcas: number
}

export interface Ventana {
  disponible: boolean
  motivo: string | null
  filas: VentanaFila[]
}

export interface EstadoDatos {
  eventos_activos: number
  conflictos_pendientes: number
  lotes_pendientes: number
  ultima_importacion: {
    creado_en: string
    nuevas: number
    duplicadas: number
    conflictos: number
    correo: string | null
  } | null
  etapa_marca: ConfigEtapaMarca
}

export interface AdvertenciaConteo {
  advertencia: string
  filas: number
}

export interface NombreConteo {
  nombre: string
  filas: number
}

export interface InconsistenciaOperario {
  rol: RolOperario
  codigo: string
  nombres: NombreConteo[]
}

export interface Calidad {
  eventos_activos: number
  cantidades_invalidas: number
  sin_bandeja: number
  advertencias: AdvertenciaConteo[]
  inconsistencias: InconsistenciaOperario[]
}

export interface LoteInfo {
  id: string
  creado_en: string
  origen: string
  nombre_origen: string | null
  estado: string
  filas_recibidas: number
  nuevas: number
  duplicadas: number
  conflictos: number
  errores: number
  rechazadas_cliente: number
  creador: string | null
  motivo_anulacion: string | null
}

export interface LadoConflicto {
  id: number
  lote_id: string
  fila_origen: number | null
  creado_en: string
  n: Record<string, string | number | boolean | null>
  crudo: string[]
}

export interface ConflictoPar {
  conflicto: LadoConflicto
  activo: LadoConflicto | null
  diferencias: string[]
}

export interface OperarioCatalogo {
  codigo: string
  rol: RolOperario
  nombre_oficial: string
  activo: boolean
}

/** Fila del detalle (vista v_eventos). */
export interface EventoDetalle {
  id: number
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
  marca_registro: string | null
  tipo_bandeja: string | null
  ocupacion: number | null
  cantidades_validas: boolean
  advertencias: string[] | null
  repeticion_confirmada: boolean
  lote_id: string
  fila_origen: number | null
}

export const COLUMNAS_DETALLE: { clave: keyof EventoDetalle; titulo: string }[] = [
  { clave: 'fecha_produccion', titulo: 'F. producción' },
  { clave: 'numero_produccion', titulo: 'N° prod.' },
  { clave: 'liquido', titulo: 'Líquido' },
  { clave: 'fecha_cargue', titulo: 'F. cargue' },
  { clave: 'tanque', titulo: 'Tanque' },
  { clave: 'posicion', titulo: 'Pos.' },
  { clave: 'finca', titulo: 'Finca' },
  { clave: 'variedad', titulo: 'Variedad' },
  { clave: 'numero_bandeja', titulo: 'N° bandeja' },
  { clave: 'codigo_pasmador', titulo: 'Cód. pasmador' },
  { clave: 'nombre_pasmador', titulo: 'Pasmador' },
  { clave: 'codigo_ensamblador', titulo: 'Cód. ensamblador' },
  { clave: 'nombre_ensamblador', titulo: 'Ensamblador' },
  { clave: 'cabezas_conformes', titulo: 'Conformes' },
  { clave: 'cabezas_no_conformes', titulo: 'No conformes' },
  { clave: 'total_cabezas', titulo: 'Total cabezas' },
  { clave: 'fecha_registro', titulo: 'FECHA (registro)' },
  { clave: 'marca_registro', titulo: 'Marca hora' },
  { clave: 'tipo_bandeja', titulo: 'Tipo bandeja' },
  { clave: 'ocupacion', titulo: 'Ocupación' }
]
