import { createClient } from '@supabase/supabase-js'

// Lee la configuración desde las variables de entorno de compilación.
// En Cloudflare Pages se definen como variables del proyecto; en
// desarrollo local, en un archivo .env (ver .env.example).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clavePublicable = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true cuando la compilación recibió URL y clave publicable. */
export const configuracionCompleta: boolean = Boolean(
  url && clavePublicable && url.startsWith('https://')
)

// Si falta configuración se crea un cliente con valores de relleno para
// que la aplicación pueda arrancar y MOSTRAR el aviso de configuración,
// en lugar de quedarse en una pantalla en blanco.
export const supabase = createClient(
  url && url.startsWith('https://') ? url : 'https://configuracion-pendiente.supabase.co',
  clavePublicable || 'configuracion-pendiente',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
)
