# Totem OS — Plan maestro de migración API + SwiftUI

Este documento conserva el plan aprobado para continuar la implementación por
checkpoints. No se debe saltar un checkpoint: cada uno necesita código, pruebas,
criterio de salida y una verificación antes de iniciar el siguiente.

## Estado de ejecución

- [x] **CP01 — Inventario del sistema** (`2f34c7d`): inventario técnico y matriz
  de permisos documentados.
- [x] **CP02 — Base de pruebas backend** (`3c5d103`): migración inicial,
  PostgreSQL efímero en CI, seed determinista y smoke test Prisma.
- [x] **CP03 — Kernel `/api/v1`** (`b8e994f`): contexto común,
  envelopes, Problem Details, validación, cursor, límite de payload y endpoint
  de contrato.
- [x] **CP04 — Autenticación y capacidades** (`6b717e5`): `ApiActor`, guard
  default-deny por capacidades, CSRF doble envío y rate limiting PostgreSQL.
- [x] **CP05 — Roles canónicos** (`c951f76`): `roleCode`, backfill,
  dual-write, matriz de capacidades compartida y migración de Auth.js, React y
  Swift.
- [x] **CP06 — Contrato generado** (`ac99dc8`): registro Zod, OpenAPI 3.1,
  clientes TypeScript/Swift, fixtures compartidos y gate de breaking changes en
  CI.
- [x] **CP07 — `AppCoordinator` Swift** (`931caa6`): deployment target iOS 26,
  rutas y estado tipados, bootstrap nativo de sesión/capacidades/contadores y
  shell Swift independiente del snapshot JavaScript.

Los hashes son referencias del repositorio en la fecha de corte; si se continúa
en otra rama, conservar el contenido de los documentos aunque cambie el hash.

## Decisiones fijadas

- Backend compartido dentro de Next.js; no se crea un microservicio separado.
- API REST versionada bajo `/api/v1`.
- Zod es la fuente de validación; de Zod se genera OpenAPI y de OpenAPI se generan
  los clientes TypeScript y Swift.
- Auth.js y sus cookies siguen siendo la sesión de v1; credenciales primero,
  Google Sign-In nativo después.
- Guard central default-deny por capacidades; roles canónicos `ADMIN`, `EDITOR`
  y `USER`.
- React migra gradualmente a la API con TanStack Query.
- Swift es dueño de navegación, sesión, permisos y shell; `WKWebView` queda como
  fallback temporal.
- Sync offline usa REST normal más change feed transaccional, outbox SwiftData,
  receipts idempotentes, tombstones y conflictos `409` visibles.
- Historial de sync: 90 días; cursor vencido produce resync conservando outbox.
- Paginación por cursor: 25 por defecto, 100 máximo.
- Push offline: máximo 50 mutaciones o 1 MiB por lote, con resultado individual.
- Dinero se migra a `Decimal` y se transmite como string; JSON serializado se
  migra por dominio.
- iPhone únicamente, iOS 26+, sin iPad/macOS/Android en este programa.
- El shell Swift actual (barra inferior, header, menús y sidebar) se conserva.
- Primera fase nativa: dashboard, clientes, contenido, rodajes, Chronos y
  notificaciones.
- PostgreSQL efímero en CI; XCUITest en simulador macOS de GitHub; Codemagic para
  builds firmados y TestFlight.

## Checkpoints

### CP01 — Inventario del sistema

Catalogar pantallas, Server Actions, Route Handlers, modelos Prisma, permisos,
integraciones y efectos secundarios. Crear la matriz función → servicio →
endpoint → React → Swift y clasificar cada operación como offline, online-only,
sensible o irreversible.

Salida: ninguna función existente queda sin dominio, pantalla o criterio de
paridad.

### CP02 — Base de pruebas backend

Configurar PostgreSQL efímero, migraciones, seed determinista, limpieza y
variables de entorno de prueba. Ejecutar una operación Prisma real en CI.

Salida: CI prueba contra una base aislada y nunca contra producción.

### CP03 — Kernel `/api/v1`

Implementar contexto de request, request ID, respuestas `{ data, meta }`, Problem
Details, códigos de error, validación Zod, paginación por cursor y límites de
payload.

Salida: endpoint de prueba con éxito, validación, error, cursor y límite cubiertos.

### CP04 — Autenticación y capacidades

Reutilizar Auth.js, crear `ApiActor`, guard central default-deny, validación CSRF,
capacidades y rate limiting durable en PostgreSQL.

Salida: pruebas de `401`, `403`, sesión expirada, CSRF, capacidad insuficiente y
`429`.

### CP05 — Roles canónicos

Añadir `roleCode`, backfill desde `roleLegacy`, dual-write, matriz de capacidades
y migración de Auth.js, navegación y filtros. Mantener fallback legacy temporal.

Salida: API, React y Swift derivan permisos del mismo rol canónico.

### CP06 — Contrato generado

Registrar DTOs y endpoints Zod, generar OpenAPI 3.1, cliente TypeScript, cliente
Swift, fixtures compartidos y detección de breaking changes en CI.

Salida: ambos clientes decodifican los mismos fixtures y CI bloquea rupturas.

### CP07 — `AppCoordinator` Swift

Subir deployment target a iOS 26, crear rutas tipadas, mover sesión/permisos/
contadores a Swift y hacer que el shell consuma estado nativo.

Salida: el shell no depende de un snapshot JavaScript para existir.

### CP08 — Router híbrido y rollback

Crear `LegacyWebRouteView`, resolver rutas nativas o web mediante `/app-config`,
mantener sesión y permitir activar/desactivar rutas por usuario.

Salida: cualquier pantalla puede volver al WebView sin publicar una nueva app.

### CP09 — Modelo de sync backend

