# CP10 — API de sync

## Endpoints

- `GET /api/v1/sync/bootstrap` devuelve el estado materializado del usuario y
  el cursor más reciente.
- `GET /api/v1/sync/pull?cursor=…&limit=…` entrega cambios en orden de
  secuencia, con máximo 100 por página y cursores opacos.
- `POST /api/v1/sync/push` acepta entre 1 y 50 mutaciones y limita el cuerpo a
  1 MiB. Cada mutation ID es idempotente.

Todos los endpoints exigen sesión Auth.js y `dashboard.read`; push exige además
CSRF y rate limit durable.

## Respuestas y recuperación

- `409 CONFLICT`: la versión base no coincide o se reutiliza un mutation ID con
  otro payload.
- `410 CURSOR_EXPIRED`: el cursor está detrás de la frontera compactada; el
  cliente debe ejecutar bootstrap y conservar su outbox.
- El cursor transporta `{ version: 1, sequence }` codificado en base64url; la
  secuencia interna no se expone en la URL.
- Los cambios y receipts se compactan después de 90 días mediante
  `/api/cron/sync-compact` (Vercel Cron o `Authorization: Bearer CRON_SECRET`).

## Verificación

Las integraciones cubren create, duplicado idempotente, conflicto 409, pull con
cursor, bootstrap, compactación y resync 410. Los contratos Zod/OpenAPI y los
clientes TypeScript/Swift se regeneran con `npm run api:generate`.
