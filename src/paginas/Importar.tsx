// Asistente de importación: pegar desde Excel (o subir TSV/TXT/CSV),
// analizar, revisar la vista previa con rechazos y clasificación,
// confirmar y subir por lotes con progreso y reintentos.

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraProgreso, CajaError, Insignia } from '../componentes/ui'
import { useAuth } from '../auth/AuthContext'
import { useFiltros } from '../datos/filtros'
import { descargarTexto, generarCSV } from '../lib/csv'
import { fmtEnt, hoyISO } from '../lib/formato'
import { parsearTexto, type ResultadoParseo } from '../importador/parser'
import {
  clasificarFilas,
  descartarLote,
  ejecutarImportacion,
  ImportacionCancelada,
  type ConteoClasificacion,
  type ResultadoImportacion
} from '../importador/subida'

type Paso = 'entrada' | 'analizando' | 'revision' | 'subiendo' | 'resultado'

export function Importar() {
  const { puedeImportar } = useAuth()
  const { recargarOpciones } = useFiltros()
  const navegar = useNavigate()

  const [paso, setPaso] = useState<Paso>('entrada')
  const [texto, setTexto] = useState('')
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [progreso, setProgreso] = useState({ hechas: 0, total: 1, texto: '' })
  const [parseo, setParseo] = useState<ResultadoParseo | null>(null)
  const [clasificacion, setClasificacion] = useState<ConteoClasificacion | null>(null)
  const [errorClasificacion, setErrorClasificacion] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loteInterrumpido, setLoteInterrumpido] = useState<string | null>(null)
  const cancelarRef = useRef(false)

  if (!puedeImportar) {
    return (
      <div className="panel">
        <h2>Importar</h2>
        <p>Su usuario tiene rol de lector: puede consultar todos los reportes, pero no importar datos.</p>
        <p>Si necesita importar, pida al administrador que cambie su rol a «analista».</p>
      </div>
    )
  }

  async function leerArchivo(archivo: File) {
    const contenido = await archivo.text()
    setNombreArchivo(archivo.name)
    setTexto(contenido)
  }

  async function analizar() {
    setError(null)
    setPaso('analizando')
    setProgreso({ hechas: 0, total: 1, texto: 'Interpretando el contenido' })
    try {
      const r = await parsearTexto(texto, (hechas, total) =>
        setProgreso({ hechas, total, texto: 'Validando filas' })
      )
      setParseo(r)
      if (r.errorGeneral) {
        setPaso('entrada')
        setError(r.errorGeneral)
        return
      }
      setPaso('revision')
      setClasificacion(null)
      setErrorClasificacion(null)
      // Clasificación contra la base (solo lectura), en segundo plano.
      clasificarFilas(r.filas, (hechas, total) =>
        setProgreso({ hechas, total, texto: 'Comparando con lo ya importado' })
      )
        .then(setClasificacion)
        .catch((e: Error) => setErrorClasificacion(e.message))
    } catch (e) {
      setPaso('entrada')
      setError('No fue posible analizar el contenido: ' + (e as Error).message)
    }
  }

  async function confirmar() {
    if (!parseo) return
    setPaso('subiendo')
    setError(null)
    cancelarRef.current = false
    try {
      const r = await ejecutarImportacion(parseo.filas, {
        origen: nombreArchivo ? 'archivo' : 'pegado',
        nombreOrigen: nombreArchivo,
        filasRecibidas: parseo.totalFilasDatos,
        rechazadasCliente: parseo.rechazadas.length,
        onProgreso: (hechas, total) => setProgreso({ hechas, total, texto: 'Guardando en la base de datos' }),
        debeCancelar: () => cancelarRef.current
      })
      setResultado(r)
      setPaso('resultado')
      recargarOpciones()
    } catch (e) {
      if (e instanceof ImportacionCancelada) {
        setLoteInterrumpido(e.loteId)
        setPaso('revision')
        setError(
          'Importación cancelada. El avance quedó en un lote PENDIENTE que no afecta los indicadores: puede reanudar pegando de nuevo el mismo contenido, o descartarlo aquí mismo.'
        )
      } else {
        setPaso('revision')
        setError(
          'La subida se interrumpió: ' +
            (e as Error).message +
            '. Nada de lo subido cuenta en los indicadores (el lote quedó pendiente). Puede reintentar con el mismo pegado (lo ya guardado se reconocerá y no se duplicará) o descartar el lote en «Importaciones y calidad».'
        )
      }
    }
  }

  async function descartarPendiente() {
    if (!loteInterrumpido) return
    try {
      await descartarLote(loteInterrumpido)
      setLoteInterrumpido(null)
      setError('Lote pendiente descartado. Puede volver a empezar.')
    } catch (e) {
      setError('No se pudo descartar: ' + (e as Error).message)
    }
  }

  function descargarIncidencias() {
    if (!parseo) return
    const encabezados = ['Fila de origen', 'Motivo', 'Contenido (recortado)']
    const cuerpo = parseo.rechazadas.map((r) => [r.filaOrigen, r.motivo, r.contenido])
    descargarTexto(`tfq-incidencias-${hoyISO()}.csv`, generarCSV(encabezados, cuerpo))
  }

  function descargarAdvertencias() {
    if (!parseo) return
    const encabezados = ['Fila de origen', 'N° bandeja', 'Advertencias']
    const cuerpo = parseo.filas
      .filter((f) => f.advertencias.length > 0)
      .map((f) => [f.filaOrigen, f.n.numero_bandeja ?? '', f.advertencias.join(' | ')])
    descargarTexto(`tfq-advertencias-${hoyISO()}.csv`, generarCSV(encabezados, cuerpo))
  }

  function reiniciar() {
    setPaso('entrada')
    setTexto('')
    setNombreArchivo(null)
    setParseo(null)
    setClasificacion(null)
    setResultado(null)
    setError(null)
  }

  const conAdvertencias = parseo ? parseo.filas.filter((f) => f.advertencias.length > 0).length : 0

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Importar registros del Excel</h2>
        <div className="nota-estado">
          Los operarios siguen registrando en el Excel de siempre. Aquí solo se pega el rango (con encabezados) para
          actualizar los reportes. Nada se guarda hasta que usted confirme.
        </div>
      </div>

      {error ? (
        <div className="estado-caja estado-error" role="alert">
          {error}
          {loteInterrumpido ? (
            <button type="button" className="boton boton-secundario" onClick={() => void descartarPendiente()}>
              Descartar lote pendiente
            </button>
          ) : null}
        </div>
      ) : null}

      {paso === 'entrada' ? (
        <section className="panel">
          <h3>1. Pegue el rango copiado desde Excel</h3>
          <p className="nota-pie">
            En Excel: seleccione desde la fila de títulos hasta la última fila con datos → Ctrl+C. Aquí: clic en el
            recuadro → Ctrl+V. También puede subir un archivo .txt/.tsv (texto separado por tabulaciones, UTF-8) o .csv.
          </p>
          <textarea
            className="area-pegado"
            placeholder="Pegue aquí el rango copiado de Excel (incluya la fila de encabezados)…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={10}
            spellCheck={false}
          />
          <div className="fila-acciones">
            <label className="boton boton-secundario cargar-archivo">
              Subir archivo .txt / .tsv / .csv
              <input
                type="file"
                accept=".txt,.tsv,.csv,text/plain,text/tab-separated-values,text/csv"
                hidden
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) void leerArchivo(archivo)
                  e.target.value = ''
                }}
              />
            </label>
            {nombreArchivo ? <Insignia texto={`Archivo: ${nombreArchivo}`} tono="neutro" /> : null}
            <div className="fila-acciones-derecha">
              <button type="button" className="boton boton-primario" onClick={() => void analizar()} disabled={texto.trim() === ''}>
                Analizar antes de guardar →
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {paso === 'analizando' ? (
        <section className="panel">
          <h3>Analizando…</h3>
          <BarraProgreso hechas={progreso.hechas} total={progreso.total} texto={progreso.texto} />
          <p className="nota-pie">El análisis ocurre en su navegador; aún no se guarda nada.</p>
        </section>
      ) : null}

      {paso === 'revision' && parseo ? (
        <section className="panel">
          <h3>2. Revise antes de confirmar</h3>
          <div className="rejilla-resumen-importacion">
            <div>
              <div className="dato-grande">{fmtEnt(parseo.totalFilasDatos)}</div>
              <div>filas recibidas</div>
            </div>
            <div>
              <div className="dato-grande">{fmtEnt(parseo.filas.length)}</div>
              <div>eventos de bandeja válidos</div>
            </div>
            <div>
              <div className="dato-grande">{fmtEnt(parseo.rechazadas.length)}</div>
              <div>filas rechazadas (plantillas, vacías…)</div>
            </div>
            <div>
              <div className="dato-grande">{fmtEnt(conAdvertencias)}</div>
              <div>filas con advertencias (se importan marcadas)</div>
            </div>
          </div>

          {clasificacion ? (
            <div className="rejilla-resumen-importacion clasificacion">
              <div>
                <div className="dato-grande">{fmtEnt(clasificacion.nuevas)}</div>
                <div>NUEVAS para la base</div>
              </div>
              <div>
                <div className="dato-grande">{fmtEnt(clasificacion.duplicadas)}</div>
                <div>ya importadas (se omitirán)</div>
              </div>
              <div>
                <div className="dato-grande">{fmtEnt(clasificacion.conflictos)}</div>
                <div>posibles conflictos (quedarán para revisión, sin sobrescribir)</div>
              </div>
            </div>
          ) : errorClasificacion ? (
            <CajaError texto={'No se pudo precontar contra la base: ' + errorClasificacion + '. Puede confirmar igualmente; el servidor clasifica cada fila al guardar.'} />
          ) : (
            <BarraProgreso hechas={progreso.hechas} total={progreso.total} texto="Comparando con lo ya importado" />
          )}

          {parseo.mapeo && parseo.mapeo.desconocidos.length > 0 ? (
            <p className="nota-pie">
              Columnas no reconocidas (se conservan en el dato crudo, sin interpretarlas):{' '}
              {parseo.mapeo.desconocidos.map((d) => `#${d.posicion} «${d.nombre}»`).join(', ')}
            </p>
          ) : null}

          {parseo.rechazadas.length > 0 ? (
            <details>
              <summary>Ver filas rechazadas ({fmtEnt(parseo.rechazadas.length)})</summary>
              <div className="tabla-envoltura">
                <table className="tabla tabla-compacta">
                  <thead>
                    <tr>
                      <th>Fila origen</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseo.rechazadas.slice(0, 200).map((r) => (
                      <tr key={r.filaOrigen}>
                        <td className="num">{r.filaOrigen}</td>
                        <td>{r.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parseo.rechazadas.length > 200 ? <p className="nota-pie">Mostrando 200; descargue el CSV para ver todas.</p> : null}
            </details>
          ) : null}

          <div className="fila-acciones">
            <button type="button" className="boton boton-secundario" onClick={descargarIncidencias} disabled={parseo.rechazadas.length === 0}>
              Descargar rechazadas (CSV)
            </button>
            <button type="button" className="boton boton-secundario" onClick={descargarAdvertencias} disabled={conAdvertencias === 0}>
              Descargar advertencias (CSV)
            </button>
            <div className="fila-acciones-derecha">
              <button type="button" className="boton boton-secundario" onClick={reiniciar}>
                Cancelar
              </button>
              <button type="button" className="boton boton-primario" onClick={() => void confirmar()} disabled={parseo.filas.length === 0}>
                Confirmar e importar {fmtEnt(parseo.filas.length)} filas
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {paso === 'subiendo' ? (
        <section className="panel">
          <h3>3. Guardando…</h3>
          <BarraProgreso hechas={progreso.hechas} total={progreso.total} texto={progreso.texto} />
          <p className="nota-pie">
            Las filas se guardan en un lote que solo se publica al terminar. Si se interrumpe, nada parcial contará en
            los indicadores.
          </p>
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => {
              cancelarRef.current = true
            }}
          >
            Cancelar subida
          </button>
        </section>
      ) : null}

      {paso === 'resultado' && resultado ? (
        <section className="panel">
          <h3>Importación confirmada ✔</h3>
          <ul className="lista-resultado">
            <li>
              <strong>{fmtEnt(resultado.nuevas)}</strong> eventos nuevos guardados
            </li>
            <li>
              <strong>{fmtEnt(resultado.duplicadas)}</strong> filas ya existían (no se duplicaron)
            </li>
            <li>
              <strong>{fmtEnt(resultado.conflictos)}</strong> conflictos guardados para revisión (misma identidad,
              contenido distinto) — resuélvalos en «Importaciones y calidad»
            </li>
            {resultado.errores.length > 0 ? (
              <li>
                <strong>{fmtEnt(resultado.errores.length)}</strong> filas con error del servidor:{' '}
                {resultado.errores
                  .slice(0, 5)
                  .map((e) => `fila ${e.fila}: ${e.error}`)
                  .join(' · ')}
              </li>
            ) : null}
          </ul>
          <div className="fila-acciones">
            <button type="button" className="boton boton-secundario" onClick={reiniciar}>
              Importar otro rango
            </button>
            <div className="fila-acciones-derecha">
              {resultado.conflictos > 0 ? (
                <button type="button" className="boton boton-secundario" onClick={() => navegar('/lotes')}>
                  Resolver conflictos
                </button>
              ) : null}
              <button type="button" className="boton boton-primario" onClick={() => navegar('/')}>
                Ver el resumen
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
