import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './componentes/Layout'
import { Cargando, CajaError } from './componentes/ui'
import { FiltrosProvider } from './datos/filtros'
import { configuracionCompleta } from './lib/supabase'
import { Comparativos } from './paginas/Comparativos'
import { Configuracion } from './paginas/Configuracion'
import { Detalle } from './paginas/Detalle'
import { Importar } from './paginas/Importar'
import { ConfiguracionFaltante, Login } from './paginas/Login'
import { Lotes } from './paginas/Lotes'
import { Resumen } from './paginas/Resumen'

function Contenido() {
  const { sesion, perfil, cargando, errorPerfil, cerrarSesion } = useAuth()

  if (cargando) {
    return (
      <div className="pantalla-login">
        <Cargando texto="Verificando sesión…" />
      </div>
    )
  }

  if (!sesion) return <Login />

  if (errorPerfil || !perfil) {
    return (
      <div className="pantalla-login">
        <div className="caja-login">
          <h1>Sin acceso</h1>
          <CajaError texto={errorPerfil ?? 'No fue posible cargar su perfil.'} />
          <button type="button" className="boton boton-secundario" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <FiltrosProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Resumen />} />
          <Route path="comparativos" element={<Comparativos />} />
          <Route path="detalle" element={<Detalle />} />
          <Route path="importar" element={<Importar />} />
          <Route path="lotes" element={<Lotes />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="*" element={<Resumen />} />
        </Route>
      </Routes>
    </FiltrosProvider>
  )
}

export default function App() {
  if (!configuracionCompleta) {
    return <ConfiguracionFaltante />
  }
  return (
    <HashRouter>
      <AuthProvider>
        <Contenido />
      </AuthProvider>
    </HashRouter>
  )
}
