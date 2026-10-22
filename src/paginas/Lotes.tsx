// Centro de importaciones y calidad de datos:
//  - historial de lotes con anulación trazable,
//  - conflictos pendientes con comparación lado a lado,
//  - inconsistencias código/nombre y advertencias agregadas.

import { useEffect, useState } from 'react'
import { CajaError, Cargando, Insignia, Modal, SinDatos } from '../componentes/ui'
import { useAuth } from '../auth/AuthContext'
import {
  anularLote,
  descartarLotePendiente,
  listarConflictos,
  listarLotes,
  obtenerCalidad,
  resolverConflicto,
  type DecisionConflicto
} from '../datos/consultas'
import { fmtEnt, fmtFechaHora } from '../lib/formato'
import type { Calidad, ConflictoPar, LoteInfo } from '../lib/tipos'

type Pestana = 'lotes' | 'conflictos' | 'calidad'

const ETIQUETA_ESTADO: Record<string, { texto: string; tono: 'ok' | 'aviso' | 'error' | 'neutro' }> = {
  confirmado: { texto: 'Confirmado', tono: 'ok' },
  pendiente: { texto: 'Pendiente (no cuenta en indicadores)', tono: 'aviso' },
  anulado: { texto: 'Anulado', tono: 'error' },
  descartado: { texto: 'Descartado', tono: 'neutro' }
}

const CAMPOS_COMPARACION: { clave: string; titulo: string }[] = [
  { clave: 'fecha_produccion', titulo: 'Fecha producción' },
  { clave: 'numero_produccion', titulo: 'N° producción' },
  { clave: 'tanque', titulo: 'Tanque' },
  { clave: 'posicion', titulo: 'Posición' },
  { clave: 'numero_bandeja', titulo: 'N° bandeja' },
  { clave: 'liquido', titulo: 'Líquido' },
  { clave: 'finca', titulo: 'Finca' },
  { clave: 'variedad', titulo: 'Variedad' },
  { clave: 'codigo_pasmador', titulo: 'Cód. pasmador' },
  { clave: 'nombre_pasmador', titulo: 'Pasmador' },
  { clave: 'codigo_ensamblador', titulo: 'Cód. ensamblador' },
  { clave: 'nombre_ensamblador', titulo: 'Ensamblador' },
  { clave: 'cabezas_conformes', titulo: 'Conformes' },
  { clave: 'cabezas_no_conformes', titulo: 'No conformes' },
  { clave: 'total_cabezas', titulo: 'Total cabezas' },
  { clave: 'fecha_registro', titulo: 'FECHA (registro)' },
  { clave: 'marca_registro', titulo: 'Marca hora' },
  { clave: 'tipo_bandeja', titulo: 'Tipo bandeja' },
  { clave: 'ocupacion', titulo: 'Ocupación' }
]

