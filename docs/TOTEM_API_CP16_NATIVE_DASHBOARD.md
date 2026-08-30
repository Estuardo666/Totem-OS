# CP16 — Contrato de dashboard + shell híbrido

CP16 crea una proyección API del dashboard y consolida el shell Swift sobre el
WebView. El dashboard React/Next.js actual es la única implementación de Home y
continúa operativo en la ruta raíz (`/`). El endpoint es de solo lectura, usa la
misma sesión Auth.js y aplica `dashboard.read` antes de consultar datos.

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

La proyección `/api/v1/dashboard` puede alimentar futuras optimizaciones, pero no
autoriza a reemplazar Home por `NativeDashboardView`, `ApiDashboardView` ni una
versión reducida. React/Next.js es la referencia funcional, visual y de estados.

Los estados `loading`, `empty`, `offline` y `error` siguen siendo los de la
implementación React existente y no se duplican en Swift.

La corrección `099f582` restauró la pantalla web completa después de que CP16 la
reemplazara indebidamente. La prueba `web-dashboard-route.test.mjs` protege esta
decisión: Home y las páginas internas usan `HomeCommandCenter`/React; Swift solo
superpone el shell.

## Swift y cache

`DashboardStore` (`TotemOSKit/DashboardService.swift`) conserva la proyección
stale-while-revalidate como prototipo no presentado en runtime:

1. Lee `Library/Caches/TotemOS/dashboard.json` al inicializar.
2. Presenta cache mientras consulta `GET /api/v1/dashboard`.
3. Escribe atómicamente la respuesta válida.
4. Expone estados `idle`, `loading`, `loaded`, `empty`, `offline` y `error` sin borrar el último dato válido.

`NativeDashboardView` queda fuera del runtime. No existe un botón ni una bandera
que pueda sustituir Home React durante esta fase.

## Feature flag y rollback

El contrato remoto `ios_app_config` se conserva para compatibilidad futura, pero
la app iOS mantiene las migraciones de pantallas pausadas con
`nativeScreenMigrationsEnabled = false`. Por ello, aunque una instalación tenga
un registro antiguo con `/` en `native`, el runtime fuerza Home y todas las
rutas privadas al WebView React.

Ejemplo histórico de la configuración que podría habilitar una migración futura
(no se activa mientras la compuerta esté en `false`):

```json
{
  "version": 1,
  "defaultMode": "web",
  "routes": [{ "path": "/", "mode": "native" }]
}
```

La configuración se carga en `/api/v1/app-config` y los registros
`UserRouteOverride` se conservan para compatibilidad. En esta fase no hay botón
`Web` de Swift ni rollback de pantalla nativa: todas las rutas ya son React.

Estado de producción: la configuración antigua puede seguir almacenando una
regla `native`, pero ya no activa una pantalla Swift. Para reabrir una migración
nativa se necesitará una decisión explícita, paridad documentada y un cambio de
esta compuerta.

## Verificación

- `npm run test:unit` — contratos, cliente generado y feature flag.
- `npm run test:integration` con PostgreSQL aislado — proyección y alcance por rol.
- `npm run typecheck`, `npm run lint` y `npm run build`.
- `DashboardStoreTests` — éxito/cache, offline con cache, empty y error del
  prototipo de datos.
- iOS CI valida el shell y la navegación React; no se exige un smoke test de
  `native-dashboard` mientras la compuerta permanezca desactivada.
