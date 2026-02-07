# 🔔 Guía para Activar Notificaciones PUSH

## ✅ Estado Actual

- ✅ Backend: Configurado y funcionando
- ✅ OneSignal: Integrado correctamente  
- ✅ Variables de entorno: Configuradas
- ⚠️ **Frontend: Provider REACTIVADO (requiere reload de la app)**

## 📋 Pasos para Probar

### 1. Limpia los Player IDs antiguos (opcional pero recomendado)

```powershell
npx tsx clean-old-players.ts
```

### 2. Reinicia el servidor de desarrollo

```powershell
npm run dev
```

### 3. Abre la app en el navegador

- Ve a `http://localhost:3000`
- Inicia sesión como admin

### 4. Acepta el permiso de notificaciones

Cuando aparezca el popup del navegador pidiendo permiso para notificaciones:
- ✅ **Acepta/Allow**

### 5. Verifica la suscripción

Abre la consola del navegador (F12) y busca mensajes como:
```
[OneSignal] SDK inicializado correctamente
[OneSignal] PlayerId obtenido: xxxxxx-xxxx-xxxx
[OneSignal] PlayerId registrado en BD
[OneSignal] Usuario registrado y etiquetado
```

### 6. Prueba las notificaciones

En una nueva terminal:
```powershell
npx tsx test-push-quick.ts
```

Deberías recibir:
- ✅ Notificación PUSH en tu navegador/dispositivo
- ✅ Notificación in-app en el dashboard

## 🔧 Troubleshooting

### No aparece el popup de permisos

1. Verifica que estés en `localhost` o `https://`
2. Revisa permisos del navegador en settings
3. Intenta en modo incógnito

### Errores en consola

- `OneSignal is not defined`: Espera unos segundos, el SDK se carga async
- `App ID no configurado`: Verifica `.env`

### No recibo notificaciones

1. Verifica que el ícono de notificaciones del navegador esté activo
2. Revisa la consola por errores
3. Ejecuta el diagnóstico: `npx tsx test-push-diagnosis.ts`

## 📱 Producción

Para que funcione en producción:
1. Tu dominio DEBE usar **HTTPS**
2. Los Service Workers solo funcionan en dominios seguros
3. Verifica que `OneSignalSDKWorker.js` esté desplegado en `/public/`
