# CP03 — Kernel de `/api/v1`

CP03 establece la frontera común para los endpoints REST nuevos. Las rutas
legacy bajo `/api/*` mantienen su comportamiento hasta su migración por dominio.

## Contrato de éxito

```json
{
  "data": {},
  "meta": {
    "requestId": "a-valid-request-id"
  }
}
```

Toda respuesta exitosa incluye `data`, `meta.requestId`, `content-type` JSON,
`cache-control: no-store` y el mismo `x-request-id` en headers.

## Contrato de error

Los errores usan [Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
con `content-type: application/problem+json`:

```json
{
  "type": "https://totem-os.com/problems/validation-error",
  "title": "Request validation failed",
  "status": 400,
  "detail": "One or more request fields are invalid.",
  "instance": "/api/v1/_kernel/echo",
  "code": "VALIDATION_ERROR",
  "requestId": "a-valid-request-id",
  "errors": [{ "path": ["message"], "code": "too_small", "message": "..." }]
}
```

Códigos implementados: `INVALID_JSON`, `INVALID_CONTENT_LENGTH`,
`VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `INVALID_CURSOR`,
`INVALID_PAGINATION`, `METHOD_NOT_ALLOWED` e `INTERNAL_ERROR`.

## Paginación

- `limit` por defecto: `25`.
- `limit` máximo: `100`.
- `cursor` es opaco, URL-safe y validado con Zod por cada recurso.
- La metadata usa `meta.pagination.limit`, `hasMore` y `nextCursor`.
- Un cursor mal formado o fuera de contrato responde `400 INVALID_CURSOR`.

## Límite de payload

`readJsonBody` rechaza cuerpos mayores a `1 MiB` (`413 PAYLOAD_TOO_LARGE`) antes
de validarlos. También verifica `Content-Length` cuando el cliente lo envía y
rechaza valores inválidos. El límite puede reducirse por endpoint.

## Endpoint de contrato

`/api/v1/_kernel/echo` es stateless y no accede a Prisma:

- `GET`: devuelve 60 elementos deterministas para probar cursor y límites.
- `POST`: recibe `{ "message": string }`, con longitud de 1 a 280, y devuelve
  `{ "echo": string }`.

Es un endpoint técnico temporal para validar clientes y CI; no representa aún
un recurso de negocio ni sustituye el guard de CP04.

## Archivos principales

- `src/lib/api-kernel.ts`: contexto, request ID, envelopes, Problem Details,
  JSON limitado, cursor y wrapper de errores.
- `src/lib/api-kernel-demo.ts`: handler stateless del contrato.
- `src/app/api/v1/_kernel/echo/route.ts`: Route Handler Next.js.
- `tests/unit/api-kernel.test.mjs`: siete pruebas del contrato completo.

## Verificación

- `npm run typecheck` ✅
- `npm run test:unit` ✅ (29 tests)
- `npm run lint` ✅ (14 warnings preexistentes de `<img>`, 0 errores)
- `npm run build` ✅ (warnings preexistentes de `<img>` y Browserslist)

## Salida de CP03

El kernel es reusable por los endpoints de CP06 en adelante. CP04 debe añadir
`ApiActor`, capacidades, CSRF y rate limiting sin duplicar este manejo de
request ID, envelopes ni errores.
