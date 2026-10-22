// ============================================================
// Definición de las columnas del Excel de Control Pasmado y su
// mapeo tolerante (tildes, mayúsculas, espacios, N°, variantes
// "PRODUCIÓN/PRODUCCIÓN", saltos de línea dentro del encabezado).
// ============================================================

/** Normaliza un texto para comparar encabezados y códigos:
 *  quita tildes, pasa a mayúsculas, reemplaza ° º y puntos por
 *  espacio y colapsa espacios (incluye saltos de línea). */
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[°º.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Claves internas de las columnas conocidas, en el orden del Excel. */
export type ClaveColumna =
  | 'fecha_produccion'
  | 'numero_produccion'
  | 'liquido'
  | 'fecha_cargue'
  | 'posicion'
  | 'tanque'
  | 'finca'
  | 'codigo_pasmador'
  | 'nombre_pasmador'
  | 'variedad'
  | 'numero_bandeja'
  | 'codigo_ensamblador'
  | 'nombre_ensamblador'
  | 'cabezas_conformes'
  | 'cabezas_no_conformes'
  | 'total_cabezas'
  | 'dia'
  | 'mes'
  | 'ano'
  | 'fecha_registro'
  | 'semana'
  | 'hora'
  | 'minuto'
  | 'segundo'
  | 'tiempo'
  | 'tipo_bandeja'
  | 'ocupacion'

interface DefColumna {
  clave: ClaveColumna
  titulo: string
  alias: string[] // ya normalizados con normalizarTexto
}

export const COLUMNAS: DefColumna[] = [
  { clave: 'fecha_produccion', titulo: 'FECHA DE PRODUCCIÓN', alias: ['FECHA DE PRODUCCION', 'FECHA PRODUCCION'] },
  { clave: 'numero_produccion', titulo: 'NUMERO DE PRODUCIÓN', alias: ['NUMERO DE PRODUCION', 'NUMERO DE PRODUCCION', 'N DE PRODUCCION', 'NO DE PRODUCCION', 'NUMERO PRODUCCION'] },
  { clave: 'liquido', titulo: 'LÍQUIDO', alias: ['LIQUIDO'] },
  { clave: 'fecha_cargue', titulo: 'FECHA DE CARGUE', alias: ['FECHA DE CARGUE', 'FECHA CARGUE'] },
  { clave: 'posicion', titulo: 'POSICIÓN', alias: ['POSICION'] },
  { clave: 'tanque', titulo: 'TANQUE', alias: ['TANQUE'] },
  { clave: 'finca', titulo: 'FINCA', alias: ['FINCA'] },
  { clave: 'codigo_pasmador', titulo: 'CÓDIGO PASMADOR', alias: ['CODIGO PASMADOR', 'COD PASMADOR'] },
  { clave: 'nombre_pasmador', titulo: 'NOMBRE PASMADOR', alias: ['NOMBRE PASMADOR'] },
  { clave: 'variedad', titulo: 'VARIEDAD', alias: ['VARIEDAD'] },
  { clave: 'numero_bandeja', titulo: 'N° BANDEJA', alias: ['N BANDEJA', 'NO BANDEJA', 'NUMERO BANDEJA', 'NUM BANDEJA', 'N DE BANDEJA', 'BANDEJA'] },
  { clave: 'codigo_ensamblador', titulo: 'CODIGO ENSAMBLADOR', alias: ['CODIGO ENSAMBLADOR', 'COD ENSAMBLADOR'] },
  { clave: 'nombre_ensamblador', titulo: 'NOMBRE ENSAMBLADOR', alias: ['NOMBRE ENSAMBLADOR'] },
  { clave: 'cabezas_conformes', titulo: 'CABEZAS CONFORMES', alias: ['CABEZAS CONFORMES'] },
  { clave: 'cabezas_no_conformes', titulo: 'CABEZAS NO CONFORMES', alias: ['CABEZAS NO CONFORMES'] },
  { clave: 'total_cabezas', titulo: 'TOTAL DE CABEZAS', alias: ['TOTAL DE CABEZAS', 'TOTAL CABEZAS'] },
  { clave: 'dia', titulo: 'DIA', alias: ['DIA'] },
  { clave: 'mes', titulo: 'MES', alias: ['MES'] },
  { clave: 'ano', titulo: 'AÑO', alias: ['ANO'] },
  { clave: 'fecha_registro', titulo: 'FECHA', alias: ['FECHA'] },
  { clave: 'semana', titulo: 'SEMANA', alias: ['SEMANA'] },
  { clave: 'hora', titulo: 'HORA', alias: ['HORA'] },
  { clave: 'minuto', titulo: 'MINUTO', alias: ['MINUTO'] },
  { clave: 'segundo', titulo: 'SEGUNDO', alias: ['SEGUNDO'] },
  { clave: 'tiempo', titulo: 'TIEMPO', alias: ['TIEMPO'] },
  { clave: 'tipo_bandeja', titulo: 'TIPO DE BANDEJA', alias: ['TIPO DE BANDEJA', 'TIPO BANDEJA'] },
  { clave: 'ocupacion', titulo: 'OCUPACIÓN', alias: ['OCUPACION'] }
]

/** Columnas sin las cuales no se puede importar con seguridad. */
export const COLUMNAS_REQUERIDAS: ClaveColumna[] = [
  'fecha_produccion',
  'numero_produccion',
  'tanque',
  'posicion',
  'numero_bandeja',
  'cabezas_conformes',
  'cabezas_no_conformes',
  'total_cabezas'
]

export interface MapeoEncabezados {
  /** clave de columna -> índice en la fila pegada */
  indice: Partial<Record<ClaveColumna, number>>
  /** encabezados no reconocidos (se conservan en el dato crudo) */
  desconocidos: { posicion: number; nombre: string }[]
  /** columnas requeridas que no se encontraron */
  faltantes: string[]
  /** total de columnas del pegado */
  totalColumnas: number
}

export function mapearEncabezados(encabezados: string[]): MapeoEncabezados {
  const indice: Partial<Record<ClaveColumna, number>> = {}
  const desconocidos: { posicion: number; nombre: string }[] = []

  const porAlias = new Map<string, ClaveColumna>()
  for (const def of COLUMNAS) {
    for (const a of def.alias) porAlias.set(a, def.clave)
  }

  encabezados.forEach((enc, i) => {
    const norm = normalizarTexto(enc)
    const clave = porAlias.get(norm)
    if (clave !== undefined && indice[clave] === undefined) {
      indice[clave] = i
    } else {
      desconocidos.push({ posicion: i + 1, nombre: enc.replace(/\s+/g, ' ').trim() || '(sin nombre)' })
    }
  })

  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => indice[c] === undefined).map(
    (c) => COLUMNAS.find((d) => d.clave === c)?.titulo ?? c
  )

  return { indice, desconocidos, faltantes, totalColumnas: encabezados.length }
}
