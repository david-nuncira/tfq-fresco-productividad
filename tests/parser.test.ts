// Pruebas de los criterios de aceptación del parser y la identidad.
// Ejecutar con: npm test

import { describe, expect, it } from 'vitest'
import { celdaSegura } from '../src/lib/csv'
import { mapearEncabezados, normalizarTexto } from '../src/importador/columnas'
import { claveEvento, fechaISO, parsearTexto } from '../src/importador/parser'
import { analizarInternos } from '../src/importador/internos'

// Encabezado REAL: 28 columnas, incluye "N°<CRLF>BANDEJA" entre comillas
// y el encabezado extraño "1630" al final.
const ENCABEZADO =
  'FECHA DE PRODUCCIÓN\tNUMERO DE PRODUCIÓN\tLÍQUIDO\tFECHA DE CARGUE\tPOSICIÓN\tTANQUE\tFINCA\tCÓDIGO PASMADOR\tNOMBRE PASMADOR\tVARIEDAD\t"N°\r\nBANDEJA"\tCODIGO ENSAMBLADOR\tNOMBRE ENSAMBLADOR\tCABEZAS CONFORMES\tCABEZAS NO CONFORMES\tTOTAL DE CABEZAS\tDIA\tMES\tAÑO\tFECHA\tSEMANA\tHORA\tMINUTO\tSEGUNDO\tTIEMPO\tTIPO DE BANDEJA\tOCUPACIÓN\t1630'

function fila(valores: Partial<Record<string, string>>): string {
  const v = (k: string, defecto = '') => valores[k] ?? defecto
  return [
    v('fprod', '02/01/2026'),
    v('nprod', '1'),
    v('liquido', 'LIQUIDO DEMO 1'),
    v('fcargue', '31/12/2025'),
    v('pos', '1'),
    v('tanque', 'B1'),
    v('finca', 'DF'),
    v('codpas', 'P01'),
    v('nompas', 'PASMADOR DEMO UNO'),
    v('variedad', 'VARIEDAD A'),
    v('bandeja', '935'),
    v('codens', 'E01'),
    v('nomens', 'ENSAMBLADOR DEMO UNO'),
    v('cc', '58'),
    v('cnc', '0'),
    v('tc', '58'),
    v('dia', '30'),
    v('mes', '12'),
    v('ano', '2025'),
    v('fecha', '30/12/2025'),
    v('semana', '1'),
    v('hora', '20'),
    v('minuto', '35'),
    v('segundo', '0'),
    v('tiempo', '20:35'),
    v('tipo', 'L0'),
    v('ocupacion', '0.06'),
    v('extra', '0')
  ].join('\t')
}

describe('mapeo de encabezados', () => {
  it('normaliza tildes, grados y saltos de línea', () => {
    expect(normalizarTexto('N°\r\nBANDEJA')).toBe('N BANDEJA')
    expect(normalizarTexto('  FECHA   DE PRODUCCIÓN ')).toBe('FECHA DE PRODUCCION')
  })

  it('acepta la variante PRODUCIÓN/PRODUCCIÓN', () => {
    const m = mapearEncabezados(['NUMERO DE PRODUCIÓN'])
    expect(m.indice.numero_produccion).toBe(0)
    const m2 = mapearEncabezados(['NÚMERO DE PRODUCCIÓN'])
    expect(m2.indice.numero_produccion).toBe(0)
  })
})

describe('criterio: pegar el formato real no desplaza columnas', () => {
  it('parsea el encabezado con salto de línea dentro de comillas', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({}) + '\r\n' + fila({ pos: '2', bandeja: '1205' })
    const r = await parsearTexto(texto)
    expect(r.errorGeneral).toBeNull()
    expect(r.filas).toHaveLength(2)
    const f = r.filas[0]
    expect(f.n.fecha_produccion).toBe('2026-01-02')
    expect(f.n.numero_bandeja).toBe('935')
    expect(f.n.codigo_ensamblador).toBe('E01')
    expect(f.n.cabezas_conformes).toBe(58)
    expect(f.n.total_cabezas).toBe(58)
    expect(f.n.tipo_bandeja).toBe('L0')
    expect(f.crudo).toHaveLength(28) // la columna "1630" se conserva en crudo
    expect(f.crudo[27]).toBe('0')
  })
})

describe('criterio: las filas de plantilla no aumentan las bandejas', () => {
  it('rechaza filas sin bandeja y sin cantidades', async () => {
    const plantilla = fila({ bandeja: '', codens: '', nomens: '', cc: '', cnc: '', tc: '', dia: '0', mes: '0', ano: '0', fecha: '', semana: '', hora: '0', minuto: '0', segundo: '', tiempo: '', tipo: '' })
    const texto = ENCABEZADO + '\r\n' + fila({}) + '\r\n' + plantilla
    const r = await parsearTexto(texto)
    expect(r.filas).toHaveLength(1)
    expect(r.rechazadas).toHaveLength(1)
    expect(r.rechazadas[0].motivo).toContain('plantilla')
  })

  it('una fila sin bandeja pero con cantidades sí cuenta como evento, con advertencia', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({ bandeja: '' })
    const r = await parsearTexto(texto)
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0].advertencias.join(' ')).toContain('Sin n° de bandeja')
  })
})

