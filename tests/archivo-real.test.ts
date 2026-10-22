// Prueba de integración contra el archivo real del proceso.
// No forma parte del repositorio de datos: se activa solo si se
// define la variable de entorno ARCHIVO_REAL con la ruta del TSV.
//
//   ARCHIVO_REAL="/ruta/Texto pegado.txt" npm test
//
// Verifica, con el archivo completo, los números encontrados en el
// diagnóstico: 27.984 filas de datos, 133 plantillas rechazadas,
// 27.851 eventos, y que la identidad clasifica 27.755 únicos,
// 92 duplicados exactos y 4 conflictos (redigitación con otra hora).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsearTexto } from '../src/importador/parser'
import { analizarInternos } from '../src/importador/internos'

const RUTA = process.env.ARCHIVO_REAL

describe.skipIf(!RUTA)('archivo real completo', () => {
  it('parsea sin desplazar columnas y clasifica la identidad como en el diagnóstico', async () => {
    const texto = readFileSync(RUTA as string, 'utf-8')
    const r = await parsearTexto(texto)

    expect(r.errorGeneral).toBeNull()
    expect(r.totalFilasDatos).toBe(27984)
    // 133 plantillas (sin bandeja ni cantidades)
    expect(r.rechazadas.filter((x) => x.motivo.includes('plantilla'))).toHaveLength(133)
    // 27.851 eventos candidatos
    expect(r.filas).toHaveLength(27851)
    // ninguna fila con la columna 28 fuera de lugar
    expect(r.filas.every((f) => f.crudo.length === 28)).toBe(true)

    const internos = analizarInternos(r.filas)
    expect(internos.unicas).toHaveLength(27755)
    expect(internos.duplicadasInternas).toBe(92)
    expect(internos.conflictosInternos).toBe(4)
  }, 120000)
})
