// Comparativos por operario: volumen, calidad y productividad
// (esta última solo cuando hay horas-persona válidas).
// Se distingue ranking de volumen de ranking de productividad.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraFiltros } from '../componentes/BarraFiltros'
import { GraficaBarrasOperarios } from '../componentes/Graficas'
import { AvisoBloqueado, CajaError, Cargando, Insignia, SinDatos } from '../componentes/ui'
import { obtenerPorOperario, obtenerProductividad, obtenerVentana } from '../datos/consultas'
import { useFiltros } from '../datos/filtros'
import { fmtEnt, fmtFecha, fmtNum, fmtPct } from '../lib/formato'
import type { FilaOperario, Productividad, Ventana } from '../lib/tipos'

export function Comparativos() {
  const { filtros } = useFiltros()
  const [filas, setFilas] = useState<FilaOperario[] | null>(null)
  const [productividad, setProductividad] = useState<Productividad | null>(null)
  const [ventana, setVentana] = useState<Ventana | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    Promise.all([obtenerPorOperario(filtros), obtenerProductividad(filtros), obtenerVentana(filtros)])
      .then(([f, p, v]) => {
        if (!activo) return
        setFilas(f)
        setProductividad(p)
        setVentana(v)
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
  }, [filtros, version])

  const rolTexto = filtros.rolOperario === 'pasmador' ? 'pasmador' : 'ensamblador'

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Comparativos por operario ({rolTexto})</h2>
        <div className="nota-estado">
          La atribución es por rol: una misma bandeja aparece una sola vez; aquí se atribuye a su {rolTexto}. Las
          diferencias son señales para investigar en condiciones semejantes (variedad, tipo de bandeja), no prueban por
          sí solas bajo desempeño.
        </div>
      </div>

      <BarraFiltros />

      {cargando ? <Cargando /> : null}
      {error ? <CajaError texto={error} reintentar={() => setVersion((v) => v + 1)} /> : null}

      {!cargando && !error && filas ? (
        filas.length === 0 ? (
          <SinDatos />
        ) : (
          <>
            <section className="panel">
              <h3>Ranking de volumen (bandejas)</h3>
              <GraficaBarrasOperarios
                datos={filas.slice(0, 20).map((f) => ({
                  etiqueta: `${f.codigo}${f.nombre_oficial ? ' · ' + f.nombre_oficial : ''}`,
                  valor: f.bandejas
                }))}
                nombreSerie="Bandejas"
              />
            </section>

            <section className="panel">
              <h3>Volumen y calidad por operario</h3>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th className="num">Bandejas</th>
                      <th className="num">Cabezas</th>
                      <th className="num">Conformes</th>
                      <th className="num">No conformes</th>
                      <th className="num">% conformidad</th>
                      <th className="num">Días con producción (muestra)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.codigo}>
                        <td>{f.codigo}</td>
                        <td>
                          {f.nombre_oficial ? (
                            f.nombre_oficial
                          ) : (
                            <>
                              {f.nombres.slice(0, 2).join(' / ') || '(sin nombre)'}{' '}
                              {f.nombres.length > 1 ? (
                                <Insignia texto={`${f.nombres.length} nombres — revisar`} tono="aviso" />
                              ) : (
                                <Insignia texto="sin confirmar" tono="neutro" />
                              )}
                            </>
                          )}
                        </td>
                        <td className="num">{fmtEnt(f.bandejas)}</td>
                        <td className="num">{fmtEnt(f.cabezas)}</td>
                        <td className="num">{fmtEnt(f.conformes)}</td>
                        <td className="num">{fmtEnt(f.no_conformes)}</td>
                        <td className="num">{fmtPct(f.pct_conformidad)}</td>
                        <td className="num">{fmtEnt(f.dias)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="nota-pie">
                Los nombres sin confirmar se muestran tal como vienen del Excel; el responsable puede fijar el nombre
                oficial de cada código en <Link to="/configuracion">Configuración</Link>. Los códigos con varios
                nombres también aparecen en <Link to="/lotes">Importaciones y calidad</Link>.
              </p>
            </section>

            <SeccionProductividad productividad={productividad} />
            <SeccionVentana ventana={ventana} />
          </>
        )
      ) : null}
    </div>
  )
}

function SeccionProductividad({ productividad }: { productividad: Productividad | null }) {
  if (!productividad) return null
  if (!productividad.disponible) {
    return (
      <AvisoBloqueado titulo="Ranking de productividad: no calculable con los datos actuales">
        {productividad.motivo ?? 'No hay horas-persona válidas para el periodo y rol filtrados.'} El volumen de arriba
        sigue siendo válido. Un analista puede incorporar una fuente existente y validada de horas en{' '}
        <Link to="/configuracion">Configuración → Horas-persona</Link>; no se exige ninguna bitácora nueva a los
        operarios.
      </AvisoBloqueado>
    )
  }
  const g = productividad.general
  return (
    <section className="panel">
      <h3>Ranking de productividad laboral (bandejas por hora-persona)</h3>
      <p className="nota-pie">
        Solo incluye operarios y días con horas-persona registradas. Productividad general ={' '}
        <strong>suma de producción elegible ÷ suma de horas elegibles</strong> (no promedio de tasas individuales).
        {productividad.exclusiones
          ? ` Producción excluida por falta de horas: ${fmtEnt(productividad.exclusiones.eventos_sin_horas)} eventos.`
          : ''}
      </p>
      {g ? (
        <p>
          <strong>General:</strong> {fmtNum(g.bandejas_hora)} bandejas/h-persona · {fmtNum(g.cabezas_hora)} cabezas/h-persona
          ({fmtEnt(g.bandejas)} bandejas ÷ {fmtNum(g.horas, 1)} horas)
        </p>
      ) : null}
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th className="num">Bandejas elegibles</th>
              <th className="num">Horas</th>
              <th className="num">Bandejas/hora</th>
              <th className="num">Cabezas/hora</th>
            </tr>
          </thead>
          <tbody>
            {productividad.operarios.map((o) => (
              <tr key={o.codigo}>
                <td>{o.codigo}</td>
                <td>{o.nombre ?? '—'}</td>
                <td className="num">{fmtEnt(o.bandejas)}</td>
                <td className="num">{fmtNum(o.horas, 1)}</td>
                <td className="num">{fmtNum(o.bandejas_hora)}</td>
                <td className="num">{fmtNum(o.cabezas_hora)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SeccionVentana({ ventana }: { ventana: Ventana | null }) {
  if (!ventana) return null
  if (!ventana.disponible) {
    return (
      <AvisoBloqueado titulo="Ventana observada entre registros: no disponible">
        {ventana.motivo ?? 'Requiere que el responsable confirme a qué etapa pertenece la marca horaria del Excel.'}
      </AvisoBloqueado>
    )
  }
  return (
    <section className="panel">
      <h3>Ventana observada entre registros</h3>
      <p className="nota-pie">
        Primera y última marca de registro del día por operario. <strong>No es tiempo trabajado</strong>: no considera
        pausas, asistencia ni inicio/fin reales; es solo el rango entre marcas registradas.
      </p>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th className="num">Primera marca</th>
              <th className="num">Última marca</th>
              <th className="num">Marcas</th>
            </tr>
          </thead>
          <tbody>
            {ventana.filas.map((v, i) => (
              <tr key={i}>
                <td>{v.codigo}</td>
                <td>{fmtFecha(v.fecha)}</td>
                <td className="num">{v.primera}</td>
                <td className="num">{v.ultima}</td>
                <td className="num">{fmtEnt(v.marcas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
