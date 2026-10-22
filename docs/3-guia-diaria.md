# Guía 3 · Uso diario: copiar, pegar, validar y consultar

Rol necesario para importar: **analista** o **admin**. Los **lectores** consultan todo pero no importan.

## 1. Copiar desde el Excel

1. Abra el Excel de Control Pasmado de siempre (los operarios no cambian nada de su rutina).
2. Seleccione **desde la fila de títulos** hasta la última fila con datos (clic en la celda del primer título, luego Ctrl+Shift+Fin suele servir; verifique que la selección no corte columnas).
3. Ctrl+C.

Puede copiar **todo el histórico completo o solo lo nuevo**: da igual. La aplicación reconoce lo ya importado y no lo duplica. Ante la duda, copie de más.

## 2. Pegar y analizar

1. En la aplicación: menú **Importar** → clic dentro del recuadro → Ctrl+V. (Alternativa: botón "Subir archivo" con un `.txt`/`.tsv`/`.csv`.)
2. Clic en **Analizar antes de guardar**. El análisis ocurre en su navegador: todavía no se guarda nada. Con ~30.000 filas tarda unos segundos y muestra avance.

## 3. Leer la vista previa (qué significa cada número)

| Conteo | Significado | Qué hacer |
|---|---|---|
| Filas recibidas | Todo lo pegado (sin el encabezado) | — |
| Eventos de bandeja válidos | Filas que cuentan como bandejas procesadas | — |
| Rechazadas | Plantillas sin bandeja ni cantidades, filas vacías, encabezados repetidos | Normal en el formato actual; descargue el CSV si quiere revisarlas. **No** restan producción real |
| Con advertencias | Se importan, pero marcadas (p. ej. `#¡REF!`, cantidades incompletas, sin fecha) | Revisables luego en Detalle y en Calidad |
| NUEVAS | No existen en la base | Se insertarán |
| Ya importadas | Idénticas a algo ya guardado | Se omiten (por esto reimportar es seguro) |
| Posibles conflictos | Misma identidad (producción+tanque+posición+bandeja) con contenido distinto | Se guardan aparte y NO tocan el dato existente hasta que usted decida |

3. Clic en **Confirmar e importar**. La subida va por partes con barra de avance; al finalizar, el lote se confirma y los reportes se actualizan.

**Si se corta la luz/el internet a mitad de subida:** no pasa nada grave. Lo subido queda en un lote *pendiente* que NO cuenta en los indicadores. Puede (a) pegar de nuevo lo mismo y reintentar —lo ya guardado se reconoce y no se duplica—, o (b) descartar el lote pendiente en **Importaciones y calidad**.

## 4. Resolver conflictos (cuando los haya)

Menú **Importaciones y calidad → Conflictos pendientes**. Cada conflicto muestra el registro existente y el nuevo, lado a lado, con las diferencias resaltadas. Tres decisiones posibles:

- **Mantener existente** — el nuevo era un error de digitación; se descarta (queda constancia).
- **Aplicar nuevo como corrección** — el nuevo es la versión buena (p. ej. corrigieron la hora o una cantidad). El valor anterior NO se pierde: queda en el historial de revisiones con autor y fecha.
- **Son dos eventos reales** — de verdad ocurrió dos veces (misma posición y bandeja, otra pasada). Ambos cuentan desde ese momento.

En caso de duda, pregunte al responsable del proceso antes de decidir; el conflicto puede esperar sin dañar nada.

## 5. Anular una importación equivocada

**Importaciones y calidad → Lotes → Anular** (pide motivo). Solo excluye los eventos que ESE lote insertó y revierte sus correcciones; jamás borra lo aportado por otros lotes. Todo queda registrado (quién, cuándo, por qué).

## 6. Consultar

- **Resumen**: tarjetas y evolución diaria. Todo responde a los filtros de arriba (rango y **tipo de fecha**, rol, operario, finca, variedad, tanque, líquido, tipo de bandeja).
- **Tipo de fecha**: "producción" (recomendada: está en el 100% de las filas), "cargue", o "FECHA (registro)" — esta última pertenece a una etapa sin confirmar y está vacía en ~19% del histórico; el tablero le avisa cuántos eventos quedan fuera por eso.
- **Comparativos**: ranking de volumen, calidad por operario y, separado, ranking de productividad (solo si hay horas-persona cargadas). Las diferencias son señales para investigar, no veredictos.
- **Detalle**: búsqueda, paginación y **Exportar CSV**, que exporta TODO lo filtrado (no solo la página visible). El CSV se abre en Excel; los valores que parecen fórmulas van neutralizados por seguridad.
- **Importaciones y calidad → Calidad**: inconsistencias código/nombre (p. ej. un código con 14 nombres distintos), advertencias agregadas y exclusiones.

## 7. Horas-persona (para que exista productividad)

Solo si el área dispone de una fuente **ya existente y validada** (jornadas, nómina): **Configuración → Horas-persona**, pegue `fecha · código · rol · horas` e indique la fuente (obligatorio). No se le pide nada nuevo a los operarios. Sin horas, la app muestra "No calculable con los datos actuales" — eso es correcto, no un error.

## Reglas de oro

1. Copie siempre **incluyendo la fila de títulos**.
2. No cambie el significado de las columnas del Excel sin avisar: la app tolera tildes/mayúsculas/espacios y las variantes conocidas, pero una columna nueva con otro sentido requiere ajuste.
3. Reimportar nunca duplica; anular nunca borra en silencio; corregir nunca pierde el valor anterior.
4. Use la app al menos una vez por semana o el proyecto gratuito de Supabase se pausará (se reactiva con un clic, ver guía 4).
