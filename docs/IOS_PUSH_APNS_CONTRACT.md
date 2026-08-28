# Contrato de instalaciones APNs

Este contrato es para la app nativa iOS. No reemplaza las suscripciones Web Push del PWA.

## Configuración del backend

- `APNS_BUNDLE_ID`: bundle identifier exacto de la app autorizada.
- Aplicar `prisma/manual-migrations/20260828_add_apns_device_installations.sql` antes de habilitar el registro en producción.
- Las credenciales de envío APNs (`teamId`, `keyId` y llave `.p8`) se incorporarán cuando se implemente el emisor de notificaciones. No deben enviarse desde la app.

## Registrar o rotar un token

`POST /api/push/apns`, con la sesión Auth.js del usuario:

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceToken": "token-hexadecimal-entregado-por-apns",
  "environment": "PRODUCTION",
  "bundleId": "com.totemmassmedia.totemos",
  "appVersion": "1.0.0",
  "appBuild": "42",
  "deviceModel": "iPhone",
  "osVersion": "19.0",
  "locale": "es-EC"
}
```

La app debe generar `installationId` una sola vez y conservarlo en Keychain. Debe repetir el registro al iniciar sesión, al cambiar el token y al actualizar la app. El servidor normaliza el token, lo vincula al usuario autenticado y reactiva instalaciones revocadas.

`environment` es `SANDBOX` para builds de desarrollo firmados y `PRODUCTION` para TestFlight/App Store.

## Consultar instalaciones

`GET /api/push/apns` devuelve metadatos de las instalaciones del usuario autenticado. Nunca devuelve `deviceToken`.

## Revocar

`DELETE /api/push/apns`:

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "environment": "PRODUCTION"
}
```

La app debe revocar antes de cerrar sesión. La operación solo afecta instalaciones pertenecientes al usuario autenticado.

## Respuestas del proveedor

Cuando el futuro emisor APNs reciba `410 Unregistered` o `BadDeviceToken`, debe llamar internamente a `markApnsTokenInvalid`. Los registros inválidos o revocados no deben incluirse en envíos posteriores.

## Privacidad y registros

Los tokens APNs son identificadores sensibles. No deben aparecer en respuestas, analítica, logs ni mensajes de error. La eliminación del usuario elimina sus instalaciones mediante cascada.
