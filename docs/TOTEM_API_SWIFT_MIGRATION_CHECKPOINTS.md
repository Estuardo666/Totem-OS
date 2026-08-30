# Totem OS — Plan maestro de API + shell SwiftUI

Este documento conserva el plan aprobado para continuar la implementación por
checkpoints. No se debe saltar un checkpoint: cada uno necesita código, pruebas,
criterio de salida y una verificación antes de iniciar el siguiente.

## Regla de fuente de verdad UI/UX

- Los dashboards y las páginas internas actuales de React/Next.js son la fuente
  de verdad funcional, visual y de experiencia de usuario.
- Cualquier UI nativa que se añada al shell debe respetar la pantalla React/Next.js
  vigente: mismos tokens, estados, jerarquía y flujos de navegación.
- No se crearán pantallas Swift de negocio en esta fase. Una futura excepción
  requerirá aprobación explícita, paridad documentada y un plan de rollback.
- Implementar una pantalla Swift no autoriza a reemplazar o retirar su pantalla
  React/Next.js. La versión web/PWA se conserva operativa durante la migración.
- Antes de cambiar el shell nativo se debe verificar que no altera roles,
  estados, loading/empty/offline/error, datos, acciones ni popups de React.

## Replanteamiento de alcance — 2026-08-30

- **React/Next.js/PWA es la implementación de todas las pantallas privadas.**
  Home, clientes, contenido, rodajes, finanzas, administración y cualquier
  pantalla interna continúan renderizándose desde React.
- **Swift no migrará esas pantallas en esta fase.** El trabajo nativo queda
  limitado al login existente y al shell compartido: topbar, bottom bar,
  menús, navegación y puente con el WebView.
- El dashboard Swift de CP16 se retira del runtime. Su código y el endpoint
  cacheado pueden conservarse como prototipo documentado, pero no pueden
  reemplazar Home ni activarse por una bandera remota antigua.
- El router híbrido y los contratos API permanecen para una posible decisión
  futura; hasta entonces `nativeScreenMigrationsEnabled` está fijado en `false`
  en iOS y todas las rutas privadas se envían al WebView React.
- CP09–CP10 siguen siendo infraestructura de sync reutilizable por API/React.
  CP11–CP14 (SwiftData, outbox, coordinador y caché de archivos) quedan
  archivados: el código no se elimina, pero no se amplía ni condiciona ninguna
  pantalla React mientras no exista un cliente nativo de negocio.
- CP30 cambia de objetivo: no se retirará el WebView. La salida del programa es
  una app híbrida estable con React como fuente de verdad y shell Swift nativo.

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
- [x] **CP08 — Router híbrido y rollback** (`f3679d9`): configuración remota
  por usuario, `LegacyWebRouteView`, resolución nativa/web y rollback inmediato.
- [x] **CP09 — Modelo de sync backend** (`3b919d1`): entidades versionadas,
  tombstones, change feed y receipts idempotentes en transacciones PostgreSQL.
- [x] **CP10 — API de sync** (`6d53f08`): bootstrap/pull/push, cursores opacos,
  conflictos 409, cursor vencido 410 y compactación de 90 días.
- [x] **CP11 — SwiftData y outbox** (`a6c38fd`): snapshots base/local,
  mutaciones idempotentes, tombstones y recuperación tras cierre forzado.
- [x] **CP12 — Coordinador de sync Swift** (`2910386`): bootstrap/pull/push
  serializados, FIFO, pausa 401 y recuperación por conectividad.
- [x] **CP13 — Resolución de conflictos** (`f37fc59`): merge de tres vías,
  campos superpuestos y delete-vs-edit con decisión explícita.
- [x] **CP14 — Caché de archivos** (`49912fd`): LRU acotado, thumbnails,
  exclusión de backups y uploads de background fuera de SwiftData.
- [x] **CP15 — React API foundation** (`cdc1cf3`): TanStack Query, cliente
  generado, query keys, Problem Details, retries e invalidaciones.
- [x] **CP16 — Contrato de dashboard + shell híbrido** (`98497b7`):
  proyección `/api/v1/dashboard` y shell nativo conservados, pero Home Swift
  retirado del runtime; Home y el resto de pantallas usan React/Next.js.

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
- React/Next.js es dueño de las pantallas privadas, su UI/UX y sus flujos; Swift
  es dueño del login y del shell (topbar, bottom bar, menús y puente). El
  `WKWebView` es el renderer privado principal, no un fallback temporal.
- La API conserva REST, change feed, receipts idempotentes, tombstones y
  conflictos `409` para los consumidores React/PWA. SwiftData/outbox no forman
  parte del runtime de pantallas actual y solo se reactivarán con un cliente
  nativo aprobado.
- Historial de sync: 90 días; cursor vencido produce resync conservando outbox.
- Paginación por cursor: 25 por defecto, 100 máximo.
- Push offline: máximo 50 mutaciones o 1 MiB por lote, con resultado individual.
- Dinero se migra a `Decimal` y se transmite como string; JSON serializado se
  migra por dominio.
- iPhone únicamente, iOS 26+, sin iPad/macOS/Android en este programa.
- El shell Swift actual (barra inferior, header, menús y sidebar) se conserva.
- Primera fase nativa: login y shell compartido. No se migran dashboards ni
  páginas internas a Swift sin una nueva aprobación de alcance.
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

Salida original conservada para compatibilidad, pero el runtime actual mantiene
las rutas privadas en WebView mediante `nativeScreenMigrationsEnabled = false`.
No se activará una ruta nativa sin aprobación explícita y pruebas de paridad.

### CP09 — Modelo de sync backend

Añadir versiones, timestamps, tombstones, `SyncChange`, `SyncMutationReceipt` e
índices; registrar entidad, receipt y cambio en una transacción.

