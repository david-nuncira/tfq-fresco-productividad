// Configuración mínima para responsables:
//  - catálogo de operarios (nombre oficial por código y rol),
//  - confirmación de la etapa de la marca horaria (admin),
//  - turnos (admin; sin horarios inventados),
//  - carga de horas-persona validadas (analista/admin),
//  - metas: explícitamente sin inventar semáforos.

import { useEffect, useState } from 'react'
import { CajaError, Cargando, Insignia, SinDatos } from '../componentes/ui'
import { useAuth } from '../auth/AuthContext'
import {
  guardarConfig,
  guardarOperario,
  importarHoras,
  listarOperariosCatalogo,
  obtenerCalidad,
  obtenerOpciones,
  type FilaHoras
} from '../datos/consultas'
import { useFiltros } from '../datos/filtros'
import { fechaISO } from '../importador/parser'
import { fmtEnt } from '../lib/formato'
import type { Calidad, OpcionesFiltros, OperarioCatalogo, RolOperario, Turno } from '../lib/tipos'

export function Configuracion() {
  const { puedeImportar, esAdmin } = useAuth()
  const { recargarOpciones } = useFiltros()
  const [opciones, setOpciones] = useState<OpcionesFiltros | null>(null)
  const [calidad, setCalidad] = useState<Calidad | null>(null)
  const [catalogo, setCatalogo] = useState<OperarioCatalogo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    Promise.all([obtenerOpciones(), obtenerCalidad(), listarOperariosCatalogo()])
      .then(([o, q, c]) => {
        if (!activo) return
        setOpciones(o)
        setCalidad(q)
        setCatalogo(c)
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

  function refrescar(msg: string) {
    setMensaje(msg)
    setVersion((v) => v + 1)
    recargarOpciones()
  }

  if (!puedeImportar && !esAdmin) {
    return (
      <div className="panel">
        <h2>Configuración</h2>
        <p>Esta sección es para analistas y administradores.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Configuración</h2>
      </div>
      {cargando ? <Cargando /> : null}
      {error ? <CajaError texto={error} reintentar={() => setVersion((v) => v + 1)} /> : null}
      {mensaje ? <div className="estado-caja estado-ok">{mensaje}</div> : null}

      {!cargando && !error ? (
        <>
          <SeccionEtapaMarca opciones={opciones} esAdmin={esAdmin} alGuardar={() => refrescar('Configuración de la marca horaria guardada.')} />
          <SeccionTurnos opciones={opciones} esAdmin={esAdmin} alGuardar={() => refrescar('Turnos guardados.')} />
          <SeccionHoras alGuardar={(msg) => refrescar(msg)} />
          <SeccionCatalogo
            calidad={calidad}
            catalogo={catalogo}
            alGuardar={() => refrescar('Operario guardado en el catálogo.')}
          />
          <section className="panel">
            <h3>Metas y semáforos</h3>
            <p className="nota-pie">
              No existen metas aprobadas por el área, por lo que esta aplicación no muestra semáforos de cumplimiento.
              Cuando Logística apruebe metas (por rol, variedad o tipo de bandeja), podrán configurarse aquí en una fase
              posterior.
            </p>
          </section>
        </>
      ) : null}
    </div>
  )
}

function SeccionEtapaMarca({
  opciones,
  esAdmin,
  alGuardar
}: {
  opciones: OpcionesFiltros | null
  esAdmin: boolean
  alGuardar: () => void
}) {
  const etapa = opciones?.etapa_marca ?? { confirmada: false, etapa: null, nota: null }
  const [confirmada, setConfirmada] = useState(etapa.confirmada)
  const [etapaTexto, setEtapaTexto] = useState(etapa.etapa ?? '')
  const [nota, setNota] = useState(etapa.nota ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  useEffect(() => {
    setConfirmada(etapa.confirmada)
    setEtapaTexto(etapa.etapa ?? '')
    setNota(etapa.nota ?? '')
  }, [etapa.confirmada, etapa.etapa, etapa.nota])

  async function guardar() {
    setOcupado(true)
    setErrorLocal(null)
    try {
      await guardarConfig('etapa_marca', {
        confirmada,
        etapa: etapaTexto.trim() || null,
        nota: nota.trim() || null
      })
      alGuardar()
    } catch (e) {
      setErrorLocal((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="panel">
      <h3>Marca horaria del Excel (columnas FECHA / HORA / TIEMPO)</h3>
      <p className="nota-pie">
        Estado actual: {etapa.confirmada ? <Insignia texto={`Confirmada: ${etapa.etapa ?? ''}`} tono="ok" /> : <Insignia texto="Sin confirmar" tono="aviso" />}
        {' '}Mientras no esté confirmada por el responsable del proceso, la app bloquea los indicadores por hora y por
        turno (el análisis encontró marcas arrastradas, p. ej. HORA=0 con TIEMPO=20:35). Esto NO impide los volúmenes.
      </p>
      {esAdmin ? (
        <>
          <label className="campo-formulario campo-linea">
            <input type="checkbox" checked={confirmada} onChange={(e) => setConfirmada(e.target.checked)} />
            El responsable del proceso confirmó a qué etapa pertenece la marca
          </label>
          <label className="campo-formulario">
            Etapa confirmada (ej.: «digitación del ensamble», «fin del pasmado»)
            <input type="text" value={etapaTexto} onChange={(e) => setEtapaTexto(e.target.value)} disabled={!confirmada} />
          </label>
          <label className="campo-formulario">
            Quién confirmó y cuándo (nota de trazabilidad)
            <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} />
          </label>
          {errorLocal ? <CajaError texto={errorLocal} /> : null}
          <button type="button" className="boton boton-primario" onClick={() => void guardar()} disabled={ocupado || (confirmada && etapaTexto.trim() === '')}>
            Guardar
          </button>
        </>
      ) : (
        <p className="nota-pie">Solo el administrador puede registrar esta confirmación.</p>
      )}
    </section>
  )
}

function SeccionTurnos({
  opciones,
  esAdmin,
  alGuardar
}: {
  opciones: OpcionesFiltros | null
  esAdmin: boolean
  alGuardar: () => void
}) {
  const [lista, setLista] = useState<Turno[]>(opciones?.turnos.lista ?? [])
  const [ocupado, setOcupado] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  useEffect(() => {
    setLista(opciones?.turnos.lista ?? [])
  }, [opciones])

  function cambiar(i: number, campo: keyof Turno, valor: string) {
    setLista((l) => l.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)))
  }

  async function guardar() {
    setOcupado(true)
    setErrorLocal(null)
    try {
      const limpia = lista.filter((t) => t.nombre.trim() !== '' && /^\d{2}:\d{2}$/.test(t.inicio) && /^\d{2}:\d{2}$/.test(t.fin))
      await guardarConfig('turnos', { definidos: limpia.length > 0, lista: limpia })
      alGuardar()
    } catch (e) {
      setErrorLocal((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="panel">
      <h3>Turnos (zona horaria America/Bogota)</h3>
      <p className="nota-pie">
        La aplicación NO asume horarios: regístrelos solo con la definición oficial del área. Un turno cuyo fin es menor
        que su inicio cruza la medianoche y se asigna a la fecha operativa del día en que inicia. La asignación de
        eventos a turnos solo se activa cuando además la marca horaria esté confirmada.
      </p>
      {esAdmin ? (
        <>
          {lista.map((t, i) => (
            <div className="fila-turno" key={i}>
              <input type="text" placeholder="Nombre (ej. Turno día)" value={t.nombre} onChange={(e) => cambiar(i, 'nombre', e.target.value)} />
              <input type="time" value={t.inicio} onChange={(e) => cambiar(i, 'inicio', e.target.value)} />
              <input type="time" value={t.fin} onChange={(e) => cambiar(i, 'fin', e.target.value)} />
              <button type="button" className="boton boton-secundario" onClick={() => setLista((l) => l.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </div>
          ))}
          <div className="fila-acciones">
            <button type="button" className="boton boton-secundario" onClick={() => setLista((l) => [...l, { nombre: '', inicio: '06:00', fin: '14:00' }])}>
              Agregar turno
            </button>
            <div className="fila-acciones-derecha">
              <button type="button" className="boton boton-primario" onClick={() => void guardar()} disabled={ocupado}>
                Guardar turnos
              </button>
            </div>
          </div>
          {errorLocal ? <CajaError texto={errorLocal} /> : null}
        </>
      ) : (
        <p className="nota-pie">Solo el administrador puede definir turnos.</p>
      )}
    </section>
  )
}

function SeccionHoras({ alGuardar }: { alGuardar: (msg: string) => void }) {
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<string | null>(null)

  async function cargar() {
    setOcupado(true)
    setErrorLocal(null)
    setDetalle(null)
    try {
      const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
      const filas: FilaHoras[] = []
      const errores: string[] = []
      lineas.forEach((linea, i) => {
        const celdas = linea.split(/\t|;/).map((c) => c.trim())
        if (i === 0 && /fecha/i.test(celdas[0] ?? '')) return // encabezado opcional
        const [f, codigo, rol, horasTxt] = celdas
        const iso = f ? fechaISO(f) : null
        const horas = Number((horasTxt ?? '').replace(',', '.'))
        const rolNorm = (rol ?? '').trim().toLowerCase()
        if (!iso) errores.push(`Línea ${i + 1}: fecha inválida (use dd/mm/aaaa)`)
        else if (!codigo) errores.push(`Línea ${i + 1}: falta el código`)
        else if (rolNorm !== 'pasmador' && rolNorm !== 'ensamblador') errores.push(`Línea ${i + 1}: rol debe ser pasmador o ensamblador`)
        else if (!Number.isFinite(horas) || horas <= 0 || horas > 24) errores.push(`Línea ${i + 1}: horas inválidas`)
        else filas.push({ fecha: iso, codigo: codigo.toUpperCase(), rol: rolNorm as RolOperario, horas })
      })
      if (errores.length > 0) {
        setErrorLocal(errores.slice(0, 8).join(' · ') + (errores.length > 8 ? ` · y ${errores.length - 8} más` : ''))
        return
      }
      if (filas.length === 0) {
        setErrorLocal('No se encontraron filas válidas.')
        return
      }
      if (nota.trim().length < 5) {
        setErrorLocal('Indique la fuente de las horas (nota obligatoria): debe ser una fuente existente y validada.')
        return
      }
      const r = await importarHoras(filas, nota.trim())
      setTexto('')
      setDetalle(null)
      alGuardar(
        `Horas-persona cargadas: ${fmtEnt(r.insertadas)} nuevas, ${fmtEnt(r.actualizadas)} actualizadas (el valor anterior quedó en el historial).`
      )
    } catch (e) {
      setErrorLocal((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="panel">
      <h3>Horas-persona validadas (para productividad laboral)</h3>
      <p className="nota-pie">
        Pegue líneas con: <code>fecha (dd/mm/aaaa) ; código ; rol (pasmador/ensamblador) ; horas netas</code> — separadas
        por tabulación o punto y coma. Debe provenir de una fuente existente y validada (nómina, jornadas aprobadas); no
        se exige a los operarios ningún registro nuevo. Sin estas horas, la productividad se muestra como «No calculable».
      </p>
      <textarea
        className="area-pegado area-pegado-corta"
        rows={5}
        placeholder={'fecha\tcodigo\trol\thoras\n15/10/2026\tD08\tensamblador\t7,5'}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        spellCheck={false}
      />
      <label className="campo-formulario">
        Fuente de estas horas (obligatorio)
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: Reporte de jornadas RRHH semana 42, aprobado por E. Luque" />
      </label>
      {errorLocal ? <CajaError texto={errorLocal} /> : null}
      {detalle ? <p className="nota-pie">{detalle}</p> : null}
      <button type="button" className="boton boton-primario" onClick={() => void cargar()} disabled={ocupado || texto.trim() === ''}>
        Cargar horas
      </button>
    </section>
  )
}

function SeccionCatalogo({
  calidad,
  catalogo,
  alGuardar
}: {
  calidad: Calidad | null
  catalogo: OperarioCatalogo[] | null
  alGuardar: () => void
}) {
  const [codigo, setCodigo] = useState('')
  const [rol, setRol] = useState<RolOperario>('ensamblador')
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  async function guardar() {
    setOcupado(true)
    setErrorLocal(null)
    try {
      await guardarOperario({ codigo: codigo.trim().toUpperCase(), rol, nombre_oficial: nombre.trim(), activo: true })
      setCodigo('')
      setNombre('')
      alGuardar()
    } catch (e) {
      setErrorLocal((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="panel">
      <h3>Catálogo de operarios (nombres oficiales por código)</h3>
      <p className="nota-pie">
        Los indicadores agrupan por código; el nombre oficial lo confirma el responsable aquí. Los códigos con varios
        nombres en el Excel aparecen abajo para ayudarle a decidir; la app nunca elige un nombre automáticamente.
      </p>
      <div className="fila-turno">
        <input type="text" placeholder="Código (ej. D08)" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        <select value={rol} onChange={(e) => setRol(e.target.value as RolOperario)}>
          <option value="ensamblador">ensamblador</option>
          <option value="pasmador">pasmador</option>
        </select>
        <input type="text" placeholder="Nombre oficial" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button type="button" className="boton boton-primario" onClick={() => void guardar()} disabled={ocupado || codigo.trim() === '' || nombre.trim() === ''}>
          Guardar
        </button>
      </div>
      {errorLocal ? <CajaError texto={errorLocal} /> : null}

      {catalogo && catalogo.length > 0 ? (
        <div className="tabla-envoltura">
          <table className="tabla tabla-compacta">
            <thead>
              <tr>
                <th>Código</th>
                <th>Rol</th>
                <th>Nombre oficial</th>
              </tr>
            </thead>
            <tbody>
              {catalogo.map((o) => (
                <tr key={o.rol + o.codigo}>
                  <td>{o.codigo}</td>
                  <td>{o.rol}</td>
                  <td>{o.nombre_oficial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <SinDatos texto="Aún no hay nombres oficiales confirmados." />
      )}

      {calidad && calidad.inconsistencias.length > 0 ? (
        <>
          <h4>Códigos con varios nombres en el Excel (pendientes de decisión)</h4>
          <div className="tabla-envoltura">
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Código</th>
                  <th>Nombres encontrados (filas)</th>
                </tr>
              </thead>
              <tbody>
                {calidad.inconsistencias.slice(0, 50).map((i) => (
                  <tr key={i.rol + i.codigo}>
                    <td>{i.rol}</td>
                    <td>{i.codigo}</td>
                    <td>{i.nombres.map((n) => `${n.nombre || '(vacío)'} (${fmtEnt(n.filas)})`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}
