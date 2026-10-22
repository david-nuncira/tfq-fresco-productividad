import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Administrador',
  analista: 'Analista',
  lector: 'Lector'
}

export function Layout() {
  const { perfil, cerrarSesion, puedeImportar, esAdmin } = useAuth()

  return (
    <div className="aplicacion">
      <header className="cabecera">
        <div className="cabecera-marca">
          <span className="logo" aria-hidden="true">❀</span>
          <div>
            <div className="marca-titulo">TFQ Fresco | Productividad</div>
            <div className="marca-subtitulo">Proceso fisicoquímico · Logística · Presh Tech</div>
          </div>
        </div>
        <nav className="navegacion" aria-label="Secciones">
          <NavLink to="/" end>
            Resumen
          </NavLink>
          <NavLink to="/comparativos">Comparativos</NavLink>
          <NavLink to="/detalle">Detalle</NavLink>
          {puedeImportar ? <NavLink to="/importar">Importar</NavLink> : null}
          <NavLink to="/lotes">Importaciones y calidad</NavLink>
          {puedeImportar || esAdmin ? <NavLink to="/configuracion">Configuración</NavLink> : null}
        </nav>
        <div className="cabecera-usuario">
          <div className="usuario-datos">
            <span className="usuario-correo">{perfil?.correo ?? ''}</span>
            <span className="usuario-rol">{ETIQUETA_ROL[perfil?.rol ?? 'lector']}</span>
          </div>
          <button type="button" className="boton boton-secundario" onClick={() => void cerrarSesion()}>
            Salir
          </button>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
      <footer className="pie">
        MVP interno · Los comparativos son señales para investigar, no prueban por sí solos bajo desempeño ni pérdidas.
      </footer>
    </div>
  )
}
