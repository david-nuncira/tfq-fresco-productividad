# Datos ficticios de prueba

Estos archivos contienen **datos inventados** (operarios "DEMO", fincas F1/F2). No corresponden a ninguna persona real y existen solo para probar la aplicación antes de usar datos reales.

- `datos_demo.tsv` — 236 filas con el formato real del Excel, incluyendo a propósito: el encabezado con salto de línea («N°↵BANDEJA»), la columna «1630», 2 filas duplicadas exactas, 1 conflicto (la misma bandeja redigitada con otra hora), 4 filas de plantilla, 1 error `#¡REF!`, 1 fila donde conformes+no conformes≠total y 1 fila sin número de bandeja. Al importarlo debe ver: 232 eventos válidos, 4 rechazadas, 2 duplicadas, 1 conflicto.
- `horas_demo.tsv` — 30 filas de horas-persona para probar la productividad (pegar en Configuración → Horas-persona).

## Cómo probar sin contaminar producción

1. Importe `datos_demo.tsv` (ábralo con el Bloc de notas, copie todo y péguelo; o use «Subir archivo»).
2. Pruebe los reportes, el conflicto pendiente y la exportación.
3. Al terminar la prueba, vaya a **Importaciones y calidad → Lotes** y **anule** el lote demo (motivo: "fin de prueba"). Los datos demo dejan de contar de inmediato y queda la constancia.

Nunca pegue datos demo y reales en el mismo lote.
