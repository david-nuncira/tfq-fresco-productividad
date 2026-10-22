# Guía 1 · Instalación y publicación (para una persona que no programa)

Tiempo estimado: 45–60 minutos. Necesita: un navegador, su correo corporativo y esta carpeta del proyecto descomprimida en su computador.

El recorrido es: **Supabase** (base de datos) → **GitHub** (guardar el código) → **Cloudflare Pages** (publicar la página). Todo en planes gratuitos, sin tarjeta de crédito.

> Los nombres exactos de cada valor que va a copiar/pegar están en `docs/2-valores-configuracion.md`. Téngalo abierto al lado.

---

## Parte A — Supabase (base de datos y usuarios)

### A1. Crear la cuenta y el proyecto

1. Entre a `https://supabase.com` → **Start your project** → cree la cuenta (puede usar su correo o su cuenta de GitHub).
2. Si le pide crear una organización, cree una (nombre libre, plan **Free**).
3. Botón **New project**:
   - **Name:** `tfq-fresco-productividad`
   - **Database password:** invente una contraseña larga y **guárdela en un lugar seguro** (no la volverá a ver; NO va en la aplicación; solo sirve para tareas técnicas futuras como respaldos).
   - **Region:** elija **South America (São Paulo)** — es la más cercana a Colombia.
   - Clic en **Create new project** y espere 1–2 minutos a que quede listo.

> Importante: **no use el proyecto Supabase de su proyecto anterior.** Este MVP vive en su propio proyecto para no tocar nada existente. El plan Free permite 2 proyectos activos.

### A2. Instalar la base de datos (ejecutar el SQL)

1. En el menú izquierdo, clic en **SQL Editor**.
2. Clic en **New query** (o en el signo +).
3. En su computador abra el archivo `supabase/esquema.sql` de esta carpeta con el **Bloc de notas**, seleccione TODO (Ctrl+E o Ctrl+A) y cópielo (Ctrl+C).
4. Péguelo en el editor de Supabase (Ctrl+V) y presione **Run** (o Ctrl+Enter).
5. Debe terminar con "Success. No rows returned". Si aparece un error en rojo, no continúe: copie el mensaje y revíselo (lo más común es haber pegado el archivo incompleto, o ejecutarlo dos veces: este script se ejecuta UNA sola vez en un proyecto vacío).

### A3. Crear los usuarios (sin registro público)

La aplicación no tiene "crear cuenta": los usuarios se crean aquí, uno por uno.

1. Menú izquierdo → **Authentication** → **Users** → botón **Add user** → **Create new user**.
2. Escriba el correo y una contraseña temporal. **Marque la casilla "Auto Confirm User"** (imprescindible: no hay servicio de correo configurado, así que sin esa casilla el usuario no podría entrar).
3. Clic en **Create user**. Repita para cada persona.

Cada usuario nace con rol **lector** (solo consulta). Para subir de rol:

4. Vaya al **SQL Editor** → New query → pegue y ejecute (cambiando el correo):

```sql
update public.perfiles set rol = 'admin'
where correo = 'su.correo@presh-tech.com';
```

Roles disponibles: `'admin'` (todo, incluida la configuración), `'analista'` (importa y corrige), `'lector'` (solo consulta). Ejecute esa misma instrucción con `'analista'` o `'lector'` para los demás.

### A4. Copiar los dos valores que la página necesita

1. Menú izquierdo → **Settings** (engranaje) → **API** (si su panel muestra "Data API", es esa misma sección).
2. Copie y guarde en un bloc de notas:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - La clave pública de API: aparece como **anon public** (o "publishable"). Es la clave **publicable**: está diseñada para usarse en el navegador.
3. **Nunca** copie la clave `service_role` (secreta) ni la contraseña de la base de datos: la aplicación no las necesita y no deben salir de Supabase.

---

## Parte B — GitHub (guardar el código en un repositorio privado)

### B1. Crear la cuenta y el repositorio

1. Entre a `https://github.com` → **Sign up** (si no tiene cuenta).
2. Arriba a la derecha, el signo **+** → **New repository**:
   - **Repository name:** `tfq-fresco-productividad`
   - Visibilidad: **Private**
   - NO marque "Add a README" (el proyecto ya trae uno).
   - **Create repository**.

### B2. Subir los archivos del proyecto (desde el navegador)