Salida: una mutación produce un único cambio observable y repetible.

### CP10 — API de sync

Implementar `/sync/pull`, `/sync/push` y `/sync/bootstrap`, conflictos `409`,
cursor vencido `410`, lotes acotados y retención/compactación de 90 días.

Salida: create/update/delete, duplicado, conflicto y resync pasan integración.

> **Alcance archivado CP11–CP14:** estos checkpoints describen infraestructura
> local Swift ya construida, pero no se ejecutan como parte de las pantallas
> React/PWA. No se agregan nuevos modelos ni flujos Swift hasta aprobar un
> cliente nativo de negocio.

### CP11 — SwiftData y outbox (archivado)

Crear modelos locales separados de DTOs, mappers, outbox persistente, snapshots
base, estados de mutación y recuperación tras cierre forzado.

Salida: una edición offline sobrevive al reinicio y se aplica una sola vez.

### CP12 — Coordinador de sync Swift (archivado)

Sincronizar en inicio, foreground, conectividad y edición; pausar ante `401`,
procesar FIFO por recurso y limitar concurrencia global.

Salida: todas las transiciones de outbox tienen pruebas deterministas.

### CP13 — Resolución de conflictos (archivado para Swift)

Comparar base/local/servidor, combinar campos no superpuestos, mostrar decisión
para campos superpuestos y resolver delete-vs-edit.

Salida: dos dispositivos convergen sin sobrescribir silenciosamente datos.

### CP14 — Caché de archivos (archivado para Swift)

Mantener binarios fuera de SwiftData, caché LRU de 250 MiB, thumbnails, limpieza
manual, uploads de background y exclusión de documentos sensibles de backups.

Salida: limpiar caché no elimina outbox ni datos estructurados.

### CP15 — React API foundation

Instalar TanStack Query, conectar cliente generado, centralizar query keys,
mapear Problem Details, definir retries e invalidaciones.

Salida: una pantalla React funciona únicamente mediante `/api/v1`.

### CP16 — Contrato de dashboard + shell híbrido

Mantener la proyección `/api/v1/dashboard` como contrato de datos y conservar el
dashboard React/Next.js vigente como única implementación de Home. El shell Swift
(topbar, bottom bar, menús y navegación) se superpone al WebView; la pantalla
`NativeDashboardView` queda fuera del runtime y no puede activarse por una
configuración remota antigua.

Salida: Home, páginas internas y PWA siguen renderizándose en React; el shell
nativo no altera sus funciones, estilos ni popups.

### CP17 — Clientes React sobre API

Mantener CRUD, detalle, paginación, métricas y assets en las pantallas React
actuales, conectándolas gradualmente al contrato API. Los campos offline seguros
se resuelven en la capa web; no se crea una pantalla Swift equivalente.

Salida: CRUD, offline, paginación y conflictos pasan pruebas en React/PWA.

### CP18 — Contenido React sobre API

Tareas, estados, asignaciones, notas, métricas, bulk y estrategias permanecen en
React; las mutaciones son idempotentes y consumen el cliente generado.

Salida: un editor completa el flujo de una tarea en la PWA/WebView.

### CP19 — Rodajes React sobre API

CRUD, duplicación, cancelación, estados, validación de solapamientos y Calendar
como efecto idempotente posterior, todo desde React.

Salida: una caída de Calendar no duplica ni revierte el rodaje en la PWA.

### CP20 — Chronos React sobre API

Start, stop, entradas manuales y estadísticas; exclusividad validada por servidor
y recuperación offline desde React.

Salida: una sesión offline produce una sola entrada válida en la PWA.

### CP21 — Notificaciones React + shell

La lista y las acciones permanecen en React; el shell Swift solo muestra el
contador, abre el acceso y coordina APNs.

Salida: contador, lista, lectura y push convergen sin duplicar pantallas.

### CP22 — Primera TestFlight operativa (shell + React)

Activar el shell y las pantallas React existentes para allowlist, ejecutar
XCTest/XCUITest en CI, validar APNs en iPhone físico y practicar rollback por
ruta.

Salida: un `EDITOR` completa su operación diaria usando React/WebView con shell
nativo estable.

### CP23 — Migración Decimal

Añadir columnas Decimal, backfill, escalas, dual-write, reconciliación y DTOs con
strings decimales.

Salida: no existen diferencias financieras sin explicación.

### CP24 — Finanzas React básicas

Transacciones, gastos, reembolsos, facturas internas, receivables y finanzas
personales continúan en las pantallas React actuales.

Salida: las pantallas React producen totales idénticos contra la API.

### CP25 — Finanzas React avanzadas

Resumen mensual, cierres, honorarios, liquidación, utilidades, fondo de emergencia,
alertas y analítica permanecen en React.

Salida: aprobaciones, pagos y cierres siguen online-only y auditados.

### CP26 — Administración React

Usuarios, especialidades, configuración, archivos, push administrativo y permisos
ADMIN se mantienen en React/Next.js.

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

### CP30 — Consolidar React y estabilizar shell

Confirmar que todas las rutas privadas continúan en React/Next.js, que el bridge
solo expone navegación/sesión/shell y que topbar, bottom bar y login no dependen
de pantallas Swift. No se retira `WebAppView`.

Salida: toda la app privada funciona mediante React/PWA con shell Swift estable.

### CP31 — Limpieza final

Eliminar role legacy, Float antiguos, JSON string migrado, contratos vencidos y
flags obsoletos, manteniendo el bridge del shell y el WebView React como partes
del producto.

Salida: no quedan dual-writes ni contratos temporales; React sigue siendo la
fuente de verdad de las pantallas privadas.

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
