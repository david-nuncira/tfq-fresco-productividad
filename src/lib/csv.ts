// Generación segura de archivos CSV.
//
// Seguridad: los valores que empiezan por = + - @ o tabulación pueden
// interpretarse como FÓRMULAS al abrir el CSV en Excel ("CSV injection").
// Por eso se antepone un apóstrofo a esos valores: Excel los muestra
// como texto y no ejecuta nada.

const SEPARADOR = ';' // Excel en español (Colombia) usa punto y coma.

export function celdaSegura(valor: unknown): string {
  let s = valor === null || valor === undefined ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s
  }
  if (s.includes(SEPARADOR) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function generarCSV(encabezados: string[], filas: unknown[][]): string {
  const lineas: string[] = []
  lineas.push(encabezados.map(celdaSegura).join(SEPARADOR))
  for (const fila of filas) {
    lineas.push(fila.map(celdaSegura).join(SEPARADOR))
  }
  return lineas.join('\r\n')
}

/** Descarga un texto como archivo desde el navegador (con BOM para Excel). */
export function descargarTexto(nombreArchivo: string, contenido: string, tipo = 'text/csv;charset=utf-8'): void {
  const bom = '﻿'
  const blob = new Blob([bom + contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}
