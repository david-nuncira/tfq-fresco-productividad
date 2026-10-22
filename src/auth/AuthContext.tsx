// Autenticación con Supabase Auth (correo + contraseña) y carga
// del perfil con su rol. Sin registro público: los usuarios los
// crea el administrador desde el panel de Supabase.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'

interface EstadoAuth {
  sesion: Session | null
  perfil: Perfil | null
  cargando: boolean
  errorPerfil: string | null
  iniciarSesion: (correo: string, contrasena: string) => Promise<string | null>
  cerrarSesion: () => Promise<void>
  puedeImportar: boolean
  esAdmin: boolean
}

const Contexto = createContext<EstadoAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!activo) return
        setSesion(data.session)
        if (!data.session) setCargando(false)
      })
      .catch(() => {
        if (activo) setCargando(false)
      })

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (!activo) return
      setSesion(nuevaSesion)
      if (!nuevaSesion) {
        setPerfil(null)
        setCargando(false)
      }
    })

    return () => {
      activo = false
      suscripcion.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let activo = true
    if (!sesion) return
    setCargando(true)
    setErrorPerfil(null)
    supabase
      .from('perfiles')
      .select('id, correo, nombre, rol')
      .eq('id', sesion.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!activo) return
        if (error) {
          setErrorPerfil(error.message)
        } else if (!data) {
          setErrorPerfil('Su usuario no tiene perfil asignado. Pida al administrador que revise la tabla "perfiles".')
        } else {
          setPerfil(data as Perfil)
        }
        setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [sesion])

  async function iniciarSesion(correo: string, contrasena: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena })
    if (!error) return null
    if (/invalid login credentials/i.test(error.message)) {
      return 'Correo o contraseña incorrectos.'
    }
    if (/email not confirmed/i.test(error.message)) {
      return 'El correo no está confirmado. El administrador debe crear el usuario con "Auto Confirm" en Supabase.'
    }
    return 'No fue posible iniciar sesión: ' + error.message
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  const rol = perfil?.rol ?? 'lector'
  const valor: EstadoAuth = {
    sesion,
    perfil,
    cargando,
    errorPerfil,
    iniciarSesion,
    cerrarSesion,
    puedeImportar: rol === 'admin' || rol === 'analista',
    esAdmin: rol === 'admin'
  }

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth(): EstadoAuth {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
