# Totem OS para iOS

Base SwiftUI para `com.totemmassmedia.totemos`. El login es nativo y reutiliza el contrato CSRF, proveedor `credentials` y cookie de sesión de Auth.js; no mantiene un segundo sistema de autenticación ni duplica las reglas de usuarios y roles.

## Qué incluye

- Contenedor SwiftUI para `https://totem-os.vercel.app`.
- Cookies persistentes de `WKWebView` para conservar la sesión.
- Inicio de sesión SwiftUI por correo y contraseña. La app obtiene el CSRF oficial, valida la sesión y transfiere las cookies HTTPS al `WKWebView`.
- Las contraseñas permanecen solo durante la petición y no se guardan en `UserDefaults`, Keychain ni el repositorio.
- Google OAuth no se ofrece todavía en iOS; requiere Google Sign-In nativo y su propio contrato de backend.
- Registro APNs después de que el usuario inicia sesión.
- Revocación de la instalación APNs antes del cierre de sesión normal o remoto.
- Contrato compatible con `POST /api/push/apns`.
- UUID estable por instalación almacenado en `UserDefaults`.
- Entornos APNs separados: `SANDBOX` en Debug y `PRODUCTION` en Release.
- Privacy Manifest para el uso de `UserDefaults`.
- Build y pruebas automáticas con el Xcode más reciente disponible en GitHub Actions.

## Generar el proyecto en un Mac

```bash
cd ios/TotemOS
brew install xcodegen
xcodegen generate
open TotemOS.xcodeproj
```

El archivo `.xcodeproj` se genera y no debe editarse manualmente. Antes de instalar en un iPhone, selecciona tu Apple Development Team en Signing & Capabilities y confirma que Push Notifications esté habilitado para el App ID.

## Configuración

La URL productiva está declarada como `TOTEM_BASE_URL` en `project.yml`. No se almacenan contraseñas, cookies ni certificados en el repositorio.

Para que el backend acepte el dispositivo, Vercel debe conservar:

```env
APNS_BUNDLE_ID=com.totemmassmedia.totemos
```

El simulador compila y ejecuta la interfaz, pero no entrega un token APNs real. El registro completo se valida mediante un build firmado instalado en un iPhone o distribuido por TestFlight.
