// ============================================================
// Tokenizador TSV/CSV propio, sin dependencias.
//
// Reproduce el comportamiento de un rango copiado desde Excel:
//  - campos separados por tabulación (o por el separador indicado),
//  - registros separados por \r\n, \n o \r,
//  - un campo que EMPIEZA con comilla doble está entrecomillado:
//    dentro puede haber tabulaciones y saltos de línea literales,
//    y "" representa una comilla literal (así viene el encabezado
//    real "N°<salto>BANDEJA"),
//  - una comilla en medio de un campo no entrecomillado es literal.
//
// No basta dividir cada línea por tabulaciones: eso desplazaría
// columnas con el encabezado real. Este tokenizador se prueba en
// tests/parser.test.ts y contra el archivo completo del proceso.
// ============================================================

export function parseTabla(texto: string, separador: '\t' | ';' | ',' = '\t'): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let enComillas = false
  let campoEntrecomillado = false
  let i = 0
  const n = texto.length

  while (i < n) {
    const c = texto[i]

    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i += 2
          continue
        }
        enComillas = false
        i++
        continue
      }
      campo += c
      i++
      continue
    }

    if (c === '"' && campo === '' && !campoEntrecomillado) {
      enComillas = true
      campoEntrecomillado = true
      i++
      continue
    }

    if (c === separador) {
      fila.push(campo)
      campo = ''
      campoEntrecomillado = false
      i++
      continue
    }

    if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo)
      filas.push(fila)
      fila = []
      campo = ''
      campoEntrecomillado = false
      i++
      continue
    }

    campo += c
    i++
  }

  // Último campo/registro si el texto no termina en salto de línea
  // (incluye el caso de una comilla sin cerrar al final).
  if (campo !== '' || campoEntrecomillado || fila.length > 0) {
    fila.push(campo)
    filas.push(fila)
  }

  return filas
}

/** Detecta el separador más probable mirando la primera línea lógica:
 *  tabulación (pegado de Excel / TSV) o punto y coma / coma (CSV). */
export function detectarSeparador(texto: string): '\t' | ';' | ',' {
  const primeraLinea = texto.slice(0, 4000).split(/\r?\n/)[0] ?? ''
  if (primeraLinea.includes('\t')) return '\t'
  const puntosYComa = (primeraLinea.match(/;/g) ?? []).length
  const comas = (primeraLinea.match(/,/g) ?? []).length
  if (puntosYComa === 0 && comas === 0) return '\t'
  return puntosYComa >= comas ? ';' : ','
}