Añadir versiones, timestamps, tombstones, `SyncChange`, `SyncMutationReceipt` e
índices; registrar entidad, receipt y cambio en una transacción.

Salida: una mutación produce un único cambio observable y repetible.

### CP10 — API de sync

Implementar `/sync/pull`, `/sync/push` y `/sync/bootstrap`, conflictos `409`,
cursor vencido `410`, lotes acotados y retención/compactación de 90 días.

Salida: create/update/delete, duplicado, conflicto y resync pasan integración.

### CP11 — SwiftData y outbox

Crear modelos locales separados de DTOs, mappers, outbox persistente, snapshots
base, estados de mutación y recuperación tras cierre forzado.

Salida: una edición offline sobrevive al reinicio y se aplica una sola vez.

### CP12 — Coordinador de sync Swift

Sincronizar en inicio, foreground, conectividad y edición; pausar ante `401`,
procesar FIFO por recurso y limitar concurrencia global.

Salida: todas las transiciones de outbox tienen pruebas deterministas.

### CP13 — Resolución de conflictos

Comparar base/local/servidor, combinar campos no superpuestos, mostrar decisión
para campos superpuestos y resolver delete-vs-edit.

Salida: dos dispositivos convergen sin sobrescribir silenciosamente datos.

### CP14 — Caché de archivos

Mantener binarios fuera de SwiftData, caché LRU de 250 MiB, thumbnails, limpieza
manual, uploads de background y exclusión de documentos sensibles de backups.

Salida: limpiar caché no elimina outbox ni datos estructurados.

### CP15 — React API foundation

Instalar TanStack Query, conectar cliente generado, centralizar query keys,
mapear Problem Details, definir retries e invalidaciones.

Salida: una pantalla React funciona únicamente mediante `/api/v1`.

### CP16 — Dashboard nativo

Extraer servicio, crear endpoint, migrar React, implementar Swift cacheado y
activar con feature flag.

Salida: dashboard Swift sustituible y reversible.

### CP17 — Clientes nativos

CRUD, detalle, paginación, métricas y assets; edición offline de campos seguros;
secretos excluidos de sync y SwiftData.

Salida: CRUD, offline, paginación y conflictos pasan pruebas.

### CP18 — Contenido nativo

Tareas, estados, asignaciones, notas, métricas, bulk y estrategias; React y Swift
usan API y las mutaciones son idempotentes.

Salida: un editor completa el flujo de una tarea sin WebView.

### CP19 — Rodajes nativos

CRUD, duplicación, cancelación, estados, validación de solapamientos y Calendar
como efecto idempotente posterior.

Salida: una caída de Calendar no duplica ni revierte el rodaje.

### CP20 — Chronos nativo

Start, stop, entradas manuales y estadísticas; exclusividad validada por servidor
y recuperación offline.

Salida: una sesión offline produce una sola entrada válida.

### CP21 — Notificaciones nativas

Lista, contador, marcar una/todas, APNs y sincronización con el shell.

Salida: contador, lista, lectura y push convergen.

### CP22 — Primera TestFlight operativa

Activar CP16–CP21 para allowlist, ejecutar XCTest/XCUITest en CI, validar APNs en
iPhone físico y practicar rollback por ruta.

Salida: un `EDITOR` completa su operación diaria sin WebView.

### CP23 — Migración Decimal

Añadir columnas Decimal, backfill, escalas, dual-write, reconciliación y DTOs con
strings decimales.

Salida: no existen diferencias financieras sin explicación.

### CP24 — Finanzas básicas

Transacciones, gastos, reembolsos, facturas internas, receivables y finanzas
personales.

Salida: React y Swift producen totales idénticos.

### CP25 — Finanzas avanzadas

Resumen mensual, cierres, honorarios, liquidación, utilidades, fondo de emergencia,
alertas y analítica.

Salida: aprobaciones, pagos y cierres siguen online-only y auditados.

### CP26 — Administración

Usuarios, especialidades, configuración, archivos, push administrativo y permisos
ADMIN.

Salida: toda operación administrativa requiere capacidad y auditoría.

### CP27 — Integraciones

Google Calendar, Meta, IA, reportes compartidos, uploads y jobs idempotentes.

Salida: una caída externa deja estado pendiente y recuperable.

### CP28 — Facturación electrónica

Configuración fiscal, P12, productos, clientes fiscales, emisión, PDF/XML,
estados SRI, anulación y cancelación.

Salida: operaciones SRI online-only, idempotentes y auditadas.

### CP29 — Observabilidad y compatibilidad

Medir latencias, errores, conflictos, outbox, fallbacks y versiones; aplicar
compatibilidad de dos releases iOS y 90 días.

Salida: se puede identificar regresión por endpoint, versión o ruta.

### CP30 — Retirar WebView

Confirmar cero rutas privadas legacy, desactivar fallback, retirar bridge, shell
snapshot, `WebAppView` y acciones sin consumidores.

Salida: toda la app privada funciona nativamente.

### CP31 — Limpieza final

Eliminar role legacy, Float antiguos, JSON string migrado, contratos vencidos,
flags obsoletos y documentación temporal.

Salida: no quedan dual-writes, fallbacks ni contratos temporales.

## Formato de entrega de cada checkpoint

Cada checkpoint debe cerrar con:

1. Cambios implementados.
2. Archivos modificados.
3. Migraciones ejecutadas.
4. Pruebas ejecutadas y resultado.
5. Riesgos o decisiones pendientes.
6. Criterio de salida marcado como cumplido.
7. Commit atómico con el identificador del checkpoint, por ejemplo:
   `feat(cp03): add api kernel`.

Si un checkpoint falla, se corrige antes de avanzar. No se mezclan migraciones de
datos, pantallas y limpieza de legacy en un mismo commit sin una prueba de salida.
