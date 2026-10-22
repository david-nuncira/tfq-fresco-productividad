# Guía 6 · Pendientes de validación y fases posteriores

Lista honesta de lo que el MVP deja explícitamente abierto. Nada de esto impide usar la importación, los volúmenes ni los comparativos de volumen/calidad desde el día uno.

## A. Definiciones del negocio (requieren al responsable del proceso — Elvis Luque / Logística)

| # | Pendiente | Evidencia encontrada en el archivo real | Efecto mientras no se resuelva |
|---|---|---|---|
| 1 | ¿A qué etapa pertenecen FECHA + HORA/MINUTO/TIEMPO? (¿digitación del ensamble? ¿fin del proceso?) | 101 filas con HORA=0 y TIEMPO=20:35 (fórmula arrastrada); 861 filas donde DIA/MES/AÑO contradice a FECHA; FECHA vacía en 5.309 filas | Indicadores horarios y "ventana observada" bloqueados con explicación. Se desbloquean en Configuración cuando el responsable confirme |
| 2 | Horarios oficiales de turnos (y si cruzan medianoche) | No existen en la fuente | Filtro de turno deshabilitado; se configuran sin tocar código |
| 3 | Fuente validada de horas-persona (jornadas netas por fecha/operario) | No existe en la fuente | Productividad = "No calculable con los datos actuales"; se carga en Configuración cuando exista |
| 4 | Nombre oficial de los 36 códigos de ensamblador con varios nombres (ej.: D08 aparece con 14 nombres; códigos duplicados solo por mayúscula d08/D08) y del pasmador JR (nombre vacío en 5.999 filas) | Pestaña Calidad los lista con conteos | Los comparativos agrupan por código y muestran las variantes marcadas "revisar"; nunca se fusiona gente automáticamente |
| 5 | ¿Qué significan la columna «1630» (toda en 0) y OCUPACIÓN (0.04–0.06, ¿unidad?) | Presentes en el 100% del archivo | Se conservan en el dato crudo y en el detalle; no alimentan indicadores |
| 6 | FINCA contiene el valor "MATIZ" (una variedad) en 16 filas | Error de digitación aparente | Visible en filtros/calidad para corrección en el Excel |
| 7 | Decisión sobre los 4 conflictos del histórico (producción 441 del 06/04/2026, posiciones 3/4/11/12 redigitadas con hora 8:09 vs 8:11) | Detectados al importar | Quedan en "Conflictos pendientes" esperando decisión; no inflan ni pierden producción |
| 8 | Metas para semáforos de cumplimiento | No existen metas aprobadas | No se muestran semáforos (a propósito); se configurarán cuando el área las apruebe |

## B. Inconsistencia de alcance del requerimiento (aclarar con el solicitante)

El acta REQ-SI-2026-02 incluye criterios que pertenecen a otro tipo de solución: aplicativo de **registro manual con botón de inicio/fin por operario y registro de eventos** (criterio 1), **conexión a Power BI** y **visualización en Verdad Única** (criterios 2 y 3) — y a la vez declara fuera de alcance el desarrollo con **SAG**. Este MVP, por instrucción del área, NO construye registro nuevo para operarios, NO integra SAG, y entrega la visualización en su propia web. Queda pendiente formalizar con Elvis Luque si los criterios 1 y 3 del acta se reescriben o se tratan como fase aparte, y si Power BI se conectará después (la base PostgreSQL es conectable desde Power BI si Sistemas lo aprueba).

## C. Mejoras técnicas para después del lunes (ninguna bloquea el MVP)

1. Carga directa de archivos `.xlsx` (hoy: pegado desde Excel —la vía principal—, o archivos .txt/.tsv/.csv).
2. Servicio SMTP corporativo en Supabase para invitaciones y recuperación de contraseña autogestionada (hoy: recuperación administrativa — el admin restablece la contraseña desde el panel de Supabase; si su versión del panel no permite fijarla directamente, Sistemas puede ejecutarlo en SQL Editor: `update auth.users set encrypted_password = extensions.crypt('NuevaContraseña', extensions.gen_salt('bf')) where email = 'persona@presh-tech.com';`).
3. Respaldo técnico mensual con `pg_dump` (guía 4).
4. Pantalla de administración de roles dentro de la app (hoy: una línea de SQL por usuario).
5. Asignación de eventos a turnos y "ventana observada" ampliada — se activan solos al resolver A1+A2.
6. Metas y semáforos por variedad/tipo de bandeja — al resolver A8.
7. Conexión opcional a Power BI / Verdad Única — decisión de Sistemas (B).
8. Paginación con cursor si el histórico supera varios cientos de miles de filas (hoy: 28 mil; holgura amplia).

## D. Límites conocidos de los planes gratuitos (verificados en documentación oficial, oct. 2026)

- **Supabase Free:** 500 MB de base de datos (≈ varios años al ritmo actual de ~2.800 filas/mes), pausa tras ~1 semana sin actividad (se restaura con un clic; ventana de restauración de 1 año), 2 proyectos activos por cuenta, sin respaldos automáticos del panel.
- **Cloudflare Pages Free:** 500 compilaciones/mes (se usan 1–2 por actualización de la app; la importación de datos NO gasta compilaciones), tráfico de archivos estáticos sin límite práctico para uso interno.
- **GitHub Free:** repositorios privados ilimitados; subida web de hasta 100 archivos por tanda y 25 MB por archivo.
