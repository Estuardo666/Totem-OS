# CP11 — SwiftData y outbox persistente

## Alcance

CP11 establece el ledger local de sincronización en `TotemOSKit`. Los modelos
de persistencia no reutilizan los DTO HTTP: cada entidad guarda el snapshot que
vino del servidor (`basePayloadData`), la edición local (`localPayloadData`) y
su estado de dirty/tombstone. Las mutaciones pendientes se almacenan en un
outbox con `mutationId` único para que repetir una operación sea seguro.

## Implementación

- `LocalSyncEntityRecord`, `OutboxMutationRecord` y `SyncMetadataRecord` usan
  SwiftData y pueden operar con un `ModelContainer` en memoria para pruebas.
- `LocalSyncStore.enqueue` es idempotente por `mutationId`, actualiza el
  snapshot local y registra la mutación en estado `queued`.
- Los estados persistidos son `queued`, `sending`, `applied`, `failed` y
  `conflict`; cualquier `sending` se devuelve a `queued` al abrir el store.
- `markApplied` conserva el resultado confirmado como base y limpia `isDirty`.
- Los cambios remotos actualizan la base sin sobrescribir una edición local
  pendiente.

## Verificación

`LocalSyncStoreTests` cubre idempotencia, snapshot dirty, tombstone de delete,
recuperación de un envío interrumpido y confirmación aplicada. El criterio de
salida es que una edición offline pueda reconstruirse desde SwiftData después
de cerrar y abrir la aplicación.
