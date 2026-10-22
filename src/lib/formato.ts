// Formateo de números y fechas para Colombia (es-CO).

const fmtEntero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export function fmtEnt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return fmtEntero.format(Math.round(n))
}

export function fmtNum(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(n)
}

export function fmtPct(n: number | null | undefined, decimales = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${fmtNum(n, decimales)} %`
}

/** De ISO (aaaa-mm-dd) a dd/mm/aaaa para mostrar. */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Fecha de hoy en Bogotá, formato ISO aaaa-mm-dd. */
export function hoyISO(): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return f.format(new Date())
}

/** Fecha de hace `dias` días (Bogotá), formato ISO. */
export function haceDiasISO(dias: number): string {
  const hoy = hoyISO()
  const [a, m, d] = hoy.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() - dias)
  return fecha.toISOString().slice(0, 10)
}
