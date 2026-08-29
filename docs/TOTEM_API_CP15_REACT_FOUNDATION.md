# CP15 — Foundation API en React

Se instaló TanStack Query y se añadió `ApiQueryProvider` en el layout raíz. El
cliente TypeScript generado se expone mediante hooks tipados para bootstrap del
shell, configuración, pull y push de sync. `queryKeys` es la única fuente de
claves y las mutaciones invalidan sync y shell después de aplicar un push.

`toApiErrorViewModel` centraliza Problem Details, `requestId`, códigos de sesión
y la política de reintentos. No se reintentan errores deterministas (401, 403,
404, 409 y 422); los errores transitorios usan backoff y respetan `retryAfter`.

La ruta `/api-foundation` es una pantalla de referencia que sólo obtiene su
estado desde `/api/v1/shell/bootstrap`; no llama Server Actions ni Prisma.
