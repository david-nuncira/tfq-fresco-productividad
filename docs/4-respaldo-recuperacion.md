# Guía 4 · Respaldo y recuperación

## Primero, la diferencia que importa

- **Exportar un reporte** (botón "Exportar CSV" del Detalle) produce un archivo para LEER en Excel. Sirve como evidencia y copia de consulta, pero NO restaura la aplicación por sí solo: no contiene usuarios, lotes, historial de revisiones ni configuración.
- **Un respaldo restaurable** es aquello que permite volver a dejar el sistema funcionando después de un desastre. En este MVP se logra con la combinación descrita abajo.

## La buena noticia estructural de este MVP

El **Excel sigue siendo la fuente primaria de registro**. La base de datos es una consolidación reconstruible: si se perdiera por completo, se reinstala el esquema y se re-pega el histórico desde el Excel (la deduplicación hace que re-pegar sea seguro y exacto). Por eso la regla número uno es:

> **Conserve las copias del Excel de Control Pasmado** (como ya lo hacen hoy: OneDrive/SharePoint o copias periódicas). Ese archivo ES el respaldo principal de los datos de producción.

## Plan de respaldo recomendado (sin costo)

| Qué | Con qué frecuencia | Cómo |
|---|---|---|
| Excel original | La que ya usa el área | Su práctica actual (no cambia) |
| Exportación CSV completa | Semanal (p. ej. viernes) | Detalle → quitar filtros de fecha (borrar "Desde/Hasta") → Exportar CSV → guardar con fecha en OneDrive |
| Horas-persona cargadas | Cada vez que cargue horas | Conserve el archivo/pegado fuente que usó |
| Configuración y decisiones | Cuando cambien | Anote en un documento del área: etapa confirmada, turnos, nombres oficiales decididos, conflictos resueltos relevantes |
| Este proyecto (código + SQL) | Una vez | Ya está respaldado: vive en su repositorio privado de GitHub + el ZIP entregado |

## Procedimiento de recuperación (desastre total)

Escenario: el proyecto de Supabase se borró o quedó inutilizable.

1. Cree un proyecto nuevo en Supabase (guía 1, parte A) y ejecute `supabase/esquema.sql`.
2. Cree de nuevo los usuarios y asigne roles (guía 1, A3).
3. En Cloudflare Pages → Settings → Variables and Secrets: reemplace `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` por los del proyecto nuevo y redespliegue.
4. Re-importe el histórico pegándolo desde el Excel (guía 3). Re-cargue las horas-persona desde su fuente.
5. Vuelva a registrar en Configuración lo decidido (etapa, turnos, nombres oficiales).

Lo único que no se recupera con esto es la bitácora interna (lotes/revisiones/decisiones de conflictos previas). Para la operación del área eso es tolerable; si llegara a ser crítico, pase al respaldo técnico de abajo.

## Pausa por inactividad (no es una pérdida de datos)

En el plan Free, Supabase **pausa** el proyecto tras aproximadamente una semana sin uso. Los datos no se borran: en `supabase.com` → su proyecto aparece el botón **Restore** y queda operativo de nuevo en minutos. Según la documentación oficial, un proyecto pausado puede restaurarse con un clic durante **1 año**; después de esa ventana, Supabase deja disponible la descarga del respaldo en lugar del botón. Con el uso semanal del área esto no debería ocurrir nunca; si planean vacaciones colectivas largas, exporten el CSV completo antes.

## Respaldo técnico opcional (restauración exacta, requiere apoyo de Sistemas)

El plan Free no incluye los respaldos automáticos del panel (eso es de planes pagos). Un respaldo exacto y restaurable de TODA la base (incluida la bitácora) se hace con la herramienta estándar `pg_dump` de PostgreSQL usando la cadena de conexión del proyecto (Supabase → Connect → Connection string, con la contraseña de base de datos guardada en la instalación). Es un procedimiento de una línea para alguien de Sistemas; si el área lo quiere mensual, pídalo como tarea técnica. No es requisito para el MVP.

## Crecimiento y límites (estimado con el archivo real)

El histórico actual (~28.000 filas, enero–octubre 2026) equivale a unos 2.800 registros/mes. En la base, con dato crudo + normalizado + índices, eso es del orden de 25–40 MB por año. El plan Free de Supabase admite 500 MB de base de datos: **varios años de operación** a este ritmo. Si el proyecto crece (más líneas de proceso), revise el tamaño en Supabase → Database → Database size una vez por trimestre. No prometa a gerencia almacenamiento "ilimitado": es gratuito dentro de estos límites conocidos.
