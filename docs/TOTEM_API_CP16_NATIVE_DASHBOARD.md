# CP16 — Dashboard nativo

CP16 crea una proyección API del dashboard para la implementación nativa Swift. El dashboard React/Next.js actual permanece como fuente de verdad funcional y visual, y continúa operativo en la ruta raíz (`/`). El endpoint es de solo lectura, usa la misma sesión Auth.js y aplica `dashboard.read` antes de consultar datos.

## Contrato

`GET /api/v1/dashboard`

La respuesta tiene `data` y `meta.requestId`:

- `data.user` y `data.summary`: identidad, contadores, ingresos y cuentas por cobrar (las dos métricas financieras son `null` para no administradores).
- `data.pipeline`: seis etapas del contenido del mes.
- `data.agenda` y `data.priorityTasks`: hasta seis tareas cada una.
- `data.approvals`: hasta seis feedbacks/tareas que requieren revisión.
- `data.workloads`: hasta cinco personas con utilización calculada.
- `data.recentTransactions`: hasta tres movimientos, solo para `ADMIN`.

El contrato canónico vive en `src/contracts/api-contracts.ts`. `npm run api:generate` actualiza OpenAPI, el cliente TypeScript y `GeneratedAPIClient.swift` en una sola operación.

## Web React

`src/app/(dashboard)/page.tsx` conserva `HomeCommandCenter` y su carga mediante
Server Actions. Mantiene todas las cards, métricas, gráficas, pipeline, agenda,
capacidad, aprobaciones, rendimiento y finanzas de la PWA existente.

La proyección `/api/v1/dashboard` y `NativeDashboardView` se derivan de esa
pantalla. No autorizan a reemplazarla por `ApiDashboardView` ni por una versión
reducida. React/Next.js es la referencia de paridad para Swift.

La implementación nativa contempla:

- `loading`: skeleton y `aria-busy`.
- `empty`: estado “Todo despejado” cuando no hay clientes, tareas ni pipeline.
- `offline`: banner persistente y tarjeta de reintento cuando el navegador pierde conexión.
- `error`: mensaje de sesión/servidor y reintento.

La corrección `099f582` restauró la pantalla web completa después de que CP16 la
reemplazara indebidamente. La prueba `web-dashboard-route.test.mjs` protege esta
separación: web usa `HomeCommandCenter`; Swift consume la API nativa.

## Swift y cache

`DashboardStore` (`TotemOSKit/DashboardService.swift`) implementa stale-while-revalidate:

1. Lee `Library/Caches/TotemOS/dashboard.json` al inicializar.
2. Presenta cache mientras consulta `GET /api/v1/dashboard`.
3. Escribe atómicamente la respuesta válida.
4. Expone estados `idle`, `loading`, `loaded`, `empty`, `offline` y `error` sin borrar el último dato válido.

`NativeDashboardView` muestra materiales/translucencia, jerarquía tipográfica, tarjetas compactas y respeta “Reducir movimiento” mediante una animación de resorte desactivable. El botón `Web` activa el rollback local de la ruta `/` sin cerrar sesión.

## Feature flag y rollback

La bandera remota existente `ios_app_config` controla la ruta. Está **apagada por defecto** (`defaultMode: "web"`). Para habilitar el dashboard nativo:

```json
{
  "version": 1,
  "defaultMode": "web",
  "routes": [{ "path": "/", "mode": "native" }]
}
```

La configuración se carga en `/api/v1/app-config`. Un registro `UserRouteOverride` con `{ "path": "/", "mode": "web" }` gana sobre la bandera global y permite rollback inmediato para un usuario. El botón `Web` de Swift mantiene además un rollback local hasta el siguiente refresh del shell.

Estado de producción: `ios_app_config` está habilitada con `{ "path": "/", "mode": "native" }`. Las instalaciones que ya tienen el shell cargado deben cerrar y abrir la app, o esperar al siguiente refresh, para volver a consultar la configuración.

## Verificación

- `npm run test:unit` — contratos, cliente generado y feature flag.
- `npm run test:integration` con PostgreSQL aislado — proyección y alcance por rol.
- `npm run typecheck`, `npm run lint` y `npm run build`.
- `DashboardStoreTests` — éxito/cache, offline con cache, empty y error.
- iOS CI ejecuta build-for-testing y XCTest en simulador; el smoke test nativo puede validar `native-dashboard`, `dashboard-loading`, `dashboard-empty`, `dashboard-offline`, `dashboard-error` y `dashboard-rollback`.
