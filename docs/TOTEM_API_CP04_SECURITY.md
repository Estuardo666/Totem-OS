# CP04 — Autenticación y capacidades

CP04 protege los endpoints nuevos de `/api/v1` reutilizando la sesión JWT/cookie
de Auth.js. Las rutas legacy bajo `/api/*` conservan su contrato mientras se
migran por dominio.

## Actor de API

`src/lib/api-actor.ts` convierte una sesión Auth.js en un `ApiActor`:

- `userId`, `email`, expiración de sesión y rol canónico.
- Roles aceptados únicamente: `ADMIN`, `EDITOR`, `USER`.
- El valor se normaliza a mayúsculas.
- Un rol ausente, vacío o desconocido devuelve actor nulo: no existe fallback a
  `EDITOR`.
- Las capacidades se enumeran explícitamente por rol; CP05 ampliará el catálogo
  por dominio.

`src/lib/api-protection.ts` carga Auth.js de forma diferida para que los tests
puedan inyectar un resolver. En producción, `auth()` es la fuente de sesión y
las cookies actuales de Auth.js siguen siendo válidas.

## Guard default-deny

`withApiProtection(handler, options)` compone en un único punto:

1. Identidad (actor Auth.js o `401`).
2. Rate limit distribuido por usuario o IP.
3. Capacidad declarada (`403` si falta).
4. CSRF para métodos mutantes.
5. Ejecución del caso de uso.

Errores de autenticación:

- `401 UNAUTHENTICATED` cuando no existe cookie de sesión.
- `401 SESSION_EXPIRED` cuando existe cookie pero Auth.js no devuelve actor.
- `403 FORBIDDEN` cuando el rol no tiene la capacidad solicitada.

## CSRF

Se usa doble envío:

- Cookie legible `totem.csrf-token` con `SameSite=Lax`, `Path=/` y `Secure` en
  producción.
- Header `x-csrf-token` con el mismo valor.
- `GET`, `HEAD` y `OPTIONS` no requieren header; una respuesta protegida puede
  emitir el cookie para la siguiente mutación.
- `POST`, `PUT`, `PATCH` y `DELETE` sin coincidencia responden
  `403 CSRF_FAILED`.

Esto protege las mutaciones que viajan con la cookie Auth.js y funciona tanto
para React como para `URLSession` en Swift.

## Rate limiting durable

`src/lib/api-rate-limiter.ts` usa PostgreSQL y el modelo
`ApiRateLimitBucket`:

- Ventana fija y contador incrementado con `INSERT ... ON CONFLICT DO UPDATE`.
- Operación atómica entre múltiples instancias de Next/Vercel.
- Solo se persiste un HMAC del identificador; no se guarda la IP en claro.
- Expirados se limpian durante la transacción.
- `429 RATE_LIMITED` incluye `Retry-After`, `x-ratelimit-limit`,
  `x-ratelimit-remaining` y `x-ratelimit-reset`.
- Si PostgreSQL no está disponible, el guard falla cerrado con
  `503 RATE_LIMIT_STORE_UNAVAILABLE`.

El rate limiter de memoria existente queda reservado para rutas legacy hasta su
migración; ningún endpoint nuevo debe importarlo directamente.

## Endpoint protegido de contrato

`/api/v1/_kernel/echo` ahora exige:

- `GET`: `kernel.echo.read`.
- `POST`: `kernel.echo.write` y CSRF válido.
- Rate limit: 60 solicitudes por minuto por usuario/IP.

El handler continúa siendo stateless y solo sirve para verificar clientes y el
contrato del kernel; no expone datos de negocio.

## Configuración

En producción se debe configurar `AUTH_SECRET` para Auth.js y, preferiblemente,
`RATE_LIMIT_HASH_SECRET` separado para los hashes de rate limit. El workflow de
integración usa PostgreSQL efímero y aplica la migración
`20260828_api_rate_limit_buckets`.

## Pruebas

`tests/unit/api-protection.test.mjs` cubre:

- actor y roles desconocidos;
- `401` sin sesión y sesión expirada;
- `403` por capacidad insuficiente;
- CSRF ausente y correcto;
- emisión de cookie CSRF;
- `429` con headers de retry;
- fallo cerrado del almacén distribuido.

`tests/integration/api-rate-limit.test.mjs` ejecuta el contador atómico real
contra PostgreSQL del workflow de integración.

## Salida de CP04

Los endpoints v1 ya tienen una frontera central de identidad, capacidades,
CSRF y rate limiting. CP05 debe añadir `roleCode`, backfill y la matriz de
capacidades de negocio sin reintroducir comprobaciones de `role` dispersas.
