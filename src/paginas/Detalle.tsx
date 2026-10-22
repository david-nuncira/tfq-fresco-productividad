// Detalle de registros con búsqueda, paginación y exportación del
// resultado filtrado completo (paginado contra la base, no solo la
// página visible).

import { useEffect, useState } from 'react'
import { BarraFiltros } from '../componentes/BarraFiltros'
import { BarraProgreso, CajaError, Cargando, Insignia, SinDatos } from '../componentes/ui'
import { consultarDetalle, exportarDetalle } from '../datos/consultas'
import { useFiltros } from '../datos/filtros'
import { descargarTexto, generarCSV } from '../lib/csv'
import { fmtEnt, fmtFecha, hoyISO } from '../lib/formato'
import { COLUMNAS_DETALLE, type EventoDetalle } from '../lib/tipos'

const TAMANO_PAGINA = 50

export function Detalle() {
  const { filtros } = useFiltros()
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [pagina, setPagina] = useState(0)
  const [filas, setFilas] = useState<EventoDetalle[] | null>(null)
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportando, setExportando] = useState<{ hechas: number; total: number } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    setPagina(0)
  }, [filtros, busquedaAplicada])

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    consultarDetalle(filtros, busquedaAplicada, pagina, TAMANO_PAGINA)
      .then((r) => {
        if (!activo) return
        setFilas(r.filas)
        setTotal(r.total)
      })
      .catch((e: Error) => {
        if (activo) setError(e.message)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [filtros, busquedaAplicada, pagina, version])

  async function exportar() {
    try {
      setExportando({ hechas: 0, total: 1 })
      const todas = await exportarDetalle(filtros, busquedaAplicada, (hechas, t) => setExportando({ hechas, total: t }))
      const encabezados = COLUMNAS_DETALLE.map((c) => c.titulo).concat(['Cantidades válidas', 'Advertencias'])
      const cuerpo = todas.map((f) =>
        COLUMNAS_DETALLE.map((c) => {
          const v = f[c.clave]
          if (c.clave === 'fecha_produccion' || c.clave === 'fecha_cargue' || c.clave === 'fecha_registro') {
            return fmtFecha(v as string | null)
          }
          return v ?? ''
        }).concat([f.cantidades_validas ? 'sí' : 'no', (f.advertencias ?? []).join(' | ')])
      )
      descargarTexto(`tfq-detalle-${hoyISO()}.csv`, generarCSV(encabezados, cuerpo))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExportando(null)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA))

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Detalle de registros</h2>
        <div className="nota-estado">Solo eventos válidos de lotes confirmados (sin plantillas, duplicados ni anulados).</div>
      </div>

      <BarraFiltros />

      <section className="panel">
        <div className="fila-acciones">
          <form
            className="buscador"
            onSubmit={(e) => {
              e.preventDefault()
              setBusquedaAplicada(busqueda)
            }}
          >
            <input
              type="search"
              placeholder="Buscar bandeja, código o nombre…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button type="submit" className="boton boton-secundario">
              Buscar
            </button>
          </form>
          <div className="fila-acciones-derecha">
            <span className="nota-pie">{fmtEnt(total)} registros filtrados</span>
            <button type="button" className="boton boton-primario" onClick={() => void exportar()} disabled={exportando !== null}>
              Exportar CSV (todo lo filtrado)
            </button>
          </div>
        </div>

        {exportando ? <BarraProgreso hechas={exportando.hechas} total={exportando.total} texto="Exportando" /> : null}
        {cargando ? <Cargando /> : null}
        {error ? <CajaError texto={error} reintentar={() => setVersion((v) => v + 1)} /> : null}

        {!cargando && !error && filas ? (
          filas.length === 0 ? (
            <SinDatos />
          ) : (
            <>
              <div className="tabla-envoltura">
                <table className="tabla tabla-compacta">
                  <thead>
                    <tr>
                      {COLUMNAS_DETALLE.map((c) => (
                        <th key={c.clave}>{c.titulo}</th>
                      ))}
                      <th>Avisos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.id}>
                        {COLUMNAS_DETALLE.map((c) => {
                          const v = f[c.clave]
                          let texto: string
                          if (v === null || v === undefined) texto = ''
                          else if (c.clave.startsWith('fecha')) texto = fmtFecha(String(v))
                          else texto = String(v)
                          return (
                            <td key={c.clave} className={typeof v === 'number' ? 'num' : undefined}>
                              {texto}
                            </td>
                          )
                        })}
                        <td>
                          {f.repeticion_confirmada ? <Insignia texto="repetición confirmada" tono="neutro" /> : null}
                          {(f.advertencias ?? []).length > 0 ? (
                            <span title={(f.advertencias ?? []).join('\n')}>
                              <Insignia texto={`${(f.advertencias ?? []).length} avisos`} tono="aviso" />
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="paginacion">
                <button
                  type="button"
                  className="boton boton-secundario"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                >
                  ← Anterior
                </button>
                <span>
                  Página {pagina + 1} de {fmtEnt(totalPaginas)}
                </span>
                <button
                  type="button"
                  className="boton boton-secundario"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
            </>
          )
        ) : null}
      </section>
    </div>
  )
}
