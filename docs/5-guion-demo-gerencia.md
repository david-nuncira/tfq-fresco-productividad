# Guía 5 · Guion de demostración para gerencia (~10 minutos)

**Preparación previa (la noche anterior):** histórico real ya importado, lote demo anulado, sesión iniciada, pestañas listas. Tenga el celular a la mano para el cierre.

---

**1. El problema (1 min)**
"Hoy el proceso fisicoquímico registra cada bandeja en Excel, pero no tenemos forma de consolidar ni comparar productividad. Esta herramienta consolida ese mismo Excel —sin pedirle nada nuevo a los operarios— y lo deja consultable para todos, con control de acceso."

**2. Resumen ejecutivo (2 min)** — abra *Resumen*
- Señale las tarjetas: bandejas procesadas, cabezas conformes/no conformes, % de conformidad, cobertura.
- Mueva el rango de fechas y un filtro (p. ej. variedad): "todo el tablero responde a los mismos filtros, calculado sobre TODOS los registros, no sobre una muestra".
- Señale la línea diaria: "aquí se ven los picos y caídas de volumen por día".

**3. Comparativos (2 min)** — abra *Comparativos*
- Ranking de volumen por ensamblador y la tabla con % de conformidad y días de muestra.
- Mensaje clave (dicho tal cual): "estas diferencias son señales para investigar en condiciones comparables —variedad, tipo de bandeja—; la herramienta no acusa a nadie, ordena la conversación".
- Cambie el rol a pasmador: "las dos funciones se miran por separado; nunca se suman como si fueran bandejas distintas".

**4. Honestidad del dato (2 min)** — el diferenciador
- Muestre el aviso de productividad: "la fuente actual no registra horas trabajadas; por eso la app dice 'No calculable' en vez de inventar un número. El día que Logística entregue jornadas validadas, se pegan en Configuración y la productividad por hora-persona aparece sola, con la fórmula correcta: producción elegible ÷ horas elegibles".
- Abra *Importaciones y calidad → Calidad*: "la herramienta también destapa los problemas del registro: códigos con varios nombres, errores #¡REF!, cantidades inconsistentes. Eso es oportunidad de mejora del proceso, medida y visible".

**5. Confiabilidad (2 min)** — abra *Importar* con un rango pequeño ya copiado
- Pegue y analice en vivo: "la vista previa dice qué es nuevo, qué ya existía y qué entra en conflicto; nada se guarda sin confirmación".
- Reimporte algo ya importado: "0 nuevas — reimportar jamás infla los indicadores".
- Si hay un conflicto pendiente, muéstrelo: "cuando una fila corregida llega con otra hora, la app no la pisa ni la duplica: la pone lado a lado y una persona decide; el valor anterior queda en el historial".

**6. Acceso y cierre (1 min)**
- Abra la dirección en el celular: "funciona desde cualquier dispositivo, con usuario y contraseña; hay roles de administrador, analista y lector".
- Cierre: "costo de operación: cero pesos en infraestructura (planes gratuitos con límites que nos dan años a este volumen). Lo que sigue necesita decisiones del área, no más software: confirmar la etapa de la marca horaria, los turnos y la fuente de horas". (Tenga impresa la guía 6.)

---

## Preguntas que probablemente harán (y respuestas honestas)

- **"¿Cuántas bandejas por hora hace cada operario?"** — "Con el Excel actual no se puede saber: no registra horas trabajadas. La app lo dirá en cuanto exista la fuente de jornadas validada; mientras tanto mostramos volumen real, no estimaciones."
- **"¿Y los turnos?"** — "No hay horarios oficiales cargados ni está confirmado qué significa la hora del Excel (encontramos marcas arrastradas). En cuanto el responsable los confirme, se configuran sin tocar código."
- **"¿Esto reemplaza el Excel?"** — "No. El Excel sigue siendo el registro; esto lo consolida y lo protege. Cero recarga para los operarios."
- **"¿Qué pasa si alguien importa dos veces o se equivoca?"** — "Reimportar no duplica; una importación equivocada se anula con motivo y trazabilidad, sin tocar lo de otros lotes."
- **"¿Quién ve esto?"** — "Solo usuarios creados por el administrador; un lector no puede modificar nada ni siquiera llamando a la base directamente."
- **"¿Qué cuesta?"** — "Hoy $0: GitHub, Cloudflare Pages y Supabase en planes gratuitos. El límite relevante es 500 MB de base (varios años a este ritmo) y una pausa por inactividad que se evita usándola cada semana."
