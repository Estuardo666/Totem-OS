# CP08 — Router híbrido y rollback

## Resultado

El cliente iOS consulta `GET /api/v1/app-config` después del bootstrap y
conserva la resolución tipada `native`/`web` para compatibilidad futura. Las
reglas más específicas ganan y las filas `UserRouteOverride` siguen disponibles
para rollback, pero el runtime actual mantiene todas las pantallas privadas en
React/WebView.

`LegacyWebRouteView` encapsula el contenido React existente. Cuando una ruta se
marca como nativa en una configuración antigua, `nativeScreenMigrationsEnabled`
la neutraliza y el WebView continúa visible. No se muestra una pantalla nativa
de negocio ni una vista de placeholder durante esta fase.

## Configuración

La configuración global vive en `GlobalConfig` bajo la clave `ios_app_config`:

```json
{
  "version": 1,
  "defaultMode": "web",
  "routes": [{ "path": "/clients", "mode": "native" }]
}
```

Un `UserRouteOverride` con la misma ruta tiene prioridad sobre la regla global.
Solo se aceptan rutas internas y los modos `native`/`web`; una configuración
inválida vuelve de forma segura a WebView.

## Pruebas

- El contrato Zod, OpenAPI 3.1 y clientes TypeScript/Swift incluyen
  `AppConfigResponse`.
- Unit tests cubren prioridad de prefijos y rechazo de rutas externas.
- Integración PostgreSQL cubre configuración global más rollback por usuario.
- `npm run typecheck`, `npm run test:unit` y `npm run test:integration` pasan.

## Límite hacia CP09

CP08 solo decide dónde presentar una pantalla. No persiste mutaciones offline ni
sincroniza entidades; esa autoridad transaccional se incorpora en CP09 y CP10.
