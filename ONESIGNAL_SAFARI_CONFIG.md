# 🍎 Configuración de OneSignal para iOS/Safari

## 🔴 Problema: Notificaciones no llegan en iPhone

Si instalaste la app en Safari en iOS (iPhone) pero **NO recibe notificaciones push**, es porque falta la configuración del **Safari Web ID** en OneSignal.

---

## ✅ Solución

### Paso 1: Obtener el Safari Web ID en OneSignal

1. **Ve a** [OneSignal Dashboard](https://dashboard.onesignal.com)
2. **Selecciona tu app** de Totem OS
3. **Ve a Settings** → **Platforms** → **Apple → Web**
4. En la sección **Safari**, verás el **Safari Web ID** (formato: `web.onesignal.auto.XXXXXXX`)
5. **Copia este ID**

![Safari Web ID Location](./docs/screenshots/onesignal-safari-web-id.png)

### Paso 2: Configurar en Variables de Entorno

Abre tu archivo `.env.local` (o `.env` en producción) y agrega:

```env
NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID=web.onesignal.auto.XXXXXXX
```

**Reemplaza** `XXXXXXX` con tu Safari Web ID real.

### Paso 3: Completar la configuración de OneSignal Safari en Settings

En OneSignal Dashboard → Settings → Platforms → Apple Web:

1. **Safari Web ID**: `web.onesignal.auto.XXXXXXX` ✅ (ya configurado)
2. **Safari Icon (256x256)**: Carga un icono PNG para las notificaciones en Safari
3. **Default Notification Title**: "Totem OS"
4. **Default Notification Icon**: 256x256 PNG

### Paso 4: Redeploy la App

Después de actualizar `.env`, debes reiniciar la app:

```bash
npm run dev
# o en producción
npm run build && npm start
```

### Paso 5: Probar

1. **Accede a la app** desde Safari en tu iPhone
2. Ve a `/admin` (si eres admin)
3. Auténticate
4. **Acepta el permiso de notificaciones** cuando aparezca el popup
5. Ejecuta el test de notificaciones:

```bash
npx tsx test-push-quick.ts
```

Deberías recibir una **notificación push** en tu iPhone.

---

## 🔍 Troubleshooting

### ❌ "No me pide permiso para notificaciones"

**En Safari iOS**, el permiso de notificaciones es diferente:

1. Abre **Settings** → **Safari** → **Notifications** → **Totem OS** → **Allow**
2. Luego recarga la app

### ❌ "Aparece el permiso pero sigo sin recibir notificaciones"

1. Verifica en Safari → Settings → Notifications que Totem OS tenga permisos
2. Verifica que `NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID` esté configurado
3. Reinicia Safari completamente (desliza arriba desde el multitarea)
4. Recarga la URL de la app

### ❌ "Veo el error: 'Safari Web ID not configured'"

Significa que `NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID` no se pasó correctamente. Verifica:

1. La variable está en `.env.local`
2. El servidor se reinició después de cambiar `.env`
3. El valor no tiene comillas extra: `web.onesignal.auto.XXXXX` (no `"web.onesignal..."`)

---

## 📱 Plataformas Soportadas

| Plataforma | Estado | Requisito |
|-----------|--------|-----------|
| iOS Safari (Home Screen) | ✅ | Safari Web ID |
| Android Chrome | ✅ | Configurado automáticamente |
| Desktop Safari (Web) | ⚠️ | Safari Web ID (opcional) |
| Firefox | ✅ | Automático |
| Edge | ✅ | Automático |

---

## 📊 Ver Suscripciones

Para verificar que los users se están registrando correctamente:

1. **OneSignal Dashboard** → **Audience** → **Subscriptions**
2. Filtra por **Device Type** = `iOS` o `Safari`
3. Deberías ver registros recientes

---

## 🔐 Variables de Entorno Requeridas

```env
# Backend (para enviar notificaciones)
ONESIGNAL_APP_ID=xxx
ONESIGNAL_REST_API_KEY=xxx

# Frontend
NEXT_PUBLIC_ONESIGNAL_APP_ID=xxx
NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID=web.onesignal.auto.XXXXX  # CRÍTICO para iOS
```

---

## 📝 Notas Importantes

- El **Safari Web ID** es **diferente** del App ID regular
- Se requiere para que iOS Safari reconozca las notificaciones
- Sin él, OneSignal no sabe a qué app enviar las notificaciones en iOS
- Cada plataforma (Web, iOS, Android) tiene su propia configuración

---

## ✨ Una vez configurado

Una vez que hayas configurado el Safari Web ID:

1. Admins recibirán notificaciones push automáticamente
2. Todas las notificaciones del sistema llegarán al iPhone
3. Las notificaciones funcionan en segundo plano incluso si Safari está cerrado

¡Disfruta de las notificaciones push en iOS! 🎉
