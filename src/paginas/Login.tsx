import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

export function Login() {
  const { iniciarSesion } = useAuth()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const mensaje = await iniciarSesion(correo.trim(), contrasena)
    setEnviando(false)
    if (mensaje) setError(mensaje)
  }

  return (
    <div className="pantalla-login">
      <form className="caja-login" onSubmit={(e) => void enviar(e)}>
        <div className="login-marca">
          <span className="logo logo-grande" aria-hidden="true">❀</span>
          <h1>TFQ Fresco | Productividad</h1>
          <p>Proceso fisicoquímico de bandejas de flor · Logística</p>
        </div>
        <label>
          Correo
          <input
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            required
          />
        </label>
        {error ? (
          <div className="estado-caja estado-error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="boton boton-primario" disabled={enviando}>
          {enviando ? 'Verificando…' : 'Entrar'}
        </button>
        <p className="login-nota">
          El acceso lo entrega el administrador; no hay registro público. Si olvidó su contraseña, pida al
          administrador que la restablezca desde el panel de Supabase.
        </p>
      </form>
    </div>
  )
}

export function ConfiguracionFaltante() {
  return (
    <div className="pantalla-login">
      <div className="caja-login">
        <h1>Configuración incompleta</h1>
        <p>
          Esta publicación de la aplicación se compiló sin las variables <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p>
          En Cloudflare Pages: <strong>Settings → Variables and Secrets</strong>, agregue esas dos variables (los
          valores están en Supabase: <strong>Settings → API</strong>) y vuelva a desplegar. Guía completa en{' '}
          <code>docs/1-guia-instalacion.md</code>.
        </p>
      </div>
    </div>
  )
}
