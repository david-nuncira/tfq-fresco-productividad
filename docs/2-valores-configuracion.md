# Guía 2 · Valores de configuración (nombres exactos)

Ningún valor de esta tabla viene inventado en el proyecto: cada uno se obtiene de SU cuenta en el servicio indicado. No hay credenciales escritas en el código ni deben escribirse nunca.

## Cloudflare Pages — configuración del proyecto

| Campo | Valor exacto | Dónde se configura |
|---|---|---|
| Framework preset | `React (Vite)` | Al crear el proyecto Pages (o Settings → Build) |
| Build command | `npm run build` | Ídem (el preset lo pone solo) |
| Build output directory | `dist` | Ídem (el preset lo pone solo) |
| Production branch | `main` | Al crear el proyecto |
| Versión de Node | la define el archivo `.node-version` del repositorio (contiene `20`) | Automático |

## Cloudflare Pages — variables de entorno

| Nombre exacto (respetar mayúsculas) | Qué contiene | Dónde se obtiene el valor |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto, p. ej. `https://abcdefgh.supabase.co` | Supabase → Settings → API → **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Clave **publicable** (anon public) | Supabase → Settings → API → **Project API keys → anon public** |

Se configuran en: Workers & Pages → su proyecto → **Settings → Variables and Secrets** (ambiente Production). Tras cambiarlas: **redesplegar**.

> La clave `anon public` puede viajar al navegador: la seguridad la imponen las políticas RLS instaladas por `supabase/esquema.sql`, no el secreto de la clave. Lo que JAMÁS debe salir de Supabase: la clave `service_role` y la contraseña de la base de datos.

## Supabase — valores que usted define y guarda

| Valor | Dónde | Notas |
|---|---|---|
| Contraseña de la base de datos | Al crear el proyecto | Guardarla en un gestor de contraseñas; no la usa la aplicación |
| Región | `South America (São Paulo)` | La más cercana a Colombia |
| Usuarios y contraseñas de la app | Authentication → Users → **Add user** con **Auto Confirm User** | Sin registro público |
| Rol de cada usuario | SQL Editor | `update public.perfiles set rol='analista' where correo='...';` (roles: `admin`, `analista`, `lector`) |

## GitHub

| Valor | Exacto |
|---|---|
| Nombre del repositorio | `tfq-fresco-productividad` |
| Visibilidad | Private |
| Qué NO subir nunca | `node_modules/`, `dist/`, cualquier archivo `.env` (el `.gitignore` incluido ya los excluye si algún día usa Git desde el computador) |

## Dentro de la aplicación (menú Configuración, rol admin)

| Ajuste | Valor inicial | Quién lo cambia |
|---|---|---|
| Etapa de la marca horaria (FECHA/TIEMPO) | **Sin confirmar** → indicadores horarios bloqueados | Admin, solo con confirmación del responsable del proceso |
| Turnos | **Sin definir** (no se inventan horarios) | Admin, con la definición oficial del área |
| Horas-persona | Vacío → productividad "No calculable" | Analista, pegando una fuente existente y validada |
| Metas/semáforos | No existen → no se muestran | Fase posterior, cuando Logística las apruebe |
| Zona horaria | `America/Bogota` | Ya configurada |
