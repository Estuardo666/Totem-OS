# CP12 — Coordinador de sync Swift

## Alcance

`SyncCoordinator` es el único punto que dispara sincronización de la app. Se
ejecuta en inicio, foreground, edición local y cambios de conectividad, siempre
serializado sobre el `MainActor` junto a SwiftData.

## Reglas implementadas

- Sin cursor se ejecuta bootstrap; con cursor se consume pull hasta agotar
  `hasMore`, guardando el cursor únicamente después de aplicar los cambios.
- El outbox se vacía en FIFO con una mutación por request (concurrencia global
  efectiva de uno), por lo que dos cambios del mismo recurso no se cruzan.
- Cada resultado individual pasa por `markApplied`; un `409` pasa a `conflict`,
  un error reintentable queda `failed` y un `401` pausa el coordinador.
- La pausa por autenticación no elimina el outbox; `resumeAfterAuthentication`
  puede continuar cuando la sesión vuelva a estar válida.
- Las respuestas de red sin status se representan como estado `offline`.

## Verificación

`SyncCoordinatorTests` usa un transporte falso para comprobar convergencia de
bootstrap + outbox en orden, pausa ante 401 y conservación de mutaciones cuando
la conectividad desaparece.
