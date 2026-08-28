# CP05 — Roles canónicos y matriz de capacidades

CP05 fija una única fuente de autorización para API, React y Swift: el rol
canónico `roleCode`. El campo Prisma `role` se expone como `roleLegacy` y se
conserva temporalmente para que las rutas y sesiones antiguas sigan funcionando
durante la migración por dominios.

## Modelo y migración

`User.roleCode` es un `String` no nulo con índice propio y valores válidos
`ADMIN`, `EDITOR` o `USER`. La migración
`20260828_add_canonical_role_code`:

1. crea `role_code` con default transitorio `EDITOR` para que la columna sea
   compatible con filas existentes;
2. hace backfill desde `role`, normalizando mayúsculas y espacios;
3. convierte cualquier valor desconocido al mínimo privilegio `USER`;
4. deja índices para `role` y `role_code` mientras conviven ambos campos.

La migración debe desplegarse antes del código que consulta `roleCode`:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Regla de resolución

`src/lib/roles.ts` implementa `resolveRoleCode` con esta prioridad:

1. `roleCode`;
2. `roleLegacy`;
3. `role` de sesiones antiguas.

Un valor ausente o desconocido no se convierte en `EDITOR`. El actor de API no
se crea (`401` desde el guard) y las superficies de UI usan `USER` como mínimo
privilegio visual. La resolución es case-insensitive y elimina espacios.

## Dual-write y Auth.js

Las altas y cambios de usuario escriben `roleCode` y `roleLegacy` con el mismo
valor canónico. El seed, el usuario E2E y los fixtures de integración también
incluyen ambos campos.

Auth.js normaliza el rol al entrar por Credentials o Google, lo guarda en
`token.roleCode`, y publica en la sesión:

- `session.user.roleCode`: fuente canónica;
- `session.user.role` y `session.user.roleLegacy`: espejos de compatibilidad.

Si una consulta de sincronización falla, se conserva el rol ya presente en el
token. Si el token no contiene un rol válido, la sesión queda en `USER`; nunca
se eleva a `EDITOR` por un error de infraestructura.

## Matriz compartida

Los nombres de capacidades están definidos una vez en `API_CAPABILITIES` y se
replican en `ShellCapability` para que Swift pueda filtrar UX sin inventar otra
jerarquía. La autorización definitiva sigue siendo el guard del API.

| Dominio | ADMIN | EDITOR | USER |
| --- | :---: | :---: | :---: |
| Kernel / dashboard | lectura + escritura | lectura + escritura | lectura |
| Clientes | leer, crear/editar, borrar | leer, crear/editar | leer |
| Contenido / rodajes | leer, escribir, borrar | leer, escribir | leer |
| Tiempo / notificaciones / voz | equipo + broadcast | propio | propio |
| Meta / IA | lectura, escritura, generar | lectura, escritura, generar | — |
| Finanzas personales | ✓ | ✓ | — |
| Finanzas operativas/estratégicas | ✓ | — | — |
| Operaciones irreversibles, usuarios, settings y billing | ✓ | — | — |

Las especialidades (`COMMUNITY`, `EDITOR`, etc.) siguen siendo atributos de
asignación, no roles de autorización. Un usuario con specialty Community Manager
continúa siendo `EDITOR` o `USER` según `roleCode`.

## React, shell y Swift

- Sidebar, dashboard, Content Factory, clientes, finanzas, filtros y cargas de
  trabajo consumen `resolveRoleCode`.
- El proveedor `native-shell-provider` envía `roleCode`; el contrato del shell
  aplica la misma resolución antes de filtrar navegación y pestañas.
- `ShellRole.capabilities` en Swift es el espejo tipado de la matriz. Las rutas
  y comandos siguen validándose en ambos lados, pero el servidor siempre decide
  sobre datos y mutaciones.
- Las búsquedas administrativas por rol usan `roleCode`; las consultas legacy
  que aún usan `role` son seguras porque el dual-write mantiene ambos valores.

## Compatibilidad y retirada futura

Durante CP05 se permite leer `roleLegacy` para sesiones viejas y procesos aún no
migrados. No se debe introducir código nuevo que compare directamente esos
campos ni que use `VIEWER`, `COMMUNITY` o valores arbitrarios como roles. La
retirada de la columna legacy y de los espejos de sesión queda para CP26,
después de migrar todos los dominios y clientes.

## Verificación

- `npm run typecheck` ✅
- `npm run test:unit` ✅ (40 pruebas, incluida la precedencia `roleCode` y la
  matriz de capacidades)
- `git diff --check` ✅
- `ShellContractTests.testRoleCapabilitiesMatchCanonicalMatrix` cubre el espejo
  de capacidades en Swift (requiere Xcode/macOS para ejecutar localmente).

## Salida de CP05

API, React y Swift reciben/derivan el mismo rol canónico y la misma matriz de
capacidades. El fallback legacy está acotado a compatibilidad y aplica mínimo
privilegio; CP06 puede generar contratos DTO/OpenAPI sin volver a repartir la
lógica de roles.
