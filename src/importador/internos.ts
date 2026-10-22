// Análisis de repeticiones DENTRO del propio pegado (sin tocar la red):
// separa duplicados exactos y conflictos internos de las filas únicas.

import type { FilaImportable } from './parser'

export interface ResultadoInternos {
  unicas: FilaImportable[]
  duplicadasInternas: number
  conflictosInternos: number
}

export function analizarInternos(filas: FilaImportable[]): ResultadoInternos {
  const vistosContenido = new Set<string>()
  const vistosClave = new Set<string>()
  const unicas: FilaImportable[] = []
  let duplicadasInternas = 0
  let conflictosInternos = 0

  for (const f of filas) {
    const contenido = f.clave + '\u001f' + f.huella
    if (vistosContenido.has(contenido)) {
      duplicadasInternas++
      continue
    }
    vistosContenido.add(contenido)
    if (vistosClave.has(f.clave)) {
      conflictosInternos++
      continue
    }
    vistosClave.add(f.clave)
    unicas.push(f)
  }

  return { unicas, duplicadasInternas, conflictosInternos }
}