1. En la página del repositorio recién creado, use el enlace **uploading an existing file** (o **Add file → Upload files**).
2. En su computador, abra la carpeta del proyecto (`tfq-fresco-productividad`), seleccione TODO su contenido (Ctrl+E) y **arrástrelo** a la zona de carga del navegador. Arrastre el contenido (archivos y subcarpetas), no la carpeta padre.
   - El límite de GitHub por tanda es de 100 archivos; este proyecto tiene menos, cabe en una sola tanda. Verifique que en la lista aparezcan las carpetas `src/`, `docs/`, `supabase/`, `datos-demo/`, `tests/` y los archivos sueltos (`package.json`, `index.html`, etc.).
   - El ZIP entregado no incluye `node_modules` ni `dist` (no deben subirse) ni ningún archivo `.env`.
   - Nota: los archivos cuyo nombre empieza por punto (`.gitignore`, `.env.example`, `.node-version`) a veces están ocultos en Windows. Si no se arrastraron, actívelos en el Explorador (Vista → Elementos ocultos) y súbalos; no son indispensables para que compile, pero conviene tenerlos.
3. Abajo, en "Commit changes", escriba por ejemplo `Versión inicial del MVP` y confirme con **Commit changes**.

---

## Parte C — Cloudflare Pages (publicar la página)

### C1. Crear la cuenta y conectar el repositorio

1. Entre a `https://dash.cloudflare.com/sign-up` y cree la cuenta gratuita.
2. En el panel, menú **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git** (si su panel lo llama "Import an existing Git repository", es lo mismo).
3. Conecte su cuenta de GitHub y **autorice el acceso al repositorio** `tfq-fresco-productividad` (puede autorizar solo ese repositorio).
4. Selecciónelo y clic en **Begin setup**.

### C2. Configuración de compilación

- **Project name:** `tfq-fresco-productividad` (esto define la dirección final: `tfq-fresco-productividad.pages.dev`; si está ocupado, Cloudflare sugiere otro).
- **Production branch:** `main`.
- **Framework preset:** elija **React (Vite)**. Si no aparece, configure manualmente:
  - **Build command:** `npm run build`
  - **Build output directory:** `dist`

### C3. Variables de entorno (ANTES de desplegar)

En la misma pantalla de configuración, sección **Environment variables** (o, después de crear el proyecto, en **Settings → Variables and Secrets**), agregue exactamente estas dos (tipo "Plaintext" es suficiente):

| Nombre exacto | Valor |
|---|---|
| `VITE_SUPABASE_URL` | el **Project URL** copiado en A4 |
| `VITE_SUPABASE_ANON_KEY` | la clave **anon public** copiada en A4 |

### C4. Desplegar

1. Clic en **Save and Deploy**. La compilación tarda 1–3 minutos.
2. Al terminar verá la dirección pública, por ejemplo: `https://tfq-fresco-productividad.pages.dev`. Tiene HTTPS automático y no cuesta nada.

> Si cambió las variables DESPUÉS del primer despliegue, debe redesplegar para que tomen efecto: **Deployments → (último) → ⋯ → Retry deployment**.

### C5. Primer ingreso y verificación

1. Abra la dirección `...pages.dev` e ingrese con el usuario creado en A3.
2. Verifique en orden:
   - El **Resumen** carga y dice "Aún no hay importaciones confirmadas".
   - En **Importar**, pegue el contenido de `datos-demo/datos_demo.tsv` y siga el asistente (la guía 3 explica cada pantalla). Debe reportar 232 válidas, 4 rechazadas, y al confirmar: 229 nuevas, 2 duplicadas, 1 conflicto.
   - Entre desde el celular u otro navegador con el mismo usuario: los datos están (viven en Supabase, no en su navegador).
   - Entre con un usuario `lector`: puede consultar, pero no ve "Importar" y, aunque alguien intente llamadas directas a la API, la base rechaza sus escrituras (eso lo garantizan las políticas instaladas con el SQL).
3. Cuando termine la prueba, **anule el lote demo** (Importaciones y calidad → Lotes → Anular) y ya puede importar el histórico real (guía 3).

---

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| La página dice "Configuración incompleta" | Faltan las 2 variables de C3 o se agregaron después del despliegue → agréguelas y redespliegue (C4) |
| "Failed" en el build de Cloudflare | Abra el registro del despliegue; lo usual es build command/carpeta mal escritos (C2) o archivos faltantes en GitHub (B2) |
| "Correo o contraseña incorrectos" | Usuario sin crear, contraseña distinta, o no marcó **Auto Confirm User** (A3: puede borrar ese usuario sin datos y crearlo de nuevo con la casilla marcada) |
| Entra pero dice "Sin acceso / sin perfil" | El SQL se ejecutó DESPUÉS de crear el usuario → ejecute en SQL Editor: `insert into public.perfiles (id, correo) select id, email from auth.users on conflict (id) do nothing;` y asigne el rol (A3.4) |
| Todo funcionaba y un día "no responde" | El proyecto Free de Supabase se pausa tras ~1 semana sin uso → entre a supabase.com → su proyecto → botón **Restore**; queda igual que antes (ver guía 4) |
