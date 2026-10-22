// Barra de filtros compartida. Todos los indicadores de la página
// responden a estos mismos filtros.

import { useFiltros } from '../datos/filtros'
import { NOMBRE_TIPO_FECHA, type RolOperario, type TipoFecha } from '../lib/tipos'

function Selector(props: {
  etiqueta: string
  valor: string | null
  opciones: { valor: string; texto: string }[]
  cambiar: (v: string | null) => void
  deshabilitado?: boolean
  titulo?: string
}) {
  return (
    <label className="filtro" title={props.titulo}>
      <span>{props.etiqueta}</span>
      <select
        value={props.valor ?? ''}
        disabled={props.deshabilitado}
        onChange={(e) => props.cambiar(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">Todos</option>
        {props.opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  )
}

export function BarraFiltros({ mostrarRol = true }: { mostrarRol?: boolean }) {
  const { filtros, fijarFiltros, reiniciarFiltros, opciones } = useFiltros()

  const simples = (lista: string[] | undefined) => (lista ?? []).map((v) => ({ valor: v, texto: v }))

  const operarios =
    filtros.rolOperario === 'pasmador' ? opciones?.pasmadores ?? [] : opciones?.ensambladores ?? []

  const turnosDefinidos = opciones?.turnos.definidos ?? false
  const etapaConfirmada = opciones?.etapa_marca.confirmada ?? false

  return (
    <section className="barra-filtros" aria-label="Filtros">
      <label className="filtro">
        <span>Tipo de fecha</span>
        <select
          value={filtros.tipoFecha}
          onChange={(e) => fijarFiltros({ tipoFecha: e.target.value as TipoFecha })}
        >
          <option value="produccion">{NOMBRE_TIPO_FECHA.produccion}</option>
          <option value="cargue">{NOMBRE_TIPO_FECHA.cargue}</option>
          <option value="registro">{NOMBRE_TIPO_FECHA.registro}</option>
        </select>
      </label>
      <label className="filtro">
        <span>Desde</span>
        <input
          type="date"
          value={filtros.desde ?? ''}
          onChange={(e) => fijarFiltros({ desde: e.target.value || null })}
        />
      </label>
      <label className="filtro">
        <span>Hasta</span>
        <input
          type="date"
          value={filtros.hasta ?? ''}
          onChange={(e) => fijarFiltros({ hasta: e.target.value || null })}
        />
      </label>
      {mostrarRol ? (
        <label className="filtro">
          <span>Rol</span>
          <select
            value={filtros.rolOperario}
            onChange={(e) => fijarFiltros({ rolOperario: e.target.value as RolOperario })}
          >
            <option value="ensamblador">Ensamblador</option>
            <option value="pasmador">Pasmador</option>
          </select>
        </label>
      ) : null}
      <Selector
        etiqueta="Operario"
        valor={filtros.operario}
        opciones={operarios.map((o) => ({ valor: o.codigo, texto: o.nombre ? `${o.codigo} · ${o.nombre}` : o.codigo }))}
        cambiar={(v) => fijarFiltros({ operario: v })}
      />
      <Selector
        etiqueta="Turno"
        valor={filtros.turno}
        opciones={(opciones?.turnos.lista ?? []).map((t) => ({ valor: t.nombre, texto: t.nombre }))}
        cambiar={(v) => fijarFiltros({ turno: v })}
        deshabilitado={!turnosDefinidos || !etapaConfirmada}
        titulo={
          turnosDefinidos && etapaConfirmada
            ? undefined
            : 'No disponible: requiere turnos configurados y la etapa de la marca horaria confirmada por el responsable'
        }
      />
      <Selector etiqueta="Finca" valor={filtros.finca} opciones={simples(opciones?.fincas)} cambiar={(v) => fijarFiltros({ finca: v })} />
      <Selector etiqueta="Variedad" valor={filtros.variedad} opciones={simples(opciones?.variedades)} cambiar={(v) => fijarFiltros({ variedad: v })} />
      <Selector etiqueta="Tanque" valor={filtros.tanque} opciones={simples(opciones?.tanques)} cambiar={(v) => fijarFiltros({ tanque: v })} />
      <Selector etiqueta="Líquido" valor={filtros.liquido} opciones={simples(opciones?.liquidos)} cambiar={(v) => fijarFiltros({ liquido: v })} />
      <Selector
        etiqueta="Tipo de bandeja"
        valor={filtros.tipoBandeja}
        opciones={simples(opciones?.tipos_bandeja)}
        cambiar={(v) => fijarFiltros({ tipoBandeja: v })}
      />
      <button type="button" className="boton boton-secundario filtro-limpiar" onClick={reiniciarFiltros}>
        Limpiar filtros
      </button>
    </section>
  )
}
