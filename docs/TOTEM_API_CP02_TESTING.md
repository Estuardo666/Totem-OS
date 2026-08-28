# CP02 — Base de pruebas backend

Este checkpoint deja una base PostgreSQL aislada y repetible para probar la API
sin tocar desarrollo ni producción.

## Qué se añadió

- Migración inicial de Prisma en `prisma/migrations/00000000000000_init`.
- Harness de integración con guardas explícitas:
  `tests/integration/prisma-test-db.mjs`.
- Seed determinista CP02 con IDs fijos:
  `tests/integration/seed-test-db.mjs`.
- Smoke test de lectura relacional y limpieza por `TRUNCATE ... CASCADE`:
  `tests/integration/prisma-smoke.test.mjs`.
- Scripts `db:seed:test` y `test:integration`.
- Workflow `.github/workflows/api-integration.yml` con PostgreSQL 16 como
  service container, `prisma migrate deploy`, seed y pruebas.

## Ejecución local segura

Definir una URL PostgreSQL efímera y activar las dos guardas antes de ejecutar:

```powershell
$env:DATABASE_URL = "postgresql://totem_test:totem_test@localhost:5432/totem_test?schema=public"
$env:DATABASE_URL_UNPOOLED = $env:DATABASE_URL
$env:TOTEM_TEST_DATABASE = "1"
npx prisma migrate deploy
npm run db:seed:test
npm run test:integration
```

El harness se niega a ejecutarse si `TOTEM_TEST_DATABASE` no vale `1` o si la
URL no es PostgreSQL. El workflow crea una base nueva por ejecución.

## Criterio de salida

- `migrate deploy` aplica el esquema desde cero.
- El seed crea los mismos usuarios, cliente y tarea en cada ejecución.
- La operación Prisma relacional pasa contra PostgreSQL real.
- La limpieza elimina fixtures y relaciones sin conservar estado entre tests.
- CI nunca recibe credenciales de producción ni ejecuta el seed de desarrollo.
