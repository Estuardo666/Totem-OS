# CP06 — Contrato generado OpenAPI + clientes

CP06 establece el flujo reproducible para que Zod sea la fuente de validación y
OpenAPI 3.1 sea la fuente de intercambio entre Next.js, React y Swift. El
primer contrato registrado es `/api/v1/_kernel/echo`; los dominios de negocio
se incorporan en checkpoints posteriores usando el mismo registro.

## Fuente única

`src/contracts/api-contracts.ts` contiene:

- DTOs Zod para problemas RFC 9457, paginación, request y respuestas del kernel;
- tipos inferidos para uso servidor;
- `apiContractRegistry`, con método, ruta, `operationId`, capacidad requerida,
  query/body y respuestas posibles;
- la lista de schemas que deben aparecer en `components.schemas`.

El handler `src/lib/api-kernel-demo.ts` importa los mismos schemas Zod para
validar requests y cursores. No existe una copia paralela de la validación en el
registro.

## Artefactos generados

`npm run api:generate` ejecuta
`scripts/generate-api-contracts.mjs` y actualiza de forma determinista:

- `contracts/openapi.json`: documento OpenAPI 3.1.0 con schemas, seguridad por
  cookie Auth.js, header CSRF, capacidades requeridas y Problem Details;
- `src/generated/api-client.ts`: DTOs y `TotemApiClient` para React/TypeScript;
- `ios/TotemOS/TotemOSKit/GeneratedAPIClient.swift`: DTOs Codable y
  `TotemAPIClient` basado en `URLSession`;
- fixtures JSON compartidos en `contracts/fixtures/` se mantienen como entradas
  de prueba y deben acompañar cualquier endpoint nuevo.

Los archivos generados llevan una cabecera `AUTO-GENERATED`; no se editan a
mano. Si un tipo necesita cambiar, se modifica el schema Zod y se vuelve a
generar.

## Fixtures y decodificación

`tests/unit/api-contract.test.mjs` valida los fixtures con Zod y ejecuta el
cliente TypeScript generado con un `fetch` controlado. Las pruebas XCTest
decodifican el mismo `kernel-echo-post.json` desde el bundle de fixtures
configurado en `ios/TotemOS/project.yml`.

Esto detecta diferencias de nombres, nulabilidad y envelopes antes de conectar
datos reales de negocio.

## Gate de compatibilidad

`contracts/openapi.baseline.json` es el contrato publicado de referencia.
`npm run api:check-breaking` compara la versión generada con esa baseline y
falla si detecta:

- eliminación de rutas, operaciones, parámetros o media types;
- parámetros o request bodies que pasan a ser obligatorios;
- eliminación de propiedades o componentes;
- propiedades requeridas nuevas;
- cambios de tipo o valores de enum eliminados;
- respuestas HTTP o esquemas de respuesta eliminados.

Cambios aditivos compatibles pueden pasar sin actualizar la baseline. Para
aceptar un cambio incompatible de forma consciente, se revisa el impacto en
React/Swift y se actualiza `openapi.baseline.json` en el mismo cambio aprobado.

## CI

El workflow `.github/workflows/api-integration.yml` genera el contrato, ejecuta
el gate de breaking changes y verifica que ningún artefacto generado quede
desactualizado (`git diff --exit-code`) antes de correr Prisma. Así una PR no
puede modificar Zod y olvidar regenerar TypeScript, Swift u OpenAPI.

## Flujo para añadir un endpoint

1. Crear schemas Zod request/response en `src/contracts/api-contracts.ts`.
2. Añadir una entrada al `apiContractRegistry` con capacidad y respuestas de
   error.
3. Hacer que el Route Handler importe esos schemas y use el kernel/guard común.
4. Añadir un fixture válido y pruebas de Zod + cliente TS + XCTest Swift.
5. Ejecutar `npm run api:generate`, `npm run api:check-breaking` y los tests.
6. Revisar el diff generado; nunca modificar a mano los clientes.

## Verificación de CP06

- `npm run api:generate` ✅
- `npm run api:check-breaking` ✅
- `npm run test:api-contract` ✅ (3 pruebas)
- `npm run typecheck` ✅
- XCTest Swift requiere Xcode/macOS; el fixture queda incluido en el proyecto.

## Salida de CP06

El endpoint de contrato tiene una definición Zod registrada, una especificación
OpenAPI 3.1, clientes TypeScript y Swift reproducibles, fixtures compartidos y
un detector automático de rupturas conectado a CI. CP07 puede consumir estos
artefactos para que `AppCoordinator` use rutas y DTOs tipados.
