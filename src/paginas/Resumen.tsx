// Resumen ejecutivo: tarjetas, evolución diaria y cobertura de datos.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraFiltros } from '../componentes/BarraFiltros'
import { GraficaCabezasDiaria, GraficaEvolucionDiaria } from '../componentes/Graficas'
import { AvisoBloqueado, CajaError, Cargando, SinDatos, Tarjeta } from '../componentes/ui'
import { obtenerEstadoDatos, obtenerPorDia, obtenerProductividad, obtenerResumen } from '../datos/consultas'
import { useFiltros } from '../datos/filtros'
import { fmtEnt, fmtFechaHora, fmtNum, fmtPct } from '../lib/formato'
import type { EstadoDatos, Productividad, PuntoDia, ResumenAgregado } from '../lib/tipos'

export function Resumen() {
  const { filtros } = useFiltros()
  const [resumen, setResumen] = useState<ResumenAgregado | null>(null)
  const [porDia, setPorDia] = useState<PuntoDia[] | null>(null)
  const [productividad, setProductividad] = useState<Productividad | null>(null)
  const [estado, setEstado] = useState<EstadoDatos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    Promise.all([obtenerResumen(filtros), obtenerPorDia(filtros), obtenerProductividad(filtros), obtenerEstadoDatos()])
      .then(([r, d, p, e]) => {
        if (!activo) return
        setResumen(r)
        setPorDia(d)
        setProductividad(p)
        setEstado(e)
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

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Resumen ejecutivo</h2>
        {estado?.ultima_importacion ? (
          <div className="nota-estado">
            Última importación: {fmtFechaHora(estado.ultima_importacion.creado_en)} ·{' '}
            {fmtEnt(estado.ultima_importacion.nuevas)} filas nuevas
            {estado.ultima_importacion.correo ? ` · ${estado.ultima_importacion.correo}` : ''}
            {estado.conflictos_pendientes > 0 ? (
              <>
                {' '}
                · <Link to="/lotes">⚠ {fmtEnt(estado.conflictos_pendientes)} conflictos por resolver</Link>
              </>
            ) : null}
          </div>
        ) : (
          <div className="nota-estado">Aún no hay importaciones confirmadas.</div>
        )}
      </div>

      <BarraFiltros />

      {cargando ? <Cargando texto="Calculando indicadores sobre todos los registros filtrados…" /> : null}
      {error ? <CajaError texto={error} reintentar={() => setVersion((v) => v + 1)} /> : null}

      {!cargando && !error && resumen ? (
        <>
          <section className="rejilla-tarjetas">
            <Tarjeta
              titulo="Bandejas procesadas (eventos)"
              valor={fmtEnt(resumen.bandejas)}
              detalle={`${fmtEnt(resumen.bandejas_fisicas)} identificadores físicos distintos · ${fmtEnt(resumen.eventos_sin_bandeja)} eventos sin n° de bandeja`}
            />
            <Tarjeta
              titulo="Cabezas (solo filas con cantidades válidas)"
              valor={fmtEnt(resumen.cabezas)}
              detalle={`${fmtEnt(resumen.conformes)} conformes · ${fmtEnt(resumen.no_conformes)} no conformes`}
            />
            <Tarjeta titulo="% de conformidad" valor={fmtPct(resumen.pct_conformidad)} detalle="conformes / total × 100" />
            <Tarjeta
              titulo="Cobertura"
              valor={`${fmtEnt(resumen.dias)} días`}
              detalle={`${fmtEnt(resumen.operarios)} operarios del rol filtrado con producción`}
            />
          </section>

          <section className="rejilla-tarjetas">
            <Tarjeta
              titulo="Excluidos por fecha"
              tono={resumen.exclusiones.sin_fecha > 0 ? 'alerta' : 'normal'}
              valor={fmtEnt(resumen.exclusiones.sin_fecha)}
              detalle="eventos sin la fecha del tipo seleccionado (cambie el tipo de fecha para verlos)"
            />
            <Tarjeta
              titulo="Excluidos de cabezas"
              tono={resumen.exclusiones.cantidades_invalidas > 0 ? 'alerta' : 'normal'}
              valor={fmtEnt(resumen.exclusiones.cantidades_invalidas)}
              detalle="eventos con cantidades incompletas o inconsistentes (cuentan como bandejas, no en cabezas)"
            />
            <TarjetaProductividad productividad={productividad} />
          </section>

          {resumen.bandejas === 0 ? (
            <SinDatos />
          ) : (
            <>
              <section className="panel">
                <h3>Bandejas por día</h3>
                {porDia && porDia.length > 0 ? <GraficaEvolucionDiaria datos={porDia} /> : <SinDatos />}
              </section>
              <section className="panel">
                <h3>Cabezas conformes y no conformes por día</h3>
                {porDia && porDia.length > 0 ? <GraficaCabezasDiaria datos={porDia} /> : <SinDatos />}
              </section>
            </>
          )}

          {!estado?.etapa_marca.confirmada ? (
            <AvisoBloqueado titulo="Indicadores horarios y por turno: no disponibles todavía">
              Las columnas FECHA/HORA/TIEMPO del Excel son una marca de registro cuya etapa no está confirmada por el
              responsable del proceso (hay filas con HORA=0 y TIEMPO=20:35, señal de fórmula arrastrada). Mientras
              tanto, los volúmenes siguen disponibles con las fechas de producción y de cargue. Un administrador puede
              registrar la confirmación en <Link to="/configuracion">Configuración</Link>.
            </AvisoBloqueado>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function TarjetaProductividad({ productividad }: { productividad: Productividad | null }) {
  if (!productividad || !productividad.disponible || !productividad.general) {
    return (
      <Tarjeta
        titulo="Productividad laboral (bandejas/hora-persona)"
        valor="No calculable con los datos actuales"
        detalle={productividad?.motivo ?? 'Requiere horas-persona validadas (Configuración → Horas-persona).'}
        tono="alerta"
      />
    )
  }
  const g = productividad.general
  return (
    <Tarjeta
      titulo="Productividad laboral general"
      valor={`${fmtNum(g.bandejas_hora)} bandejas/h-persona`}
      detalle={`${fmtEnt(g.bandejas)} bandejas elegibles ÷ ${fmtNum(g.horas, 1)} horas · ${fmtNum(g.cabezas_hora)} cabezas/h`}
    />
  )
}
