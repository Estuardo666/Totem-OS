# Totem OS — Matriz de permisos para API y clientes

Fecha de corte: 2026-08-28  
Estado: baseline de CP01; se convierte en política ejecutable en CP04–CP05.

Este documento separa lo que el código actual permite de lo que todavía necesita
decisión de producto. La API nueva debe aplicar la columna **objetivo** mediante
capacidades; nunca debe copiar una comprobación aislada de un Server Action.

## Roles canónicos

| Rol | Alcance objetivo | Acceso offline inicial |
|---|---|---|
| `ADMIN` | Toda la operación, administración, finanzas, facturación e integraciones, sujeto a auditoría. | Lecturas y edición de operación diaria; nunca secretos ni cierres irreversibles. |
| `EDITOR` | Operación diaria y recursos asignados; sin administración ni acciones financieras estratégicas. | Clientes no sensibles, tareas asignadas, rodajes y Chronos. |
| `USER` | Acceso explícitamente concedido por capacidad; no se asume acceso por defecto. | Solo datos propios o asignados tras validación de capacidad. |

`USER` se incluye porque existe en el contrato del shell, aunque el código actual
parece trabajar principalmente con `ADMIN` y `EDITOR`. El guard de API será
default-deny y cualquier capacidad de `USER` deberá quedar documentada.

## Matriz por dominio

| Dominio / operaciones actuales | Evidencia actual | Objetivo API | Clasificación |
|---|---|---|---|
| Sesión: `forceLogoutAllSessionsAction`, `forceLogoutUserAction` | `src/actions/session-actions.ts:16-72`; compara `role === "admin"` en minúsculas. | `session.read`, `session.revoke_self`; `session.revoke_any` solo `ADMIN`. Normalizar rol en CP05. | Online-only; sensible |
| Usuarios, roles y especialidades | `src/actions/admin/user-actions.ts`, `admin/role-actions.ts`, `admin/specialty-actions.ts`; mutaciones exigen `role === "ADMIN"`. | Lectura/mutación de usuarios, roles y especialidades: `ADMIN` únicamente. | Online-only; sensible |
| Configuración, marca y conexión IA | `src/actions/admin-actions.ts:25-35,156-240,387-740`; la mayoría de mutaciones exige `roleLegacy === "ADMIN"`. | `settings.read` puede dividirse por sección; mutaciones y prueba IA: `ADMIN`. | Online-only; sensible |
| Clientes | `src/actions/client-actions.ts`; altas/bajas/configuraciones admin en líneas 180-314 y 1515+, lecturas/edición operativa con sesión. | `clients.read`; `clients.create/update` según alcance operativo; `clients.delete`, credenciales y configuración avanzada: `ADMIN`. | Edición offline salvo secretos |
| Credenciales de clientes | `src/actions/client-actions.ts:1184-1313`; acceso por sesión, sin guard de rol uniforme. | `credentials.read/write` solo online, `ADMIN` o capacidad explícita futura; jamás persistir en SwiftData. | Online-only; sensible |
| Contenido/tareas | `src/actions/content-actions.ts`; filtra por usuario asignado para `EDITOR` y permite acciones admin puntuales. | `content.read`; `content.create/update` por asignación/capacidad; `content.delete`, métricas globales y cambios masivos: `ADMIN`. | Edición offline; borrado sensible |
| Estrategia y métricas | `content-strategy-actions.ts`, `metrics-actions.ts`; mezcla lecturas por sesión y acceso admin según caso. | Estrategia/métricas del cliente solo si el actor tiene relación o capacidad; sincronización externa online-only. | Lectura offline; integración online |
| Rodajes | `src/actions/shooting-actions.ts:97-525`; operaciones autenticadas, sin guard de rol uniforme. | `shoots.read/create/update` por relación/asignación; cancelar/borrar requiere capacidad y auditoría; duplicar sigue permiso de escritura. | Edición offline; cancelar/borrar sensible |
| Chronos | `src/actions/time-tracking.ts:150-531`; entradas propias por `session.user.id`; reportes pueden recibir `userId`. | `time.self.read/write` para datos propios; `time.team.read` y salario mensual solo `ADMIN` salvo política explícita. | Edición offline; salario sensible |
| Notificaciones | `src/actions/notification-actions.ts:162-438`; lecturas/marcar como leída por `session.user.id`; avisos a admins consultan `roleLegacy`. | `notifications.self.read/write`; broadcast y digest solo servicio interno o `ADMIN`; push requiere dispositivo propio o capacidad. | Offline lectura; push online |
| Voz | `src/actions/voice-actions.ts:11-115`; crear/listar/borrar por propietario. | `voice.self.read/write` únicamente al propietario; almacenamiento local temporal y cifrado si se habilita offline. | Offline editable; datos personales |
| Meta | `src/actions/meta-actions.ts:13-332`; seis operaciones permiten `ADMIN`/`EDITOR`, desconexión exige `ADMIN`. | Conectar/listar/vincular: `ADMIN` o `EDITOR` con capacidad de integración; desconectar y tokens: `ADMIN`. | Online-only; sensible |
| Finanzas operativas | `src/actions/finance-actions.ts:246-855`; varias lecturas por sesión, mutaciones con controles mixtos. | Lecturas personales según actor; crear/editar movimientos requiere capacidad financiera; no sincronizar secretos. | Online-only; sensible |
| Finanzas estratégicas/cierres | `finance-actions.ts:910-1451`, `finance-funds-actions.ts`, `finance-honorarios-actions.ts`, `finance-settings-actions.ts`, `finance-alerts-actions.ts`. | `ADMIN` únicamente para cierres, distribución, fondos, honorarios, reglas y ajustes; todas las acciones irreversibles online. | Online-only; irreversible |
| Facturación electrónica/SRI | `src/actions/admin/facturacion/*.ts` y `src/app/api/facturacion/*`; emisión/anulación y P12. | `ADMIN` + verificación de idempotencia/auditoría; P12 nunca sale al cliente móvil. | Online-only; sensible/irreversible |
| Uploads | `src/actions/uploadthing-actions.ts`; operaciones dependen de sesión/integración. | Lectura/borrado según propietario o `ADMIN`; URLs firmadas y expirables. | Online-only; sensible |
| IA/generadores | `src/actions/ai-actions.ts`, `generator-actions.ts`; deben operar con sesión y límites. | Capacidad por dominio, cuota y rate limit; nunca offline; resultados pueden almacenarse como borrador. | Online-only; coste controlado |
| Jobs, cron y webhooks | `src/app/api/cron/*`, `/api/google-calendar/webhook`, worker SRI. | No usar sesión de usuario; secreto de servicio/firma, idempotencia y allowlist de origen. | Online-only; irreversible potencial |