export function Lotes() {
  const { puedeImportar } = useAuth()
  const [pestana, setPestana] = useState<Pestana>('lotes')
  const [lotes, setLotes] = useState<LoteInfo[] | null>(null)
  const [conflictos, setConflictos] = useState<ConflictoPar[] | null>(null)
  const [calidad, setCalidad] = useState<Calidad | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)
  const [anulando, setAnulando] = useState<LoteInfo | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    Promise.all([listarLotes(), listarConflictos(), obtenerCalidad()])
      .then(([l, c, q]) => {
        if (!activo) return
        setLotes(l)
        setConflictos(c)
        setCalidad(q)
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
  }, [version])

  async function ejecutarAnulacion() {
    if (!anulando || motivo.trim().length < 5) return
    setOcupado(true)
    try {
      await anularLote(anulando.id, motivo.trim())
      setAnulando(null)
      setMotivo('')
      setVersion((v) => v + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function descartar(lote: LoteInfo) {
    setOcupado(true)
    try {
      await descartarLotePendiente(lote.id)
      setVersion((v) => v + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function decidir(c: ConflictoPar, decision: DecisionConflicto) {
    const textos: Record<DecisionConflicto, string> = {
      mantener_existente: '¿Mantener el registro existente y descartar el nuevo?',
      aplicar_nuevo: '¿Aplicar el nuevo contenido como corrección? El valor anterior queda guardado en el historial.',
      evento_independiente: '¿Confirmar que son DOS eventos reales distintos? Ambos contarán en los indicadores.'
    }
    if (!window.confirm(textos[decision])) return
    setOcupado(true)
    try {
      await resolverConflicto(c.conflicto.id, decision, textos[decision])
      setVersion((v) => v + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const numConflictos = conflictos?.length ?? 0

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Importaciones y calidad de datos</h2>
      </div>

      <div className="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'lotes'} className={pestana === 'lotes' ? 'activa' : ''} onClick={() => setPestana('lotes')}>
          Lotes de importación
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'conflictos'} className={pestana === 'conflictos' ? 'activa' : ''} onClick={() => setPestana('conflictos')}>
          Conflictos pendientes {numConflictos > 0 ? `(${numConflictos})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'calidad'} className={pestana === 'calidad' ? 'activa' : ''} onClick={() => setPestana('calidad')}>
          Calidad de datos
        </button>
      </div>

      {cargando ? <Cargando /> : null}
      {error ? <CajaError texto={error} reintentar={() => setVersion((v) => v + 1)} /> : null}

      {!cargando && !error && pestana === 'lotes' && lotes ? (
        lotes.length === 0 ? (
          <SinDatos texto="Aún no hay importaciones." />
        ) : (
          <section className="panel">
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Origen</th>
                    <th>Estado</th>
                    <th className="num">Recibidas</th>
                    <th className="num">Nuevas</th>
                    <th className="num">Duplicadas</th>
                    <th className="num">Conflictos</th>
                    <th className="num">Rechazadas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((l) => {
                    const est = ETIQUETA_ESTADO[l.estado] ?? { texto: l.estado, tono: 'neutro' as const }
                    return (
                      <tr key={l.id}>
                        <td>{fmtFechaHora(l.creado_en)}</td>
                        <td>{l.creador ?? '—'}</td>
                        <td>
                          {l.origen === 'archivo' ? `Archivo: ${l.nombre_origen ?? ''}` : l.origen === 'horas' ? 'Horas-persona' : 'Pegado'}
                        </td>
                        <td>
                          <Insignia texto={est.texto} tono={est.tono} />
                          {l.motivo_anulacion ? <div className="nota-pie">Motivo: {l.motivo_anulacion}</div> : null}
                        </td>
                        <td className="num">{fmtEnt(l.filas_recibidas)}</td>
                        <td className="num">{fmtEnt(l.nuevas)}</td>
                        <td className="num">{fmtEnt(l.duplicadas)}</td>
                        <td className="num">{fmtEnt(l.conflictos)}</td>
                        <td className="num">{fmtEnt(l.rechazadas_cliente)}</td>
                        <td>
                          {puedeImportar && l.estado === 'confirmado' ? (
                            <button type="button" className="boton boton-peligro" onClick={() => setAnulando(l)} disabled={ocupado}>
                              Anular
                            </button>
                          ) : null}
                          {puedeImportar && l.estado === 'pendiente' ? (
                            <button type="button" className="boton boton-secundario" onClick={() => void descartar(l)} disabled={ocupado}>
                              Descartar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="nota-pie">
              Anular un lote excluye SOLO los eventos que ese lote insertó y revierte sus correcciones, con registro de
              quién y por qué. Nunca borra datos aportados por otros lotes.
            </p>
          </section>
        )
      ) : null}

      {!cargando && !error && pestana === 'conflictos' && conflictos ? (
        conflictos.length === 0 ? (
          <SinDatos texto="No hay conflictos pendientes. Todo lo importado es nuevo o idéntico a lo existente." />
        ) : (
          <section>
            <p className="nota-pie panel">
              Un conflicto significa: llegó una fila con la MISMA identidad (fecha de producción + n° producción +
              tanque + posición + n° bandeja) pero contenido distinto. Nada se sobrescribe sin su decisión; el valor
              anterior siempre queda en el historial de revisiones.
            </p>
            {conflictos.map((c) => (
              <section className="panel conflicto" key={c.conflicto.id}>
                <h3>
                  Conflicto #{c.conflicto.id} · diferencias en: {c.diferencias.join(', ') || 'contenido crudo'}
                </h3>
                <div className="tabla-envoltura">
                  <table className="tabla tabla-compacta">
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Registro existente</th>
                        <th>Registro nuevo (en conflicto)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CAMPOS_COMPARACION.map((campo) => {
                        const a = c.activo?.n?.[campo.clave]
                        const b = c.conflicto.n?.[campo.clave]
                        const difiere = String(a ?? '') !== String(b ?? '')
                        return (
                          <tr key={campo.clave} className={difiere ? 'fila-diferente' : ''}>
                            <td>{campo.titulo}</td>
                            <td>{a === null || a === undefined ? '—' : String(a)}</td>
                            <td>{b === null || b === undefined ? '—' : String(b)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {puedeImportar ? (
                  <div className="fila-acciones">
                    <button type="button" className="boton boton-secundario" onClick={() => void decidir(c, 'mantener_existente')} disabled={ocupado}>
                      Mantener existente
                    </button>
                    <button type="button" className="boton boton-primario" onClick={() => void decidir(c, 'aplicar_nuevo')} disabled={ocupado}>
                      Aplicar nuevo como corrección
                    </button>
                    <button type="button" className="boton boton-secundario" onClick={() => void decidir(c, 'evento_independiente')} disabled={ocupado}>
                      Son dos eventos reales
                    </button>
                  </div>
                ) : (
                  <p className="nota-pie">Solo un analista o administrador puede resolver conflictos.</p>
                )}
              </section>
            ))}
          </section>
        )
      ) : null}

      {!cargando && !error && pestana === 'calidad' && calidad ? (
        <section className="panel">
          <h3>Calidad de los datos activos</h3>
          <ul className="lista-resultado">
            <li>
              <strong>{fmtEnt(calidad.eventos_activos)}</strong> eventos activos en total
            </li>
            <li>
              <strong>{fmtEnt(calidad.cantidades_invalidas)}</strong> con cantidades incompletas o inconsistentes
              (excluidos de las sumas de cabezas, visibles en el detalle)
            </li>
            <li>
              <strong>{fmtEnt(calidad.sin_bandeja)}</strong> sin n° de bandeja (cuentan como eventos, no como bandejas
              físicas)
            </li>
          </ul>

          <h3>Advertencias detectadas al importar</h3>
          {calidad.advertencias.length === 0 ? (
            <SinDatos texto="Sin advertencias registradas." />
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Advertencia</th>
                    <th className="num">Filas</th>
                  </tr>
                </thead>
                <tbody>
                  {calidad.advertencias.map((a) => (
                    <tr key={a.advertencia}>
                      <td>{a.advertencia}</td>
                      <td className="num">{fmtEnt(a.filas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3>Códigos con más de un nombre (requieren revisión del responsable)</h3>
          {calidad.inconsistencias.length === 0 ? (
            <SinDatos texto="Sin inconsistencias código/nombre." />
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Código</th>
                    <th>Nombres encontrados (filas)</th>
                  </tr>
                </thead>
                <tbody>
                  {calidad.inconsistencias.map((i) => (
                    <tr key={i.rol + i.codigo}>
                      <td>{i.rol}</td>
                      <td>{i.codigo}</td>
                      <td>{i.nombres.map((n) => `${n.nombre || '(vacío)'} (${fmtEnt(n.filas)})`).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="nota-pie">
            Las filas se agrupan SOLO por código normalizado; los nombres nunca se fusionan automáticamente. El nombre
            oficial se fija en Configuración → Catálogo de operarios.
          </p>
        </section>
      ) : null}

      <Modal titulo="Anular lote de importación" abierto={anulando !== null} cerrar={() => setAnulando(null)}>
        <p>
          Se excluirán los <strong>{fmtEnt(anulando?.nuevas ?? 0)}</strong> eventos insertados por este lote y se
          revertirán sus correcciones. La operación queda registrada con su usuario y motivo.
        </p>
        <label className="campo-formulario">
          Motivo (obligatorio, mínimo 5 caracteres)
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <div className="fila-acciones">
          <button type="button" className="boton boton-secundario" onClick={() => setAnulando(null)}>
            Cancelar
          </button>
          <div className="fila-acciones-derecha">
            <button type="button" className="boton boton-peligro" onClick={() => void ejecutarAnulacion()} disabled={motivo.trim().length < 5 || ocupado}>
              Anular lote
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
