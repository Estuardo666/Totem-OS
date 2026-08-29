# CP07 — AppCoordinator Swift

## Resultado

El shell visible ya no recibe su estado desde un snapshot JavaScript. Swift
obtiene sesión, capacidades, preferencias, marca, contadores y notificaciones
desde `GET /api/v1/shell/bootstrap` y construye navegación y pestañas en
`TotemOSKit`.

El deployment target es iOS 26. El `WKWebView` continúa alojando las pantallas
React durante la migración, pero no decide si el shell existe ni qué permisos
presenta. El canal restante es unidireccional, Swift → React, para ejecutar
acciones heredadas hasta que CP08 introduzca el router híbrido y su rollback.

## Flujo de datos

1. `WKWebView` termina una navegación del dominio configurado.
2. `AppCoordinator` convierte la ruta a `AppRoute` y lee las cookies Auth.js del
   `WKHTTPCookieStore`.
3. El cliente Swift generado solicita `/api/v1/shell/bootstrap`.
4. El API resuelve el `ApiActor`, carga PostgreSQL y responde un DTO generado.
5. `NativeShellState` filtra su catálogo por capacidades y publica el estado a
   SwiftUI.
6. El coordinador refresca cada 60 segundos y tras cada comando heredado.

Una respuesta `401` vacía inmediatamente el estado nativo y muestra el login.
Los errores de red conservan el último estado válido para evitar que el shell
desaparezca por una pérdida temporal de conectividad.

## Propiedad del estado

| Estado | Propietario desde CP07 |
| --- | --- |
| Ruta activa | `AppCoordinator` / `AppRoute` |
| Sesión y rol | API bootstrap → `NativeShellState` |
| Capacidades | `ApiActor` → DTO → catálogo Swift |
| Tema y color | PostgreSQL → API bootstrap → Swift |
| Tareas y notificaciones | PostgreSQL → API bootstrap → Swift |
| Marca | `GlobalConfig` → API bootstrap → Swift |
| Pantallas de negocio | React en `WKWebView`, hasta su checkpoint nativo |

El backend continúa siendo la autoridad de autorización. Ocultar una ruta en
Swift mejora la interfaz, pero cada operación del API mantiene su guard
default-deny.

## Contrato y seguridad

- `GET /api/v1/shell/bootstrap` exige sesión Auth.js y
  `dashboard.read`.
- El rate limit durable usa el bucket `shell.bootstrap`.
- El DTO forma parte de OpenAPI 3.1 y de los clientes TypeScript/Swift
  generados.
- Las URLs de assets aceptan solo rutas internas o HTTPS.
- Contadores, mensajes, IDs y listas se acotan antes de cruzar el contrato.
- Las cookies se copian solo al header de la petición nativa y únicamente para
  el host configurado.

## Pruebas

- Zod y clientes generados decodifican `contracts/fixtures/shell-bootstrap.json`.
- Integración PostgreSQL comprueba rol, capacidades, marca, tareas y
  notificaciones reales.
- XCTest decodifica el mismo fixture y verifica rutas tipadas, catálogo por
  capacidades y contadores.
- GitHub Actions ejecuta build, `build-for-testing` y XCTest en macOS/iPhone
  Simulator.

## Límite hacia CP08

CP07 no convierte pantallas de negocio a Swift. `AppCoordinator.send` todavía
invoca `window.__totemShellDispatch` para navegación, tema, notificaciones,
transacciones y logout en la web existente. CP08 sustituirá esa decisión por
`LegacyWebRouteView` y configuración remota por usuario, manteniendo un rollback
sin nueva publicación de la app.
