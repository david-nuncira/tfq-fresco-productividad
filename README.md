# TFQ Fresco | Productividad

Aplicación web interna de Presh Tech para consolidar el proceso fisicoquímico/pasmado de bandejas de flor (área de Logística y Compras). Los operarios siguen registrando en el Excel de siempre; un analista pega el rango en la aplicación y los reportes se actualizan sin duplicar ni borrar información.

**Stack (todo en planes gratuitos):** React + Vite + TypeScript (SPA estática) · Supabase Free (PostgreSQL + autenticación, seguridad con RLS) · Cloudflare Pages Free (publicación con HTTPS en `*.pages.dev`) · GitHub Free (repositorio privado).

## Qué hay en cada carpeta

| Carpeta / archivo | Contenido |
|---|---|
| `src/` | Código completo de la aplicación (importador, dashboard, comparativos, detalle, lotes, configuración) |
| `supabase/esquema.sql` | Instalación completa de la base de datos: tablas, funciones, índices y políticas de seguridad, en orden de ejecución |
| `docs/` | Las 6 guías, numeradas en orden de uso |
| `datos-demo/` | Datos ficticios para probar (nunca mezclarlos con producción; ver su `LEEME.md`) |
| `tests/` | Pruebas automatizadas de los criterios de aceptación (`npm test`) |
| `.env.example` | Nombres exactos de las 2 variables de configuración |

## Orden de lectura de las guías

1. `docs/1-guia-instalacion.md` — crear Supabase, ejecutar el SQL, crear usuarios, subir a GitHub y conectar Cloudflare Pages (para una persona que no programa).
2. `docs/2-valores-configuracion.md` — cada valor con su nombre exacto y dónde se obtiene.
3. `docs/3-guia-diaria.md` — copiar/pegar del Excel, resolver incidencias y consultar.
4. `docs/4-respaldo-recuperacion.md` — qué es un respaldo restaurable (y qué no).
5. `docs/5-guion-demo-gerencia.md` — demostración de ~10 minutos.
6. `docs/6-pendientes-validacion.md` — lista honesta de lo que falta confirmar con el negocio.

## Decisiones clave (validadas con el archivo real de 27.984 filas)

- **Identidad de evento:** fecha de producción + n° de producción + tanque + posición + n° de bandeja. Con el histórico real: 27.755 eventos únicos, 92 duplicados exactos omitidos, 4 conflictos marcados para revisión humana y 0 colisiones ambiguas. TIEMPO/FECHA quedan fuera de la clave: una hora corregida produce un conflicto visible, nunca un evento duplicado silencioso.
- **Lotes con dos fases:** las filas se suben a un lote `pendiente` y solo cuentan en los indicadores al `confirmarse`. Una importación interrumpida no publica datos parciales; puede reanudarse (re-pegando lo mismo) o descartarse.
- **Sin horas inventadas:** TIEMPO es una hora del día (hay marcas arrastradas: HORA=0 con TIEMPO=20:35). La productividad por hora solo se calcula si el analista carga horas-persona de una fuente validada; mientras tanto se muestra "No calculable con los datos actuales".
- **Seguridad real:** RLS en todas las tablas; toda escritura pasa por funciones del servidor que verifican el rol (admin / analista / lector). En el navegador solo viven la URL del proyecto y la clave publicable.

## Comandos (solo para desarrollo local, opcional)

```bash
npm install     # instala dependencias
npm test        # pruebas de los criterios de aceptación
npm run build   # compila a dist/ (esto mismo lo hace Cloudflare Pages)
npm run dev     # servidor local de desarrollo
```

No necesita ejecutar nada de esto para publicar: Cloudflare Pages instala y compila por usted (guía 1).
