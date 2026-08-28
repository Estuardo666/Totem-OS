# Totem OS para iOS

Base SwiftUI para `com.totemmassmedia.totemos`. La primera versión reutiliza la sesión web de Totem OS dentro de `WKWebView`; así evita duplicar autenticación o introducir tokens nativos antes de auditar ese contrato.

## Qué incluye

- Contenedor SwiftUI para `https://totem-os.vercel.app`.
- Cookies persistentes de `WKWebView` para conservar la sesión.
- Inicio de sesión por correo y contraseña. Google OAuth se oculta dentro de la app porque Google no permite ese flujo en navegadores embebidos.
- Registro APNs después de que el usuario inicia sesión.
- Revocación de la instalación APNs antes del cierre de sesión normal o remoto.
- Contrato compatible con `POST /api/push/apns`.
- UUID estable por instalación almacenado en `UserDefaults`.
- Entornos APNs separados: `SANDBOX` en Debug y `PRODUCTION` en Release.
- Privacy Manifest para el uso de `UserDefaults`.
- Build y pruebas automáticas con Xcode 26.2 en GitHub Actions.

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
