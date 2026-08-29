# CP09 — Modelo de sync backend

## Resultado

El backend dispone de un ledger genérico por propietario compuesto por:

- `SyncEntity`: estado materializado, versión entera, `updatedAt` y tombstone
  (`deletedAt`).
- `SyncChange`: feed append-only con secuencia global, operación y payload.
- `SyncMutationReceipt`: deduplicación por `(ownerId, clientId, mutationId)` y
  respuesta persistida.

Cada create/update/delete se ejecuta dentro de una transacción PostgreSQL que
actualiza la entidad, inserta exactamente un cambio y guarda el receipt. Una
versión base distinta de la actual se rechaza como conflicto para evitar
sobrescrituras silenciosas.

## Invariantes

- `entityType`, `entityId`, `clientId` y `mutationId` tienen formato y tamaño
  acotados.
- La primera versión es `1`; cada nueva mutación incrementa la versión.
- Delete conserva la fila materializada como tombstone y publica un cambio
  `delete` con payload nulo.
- Repetir exactamente el mismo `mutationId` devuelve el resultado guardado con
  `duplicate: true`.
- Reutilizar un `mutationId` con otro cuerpo devuelve conflicto.
- Índices cubren propietario + entidad, propietario + secuencia y retención.

## Verificación

`npx prisma migrate deploy`, `npm run db:generate`, `npm run typecheck`,
`npm run test:unit` (47) y `npm run test:integration` (8) pasan contra el
PostgreSQL efímero de Docker.

## Límite hacia CP10

CP09 persiste el ledger y su idempotencia. CP10 añade los endpoints REST,
cursores, lotes, conflictos HTTP 409, cursor vencido HTTP 410 y compactación de
90 días.
