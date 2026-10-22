// Componentes pequeños de interfaz reutilizables.

import type { ReactNode } from 'react'

export function Tarjeta(props: { titulo: string; valor: string; detalle?: string; tono?: 'normal' | 'alerta' }) {
  return (
    <div className={'tarjeta' + (props.tono === 'alerta' ? ' tarjeta-alerta' : '')}>
      <div className="tarjeta-titulo">{props.titulo}</div>
      <div className="tarjeta-valor">{props.valor}</div>
      {props.detalle ? <div className="tarjeta-detalle">{props.detalle}</div> : null}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="estado-caja" role="status">
      <span className="girador" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

export function SinDatos({ texto = 'Sin datos para los filtros seleccionados.' }: { texto?: string }) {
  return <div className="estado-caja estado-sin-datos">{texto}</div>
}

export function CajaError({ texto, reintentar }: { texto: string; reintentar?: () => void }) {
  return (
    <div className="estado-caja estado-error" role="alert">
      <div>
        <strong>Ocurrió un error.</strong> {texto}
      </div>
      {reintentar ? (
        <button type="button" className="boton boton-secundario" onClick={reintentar}>
          Reintentar
        </button>
      ) : null}
    </div>
  )
}

export function AvisoBloqueado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="aviso-bloqueado">
      <div className="aviso-bloqueado-titulo">⚠ {titulo}</div>
      <div className="aviso-bloqueado-cuerpo">{children}</div>
    </div>
  )
}

export function Insignia({ texto, tono }: { texto: string; tono: 'ok' | 'aviso' | 'error' | 'neutro' }) {
  return <span className={`insignia insignia-${tono}`}>{texto}</span>
}

export function Modal(props: { titulo: string; abierto: boolean; cerrar: () => void; children: ReactNode }) {
  if (!props.abierto) return null
  return (
    <div className="modal-fondo" onClick={props.cerrar}>
      <div className="modal-caja" role="dialog" aria-modal="true" aria-label={props.titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-encabezado">
          <h3>{props.titulo}</h3>
          <button type="button" className="boton boton-secundario" onClick={props.cerrar}>
            Cerrar
          </button>
        </div>
        <div className="modal-cuerpo">{props.children}</div>
      </div>
    </div>
  )
}

export function BarraProgreso({ hechas, total, texto }: { hechas: number; total: number; texto: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((hechas / total) * 100)) : 0
  return (
    <div className="progreso">
      <div className="progreso-texto">
        {texto} — {pct}% ({hechas.toLocaleString('es-CO')} de {total.toLocaleString('es-CO')})
      </div>
      <div className="progreso-barra">
        <div className="progreso-relleno" style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
