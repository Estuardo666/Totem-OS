# CP01 — Inventario técnico de Totem OS

Fecha de corte: 2026-08-28  
Rama: `main`  
Commit de referencia: `ae08d55`

Este inventario es la base de la migración. Los conteos se obtuvieron leyendo el
árbol actual; antes de cada checkpoint se debe actualizar si el código cambió.

## Resumen

| Área | Estado actual | Conteo |
|---|---|---:|
| Server Action modules | Lógica de negocio acoplada a `use server` | 30 módulos |
| Server Action exports | Operaciones a convertir en casos de uso/API | 212 funciones |
| Route Handlers | Integraciones, auth, cron y algunos recursos | 26 rutas |
| Páginas `page.tsx` | UI React existente | 41 páginas |
| Modelos Prisma | Persistencia compartida | 49 modelos |
| Pruebas automatizadas | Node + Playwright + XCTest | 8 archivos principales |
| Swift funcional | Shell/login/push/WebView híbrido | 17 archivos Swift |

## Dominios y destino

| Dominio | Código actual | Funciones | Destino inicial |
|---|---|---:|---|
| Dashboard | `dashboard-actions.ts`, `dashboard-task-actions.ts`, `workload-actions.ts` | 3 | CP16 |
| Clientes | `client-actions.ts`, `client-feedback-actions.ts`, `contract-actions.ts` | 27 | CP17 |
| Contenido | `content-actions.ts`, `content-strategy-actions.ts`, `metrics-actions.ts` | 24 | CP18 |
| Rodajes | `shooting-actions.ts` | 9 | CP19 |
| Chronos | `time-tracking.ts` | 5 | CP20 |
| Notificaciones/push | `notification-actions.ts`, `push-actions.ts` | 18 | CP21 |
| Usuarios/roles | `user.actions.ts`, `admin/user-actions.ts`, `admin/role-actions.ts`, `admin/specialty-actions.ts` | 21 | CP05/CP26 |
| Sesión | `session-actions.ts` | 2 | CP04 |
| Finanzas | `finance-actions.ts`, `finance-funds-actions.ts`, `finance-settings-actions.ts`, `finance-alerts-actions.ts`, `finance-honorarios-actions.ts` | 61 | CP23–CP25 |
| Facturación | `admin/facturacion/*.ts` | 15 | CP28 |
| IA/generación | `ai-actions.ts`, `generator-actions.ts` | 4 | CP27 |
| Integraciones | `meta-actions.ts`, `uploadthing-actions.ts`, `voice-actions.ts` | 17 | CP14/CP27 |
| Administración/configuración | `admin-actions.ts` | 10 | CP26 |
| Otros contratos | `content-actions.ts`, `finance-actions.ts`, `metrics-actions.ts` | incluidos arriba | revisión CP01 |

## Server Actions por módulo

| Archivo | Exportaciones |
|---|---:|
| `content-actions.ts` | 15 |
| `client-actions.ts` | 20 |
| `finance-actions.ts` | 39 |
| `finance-funds-actions.ts` | 12 |
| `notification-actions.ts` | 11 |
| `admin-actions.ts` | 10 |
| `shooting-actions.ts` | 9 |
| `user.actions.ts` | 8 |
| `metrics-actions.ts` | 7 |
| `push-actions.ts` | 7 |
| `meta-actions.ts` | 7 |
| `client-feedback-actions.ts` | 6 |
| `admin/facturacion/configuracion.ts` | 9 |
| `time-tracking.ts` | 5 |
| `admin/user-actions.ts` | 5 |
| `finance-alerts-actions.ts` | 5 |
| `admin/facturacion/facturas.ts` | 6 |
| `voice-actions.ts` | 3 |
| `uploadthing-actions.ts` | 3 |
| `ai-actions.ts` | 3 |
| `finance-settings-actions.ts` | 3 |
| `admin/role-actions.ts` | 4 |
| `admin/specialty-actions.ts` | 4 |
| `session-actions.ts` | 2 |
| `finance-honorarios-actions.ts` | 2 |
| `content-strategy-actions.ts` | 2 |
| `workload-actions.ts` | 1 |
| `dashboard-task-actions.ts` | 1 |
| `dashboard-actions.ts` | 1 |
| `contract-actions.ts` | 1 |
| `generator-actions.ts` | 1 |

## Route Handlers existentes

### Autenticación y dispositivos

- `/api/auth/[...nextauth]`
- `/api/auth/google`
- `/api/auth/google/callback`
- `/api/auth/callback/meta`
- `/api/push/subscribe`
- `/api/push/search-users`
- `/api/push/apns`

### Integraciones y métricas

- `/api/google-calendar/connect`
- `/api/google-calendar/status`
- `/api/google-calendar/disconnect`
- `/api/google-calendar/webhook`
- `/api/metrics/[clientId]/latest`
- `/api/uploadthing`

### Facturación

- `/api/facturacion/productos`
- `/api/facturacion/clientes`
- `/api/facturacion/[id]/xml`
- `/api/facturacion/[id]/pdf`
- `/api/facturacion/[id]/estado`
- `/api/facturacion/worker/latido`

### Cron/jobs

- `/api/cron/shooting-reminders-morning`
- `/api/cron/shooting-reminders-hourly`
- `/api/cron/cobranza-check`
- `/api/cron/daily-digest`
- `/api/cron/monthly-payments`
- `/api/cron/calendar-webhook-renew`

Estos handlers no se eliminan durante CP03. Se migran a la frontera común solo
cuando corresponda: API pública versionada para recursos, endpoints internos
protegidos para jobs y rutas de webhook con verificación de firma propia.

## Páginas React