describe('criterio: vacíos no se vuelven ceros y errores de Excel no inventan datos', () => {
  it('cantidades vacías quedan null y excluidas de cabezas', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({ cc: '', cnc: '', tc: '' })
    const r = await parsearTexto(texto)
    const f = r.filas[0]
    expect(f.n.cabezas_conformes).toBeNull()
    expect(f.cantidadesValidas).toBe(false)
  })

  it('#¡REF! se marca como advertencia y conserva el original', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({ tanque: '#¡REF!' })
    const r = await parsearTexto(texto)
    const f = r.filas[0]
    expect(f.advertencias.join(' ')).toContain('#¡REF!')
    expect(f.crudo[5]).toBe('#¡REF!')
  })

  it('conformes + no conformes ≠ total queda marcado y excluido de cabezas', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({ cc: '50', cnc: '5', tc: '60' })
    const r = await parsearTexto(texto)
    const f = r.filas[0]
    expect(f.cantidadesValidas).toBe(false)
    expect(f.advertencias.join(' ')).toContain('≠ total')
  })

  it('fechas no válidas no se inventan', () => {
    expect(fechaISO('31/02/2026')).toBeNull()
    expect(fechaISO('2026-01-02')).toBeNull()
    expect(fechaISO('02/01/2026')).toBe('2026-01-02')
  })

  it('TIEMPO es una hora del día, nunca una duración, y detecta marcas arrastradas', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({ hora: '0', minuto: '0', tiempo: '20:35' })
    const r = await parsearTexto(texto)
    const f = r.filas[0]
    expect(f.n.marca_registro).toBe('20:35:00')
    expect(f.n.tiempo_crudo).toBe('20:35')
    expect(f.advertencias.join(' ')).toContain('Marca de hora inconsistente')
  })
})

describe('criterio: identidad de evento', () => {
  it('reimportar el mismo contenido se reconoce como duplicado interno', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({}) + '\r\n' + fila({})
    const r = await parsearTexto(texto)
    expect(r.filas).toHaveLength(2)
    expect(r.filas[0].clave).toBe(r.filas[1].clave)
    expect(r.filas[0].huella).toBe(r.filas[1].huella)
    const internos = analizarInternos(r.filas)
    expect(internos.unicas).toHaveLength(1)
    expect(internos.duplicadasInternas).toBe(1)
    expect(internos.conflictosInternos).toBe(0)
  })

  it('una hora corregida mantiene la clave pero cambia la huella → conflicto, no evento nuevo', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({ tiempo: '8:09', hora: '8', minuto: '9' }) + '\r\n' + fila({ tiempo: '8:11', hora: '8', minuto: '11' })
    const r = await parsearTexto(texto)
    expect(r.filas[0].clave).toBe(r.filas[1].clave)
    expect(r.filas[0].huella).not.toBe(r.filas[1].huella)
    const internos = analizarInternos(r.filas)
    expect(internos.unicas).toHaveLength(1)
    expect(internos.conflictosInternos).toBe(1)
  })

  it('reutilizar una bandeja en otro evento legítimo produce claves distintas', async () => {
    const a = fila({})
    const b = fila({ fprod: '03/01/2026', nprod: '2', fcargue: '02/01/2026' }) // misma bandeja 935, otra producción
    const r = await parsearTexto(ENCABEZADO + '\r\n' + a + '\r\n' + b)
    expect(r.filas[0].clave).not.toBe(r.filas[1].clave)
  })

  it('la clave normaliza mayúsculas y espacios pero conserva ceros iniciales', () => {
    const n = {
      fecha_produccion: '2026-01-02',
      numero_produccion: '007',
      tanque: 'b1',
      posicion: ' 1 ',
      numero_bandeja: '0935'
    }
    const clave = claveEvento({ ...n } as never)
    expect(clave).toBe('2026-01-02|007|B1|1|0935')
  })
})

describe('criterio: exportaciones CSV protegidas contra fórmulas', () => {
  it('antepone apóstrofo a valores que Excel interpretaría como fórmula', () => {
    expect(celdaSegura('=SUMA(A1:A9)')).toBe("'=SUMA(A1:A9)")
    expect(celdaSegura('+57 300')).toBe("'+57 300")
    expect(celdaSegura('@usuario')).toBe("'@usuario")
    expect(celdaSegura('-5')).toBe("'-5")
    expect(celdaSegura('texto normal')).toBe('texto normal')
  })

  it('escapa separadores y comillas', () => {
    expect(celdaSegura('a;b')).toBe('"a;b"')
    expect(celdaSegura('di"jo')).toBe('"di""jo"')
  })
})

describe('encabezados repetidos y columnas faltantes', () => {
  it('un encabezado repetido dentro de los datos se rechaza sin desplazar nada', async () => {
    const texto = ENCABEZADO + '\r\n' + fila({}) + '\r\n' + ENCABEZADO.replace(/"/g, '').replace('\r\n', ' ') + '\r\n' + fila({ pos: '2', bandeja: '77' })
    const r = await parsearTexto(texto)
    expect(r.filas).toHaveLength(2)
    expect(r.rechazadas.some((x) => x.motivo.includes('Encabezado repetido'))).toBe(true)
  })

  it('si faltan columnas requeridas, lo dice con claridad', async () => {
    const r = await parsearTexto('FECHA DE PRODUCCIÓN\tTANQUE\tOTRA COSA\tMAS\tY MAS\n1\t2\t3\t4\t5')
    expect(r.errorGeneral).toContain('Faltan columnas requeridas')
  })
})
