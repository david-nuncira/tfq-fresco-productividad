// Estado global de filtros: todas las tarjetas, gráficos y tablas
// responden a los mismos filtros.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { haceDiasISO, hoyISO } from '../lib/formato'
import type { Filtros, OpcionesFiltros } from '../lib/tipos'
import { obtenerOpciones } from './consultas'

interface EstadoFiltros {
  filtros: Filtros
  fijarFiltros: (cambios: Partial<Filtros>) => void
  reiniciarFiltros: () => void
  opciones: OpcionesFiltros | null
  cargandoOpciones: boolean
  errorOpciones: string | null
  recargarOpciones: () => void
}

const FILTROS_INICIALES: Filtros = {
  desde: haceDiasISO(29),
  hasta: hoyISO(),
  tipoFecha: 'produccion',
  rolOperario: 'ensamblador',
  operario: null,
  finca: null,
  variedad: null,
  tanque: null,
  liquido: null,
  tipoBandeja: null,
  turno: null
}

const Contexto = createContext<EstadoFiltros | null>(null)

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [opciones, setOpciones] = useState<OpcionesFiltros | null>(null)
  const [cargandoOpciones, setCargando] = useState(true)
  const [errorOpciones, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    obtenerOpciones()
      .then((op) => {
        if (activo) setOpciones(op)
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

  const valor = useMemo<EstadoFiltros>(
    () => ({
      filtros,
      fijarFiltros: (cambios) =>
        setFiltros((previos) => {
          const nuevos = { ...previos, ...cambios }
          // Al cambiar de rol, el operario seleccionado deja de aplicar.
          if (cambios.rolOperario && cambios.rolOperario !== previos.rolOperario) {
            nuevos.operario = null
          }
          return nuevos
        }),
      reiniciarFiltros: () => setFiltros(FILTROS_INICIALES),
      opciones,
      cargandoOpciones,
      errorOpciones,
      recargarOpciones: () => setVersion((v) => v + 1)
    }),
    [filtros, opciones, cargandoOpciones, errorOpciones]
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useFiltros(): EstadoFiltros {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useFiltros debe usarse dentro de FiltrosProvider')
  return ctx
}
