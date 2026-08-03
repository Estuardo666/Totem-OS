# QA report — filtros de Finanzas

Fecha: 2026-08-03  
URL: http://localhost:3000/finance  
Framework: Next.js 15  
Alcance: filtros de período, cliente, servicio y acción “Limpiar”.  
Sesión: usuario de prueba autenticado; credenciales omitidas.

## Resultado

Health score del alcance después de la corrección: 96/100

| Control | Resultado | Evidencia |
|---|---|---|
| Período | Corregido | Julio carga valores y comparativas distintos de agosto en los cuatro KPIs. |
| Cliente | Corregido | “Acunar” actualiza KPIs, tabla, cartera y bloques dependientes. |
| Servicio | Corregido | “Contenido para redes” recalcula KPIs mediante la distribución contractual de entregables. |
| Limpiar | Corregido | Restablece controles, datos iniciales y el indicador “0 filtros activos”. |

## Verificación posterior

- Período: aprobado; los cuatro KPIs cambian al seleccionar el mes anterior.
- Cliente: aprobado; los cuatro KPIs cambian para el cliente seleccionado.
- Servicio: aprobado; los cuatro KPIs cambian y se muestra la nota sobre el criterio de distribución.
- Limpiar: aprobado; restaura exactamente los valores iniciales y muestra `0 filtros activos`.
- Build de producción: aprobado con `npm run build`.
- Evidencia final: [dashboard corregido](./screenshots/filters-fixed.png).

## Hallazgos originales (resueltos)

### FIN-FILTER-001 — El período no actualiza los datos financieros

Severidad: Alta — Resuelto  
Categoría: Funcional

Pasos reproducidos:

1. Abrir Finanzas con sesión autenticada.
2. Registrar el KPI “Ingresos netos del mes”: `$125`, `-93.4%`.
3. Cambiar Período de “agosto de 2026” a “julio de 2026”.
4. Revisar el mismo KPI.

Resultado observado: el selector cambia correctamente a “julio de 2026”, pero el KPI mantiene exactamente `$125` y `-93.4%`. No se observa una recarga de datos correspondiente al período seleccionado.

Evidencia: [estado inicial](./screenshots/filters-default.png), [julio seleccionado](./screenshots/filters-period-july-unchanged-kpi.png).

### FIN-FILTER-002 — El indicador de filtros activos no representa el estado real

Severidad: Media — Resuelto  
Categoría: UX / Contenido

Pasos reproducidos:

1. Abrir Finanzas con los valores por defecto.
2. Pulsar “Limpiar”.
3. Revisar el indicador junto a los selectores.

Resultado observado: los selectores vuelven a “agosto de 2026”, “Todos los clientes” y “Todos los servicios”, pero la interfaz sigue mostrando “3 filtros activos”.

Evidencia: [después de limpiar](./screenshots/filters-after-clear.png).

## Notas

- El filtro de cliente sí modifica la tabla: de 5 filas a 1 al seleccionar “Acunar”.
- El filtro de servicio sí modifica la tarjeta “Estructura de costos”.
- Ambos filtros son parciales porque no actualizan la primera fila de KPIs, contradiciendo el comportamiento esperado de filtros globales.
- Se registró un error intermitente de WebSocket: `WebSocket is already in CLOSING or CLOSED state.` No bloqueó la interacción de filtros.
- Los errores de filtros descritos en este reporte fueron corregidos y revalidados en una sesión autenticada nueva.

## Verificación visual posterior — Finanzas

- Encabezado: aprobado; la página ahora usa `PageHeader` con título, descripción y breadcrumbs.
- Fondo: aprobado; el shell de Finanzas es transparente y deja ver el fondo global en claro y oscuro.
- Dark mode: aprobado; títulos, textos secundarios, bordes, tarjetas y controles usan tokens legibles en el tema oscuro.
- Navegación interna: aprobado; el menú usa una cuadrícula responsive y no genera scroll horizontal en desktop.
- Contenido: aprobado; se eliminó el eyebrow `Lectura ejecutiva`.
- Evidencia: [tema claro](./screenshots/finance-light-fixed.png), [tema oscuro](./screenshots/finance-dark-fixed.png).

Nota de consola: durante la prueba en `localhost:3002` aparecieron avisos ya existentes por recursos/configuración que apuntan a `localhost:3000` y Speed Insights en entorno local. No bloquearon la renderización ni las interacciones del dashboard.

## Ajuste responsive posterior

- Navegación móvil: aprobado; slider horizontal con `snap`, scrollbar oculto y enlaces de 36px de alto.
- CTA móvil: aprobado; “Nueva transacción” ocupa el ancho disponible y conserva una altura táctil de 46px.
- Cards: aprobado; las cards principales se distribuyen 50/50 en móvil y las terceras cards de filas impares ocupan 100%.
- Overflow: aprobado; la página mantiene `scrollWidth` igual al viewport en 390px.
- Evidencia: [dashboard móvil](./screenshots/finance-mobile-fixed.png).
