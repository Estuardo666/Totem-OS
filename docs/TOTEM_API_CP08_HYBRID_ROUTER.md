# CP08 — Router híbrido y rollback

## Resultado

El cliente iOS consulta `GET /api/v1/app-config` después del bootstrap y
resuelve cada ruta como `native` o `web`. Las reglas más específicas ganan y
las filas `UserRouteOverride` permiten devolver una ruta al WebView sin
publicar una nueva aplicación.

`LegacyWebRouteView` encapsula el contenido React existente. Cuando una ruta se
marca como nativa pero todavía no tiene una pantalla de negocio migrada, el
shell muestra una pantalla nativa explícita con la acción **Usar versión web**;
el rollback es inmediato y queda acotado a la sesión del dispositivo.

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