## Reglas de autorización que deben quedar centralizadas

1. `ApiActor` se construye una sola vez desde Auth.js y expone `userId`, rol
   canónico, capacidades, tenant/contexto y `requestId`.
2. Cada endpoint declara capacidades requeridas y alcance de recurso. El guard
   rechaza por defecto capacidades ausentes (`401` sin sesión, `403` sin permiso).
3. Las comprobaciones de propietario/asignación son adicionales al rol; nunca se
   sustituyen por un `ADMIN || EDITOR` global.
4. Las mutaciones irreversibles requieren conexión, idempotency key, auditoría y
   confirmación explícita; el cliente no las encola offline.
5. Los logs no incluyen cookies, tokens, P12, credenciales ni datos bancarios.

## Inconsistencias detectadas (gates de CP04–CP05)

| Hallazgo | Riesgo | Decisión de implementación |
|---|---|---|
| Se usan `session.user.role` y `session.user.roleLegacy` indistintamente. | Un actor puede recibir permisos distintos según la función. | Crear `ApiActor` y normalizador único; `roleCode` canónico en CP05. |
| `session-actions.ts` compara `"admin"` en minúsculas. | Revocación de sesiones puede quedar bloqueada para un admin real. | Cubrir con prueba de autorización y corregir durante CP05. |
| `middleware.ts` asigna `EDITOR` cuando no hay rol y hace fail-open en `catch`. | Acceso excesivo si el contexto de sesión falla. | API nunca hereda ese fallback; registrar corrección prioritaria en CP04. |
| El modelo Prisma `Role` no está relacionado directamente con `User`; se agrupa por `roleLegacy`. | El catálogo de roles no es la fuente efectiva de autorización. | `roleCode`/capacidades como fuente única, con dual-write temporal. |
| `meta-actions.ts` permite `EDITOR` sin distinguir lectura, vinculación y token. | Exposición de integración y secretos. | Separar capacidades por operación; tokens solo online y nunca en SwiftData. |
| El shell filtra navegación por `ADMIN`, pero la visibilidad no es seguridad. | Rutas o llamadas directas pueden saltarse el menú. | Mantener shell como UX; autorización siempre en API. |

## Decisiones pendientes de producto

Estas decisiones no se pueden inferir con seguridad del repositorio y bloquean
la matriz final de CP05:

- Si un `EDITOR` puede crear clientes, rodajes o tareas fuera de los recursos
  asignados.
- Si `USER` tendrá capacidades reales o quedará como rol restringido de lectura.
- Quién puede aprobar/anular facturas, cerrar mes, distribuir utilidades y
  ejecutar retiros del fondo de emergencia.
- Si `EDITOR` puede usar Meta para vincular páginas o solo consultar métricas.
- Si los reportes compartidos y sus tokens requieren revocación/auditoría
  adicional.

## Criterio de aceptación de la matriz

- Cada endpoint nuevo referencia una capacidad de esta matriz.
- Cada excepción de rol tiene prueba automatizada (`401`, `403`, éxito y
  propiedad/asignación).
- No queda ningún fallback que convierta ausencia de rol en acceso.
- Las cinco decisiones pendientes se convierten en capacidades explícitas antes
  de cerrar CP05.