### Operación diaria

- `/`
- `/clients`
- `/clients/new`
- `/clients/[id]`
- `/clients/[id]/report`
- `/content`
- `/content/new`
- `/content/dashboard`
- `/content/shoots`
- `/content/generator`
- `/chronos`

### Finanzas

- `/finance`
- `/finance/personal`
- `/finance/transactions`
- `/finance/expenses`
- `/finance/receivables`
- `/finance/monthly-summary`
- `/finance/monthly-close`
- `/finance/settlement`
- `/finance/profits`
- `/finance/utilidades`
- `/finance/alerts`
- `/finance/settings`
- `/finance/ai-analytics`

### Administración y facturación

- `/admin/users`
- `/admin/files`
- `/admin/notifications`
- `/admin/settings`
- `/admin/settings/integrations`
- `/admin/facturacion`
- `/admin/facturacion/productos`
- `/admin/facturacion/configuracion`
- `/admin/facturacion/facturas`
- `/admin/facturacion/facturas/nueva`
- `/admin/facturacion/facturas/[id]`

### Públicas/auth

- `/sign-in`
- `/sign-up`
- `/reports/share/[token]`
- `/privacy`
- `/terms`

## Modelos Prisma por dominio

### Identidad

`User`, `Role`, `Account`, `Session`, `VerificationToken`, `Specialty`.

### Operación

`Client`, `Credential`, `ContentTask`, `Shoot`, `BrandAsset`,
`ClientFeedback`, `ClientBillingException`, `ClientMonthlyStrategy`,
`TaskMetrics`, `VoiceNote`, `TimeEntry`.

### Finanzas

`Expense`, `Payroll`, `Invoice`, `Transaction`, `InternalTransfer`,
`ClientMonthlyClosure`, `ProfitDistribution`, `ProfitDistributionItem`,
`EmergencyFundMovement`, `FinanceAlert`, `FinanceAlertRule`.

### Plataforma y comunicación

`Notification`, `GlobalConfig`, `CompanyConfig`, `PushSubscription`,
`OneSignalPlayer`, `ApnsDeviceInstallation`, `WorkerLatido`.

### Integraciones

`GoogleCalendarToken`, `AgencyMetaAccount`, `ClientMetric`.

### Facturación electrónica

`SecuencialComprobante`, `ProductoFacturacion`, `ElectronicInvoice`,
`ElectronicInvoiceItem`, `CreditNote`, `CreditNoteItem`, `ElectronicRetention`,
`SriJob`, `EmailEnviado`.

## Estado Swift actual

| Componente | Función actual | Cambio previsto |
|---|---|---|
| `AppModel` | Login, conexión y APNs | Coordinar sesión/API/sync además del push |
| `NativeAuthService` | Credentials Auth.js y cookies | Reutilizar para cliente API |
| `ShellModel` | Snapshot JavaScript y comandos WebView | Convertirse en estado nativo; bridge legacy |
| `WebAppView` | WebView principal | Renderer permanente de las pantallas React |
| `NativeShellOverlay` | Header, tabs, menú, notificaciones | Conservar visualmente; consumir AppCoordinator |
| `ShellContracts` | Rutas/snapshot/comandos web↔Swift | Mantener para navegación, sesión y shell React |
| `PushRegistrationService` | APNs | Reutilizar con API/estado de sesión |
| Tests XCTest | Shell y APNs | Añadir API, SwiftData, sync y UI tests |

## Cobertura existente y gaps de CP01

La matriz preliminar de autorización quedó documentada en
[`TOTEM_API_PERMISSION_MATRIX.md`](./TOTEM_API_PERMISSION_MATRIX.md). Distingue
permisos observados en el código, permisos objetivo y decisiones que deben
confirmarse antes de cerrar CP05. Los hallazgos de normalización (`role` versus
`roleLegacy`), el fallback de middleware y la comprobación en minúsculas de
`session-actions.ts` quedan registrados como gates de CP04–CP05.

Actualmente existen pruebas para:

- Contrato de shell web↔iOS.
- Contrato de payload APNs.
- Acceso estratégico financiero.
- Invariantes de distribución financiera.
- Autenticación del worker.
- Cliente iOS y contrato general del shell.

Todavía no existe cobertura automatizada para:

- API de clientes, contenido, rodajes o Chronos.
- Matriz completa de autorización por endpoint.
- PostgreSQL de integración.
- OpenAPI y decodificación Swift.
- Sync pull/push/bootstrap.
- Idempotencia y conflictos.
- SwiftData/outbox/crash recovery.
- XCUITest funcional.

## Reglas de clasificación

- **Offline editable:** clientes sin secretos, tareas, rodajes y Chronos.
- **Offline lectura:** dashboards, métricas y datos resumidos.
- **Online-only:** credenciales, P12, SRI, IA, integraciones externas y acciones
  irreversibles.
- **Sensible:** credenciales, tokens, información fiscal y datos bancarios; no se
  guardan en SwiftData ni se imprimen en logs.
- **Irreversible:** pagos, cierres, distribución, emisión/anulación SRI y borrados
  críticos; requieren servidor online y auditoría.

## Criterio de salida de CP01

- [x] Conteo de módulos, funciones, rutas, páginas y modelos documentado.
- [x] Cada dominio tiene destino de checkpoint.
- [x] Componentes Swift actuales identificados.
- [x] Gaps de pruebas registrados.
- [x] Datos sensibles y operaciones offline clasificados.
- [x] Reglas observables y ambigüedades de permisos documentadas en la matriz;
      las decisiones de producto pendientes están bloqueadas explícitamente para
      CP05 y no se inventan en este inventario.
