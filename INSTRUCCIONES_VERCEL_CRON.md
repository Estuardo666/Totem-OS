# ✅ TODO LISTO - Sigue estos 3 pasos en Vercel

## Paso 1: Agregar variable de entorno en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Click en **Settings** (menú izquierdo)
3. Click en **Environment Variables**
4. Click en **Add New**
5. Llena así:

```
Name: CRON_SECRET
Value: bb13da8ced4026e79a6175e7de98caa695c1b71a77374f173b7ee0b3f56ff36e
```

6. Selecciona: **Production**, **Preview** y **Development** (los 3)
7. Click **Save**

---

## Paso 2: Hacer commit y push

```bash
git add .
git commit -m "feat: add Vercel cron for daily digest at 8am"
git push
```

Vercel automáticamente va a deployar. Espera 2-3 minutos.

---

## Paso 3: Verificar que funcionó

### En Vercel Dashboard:
1. Ve a **Deployments**
2. Click en el deployment más reciente (el que acabas de hacer)
3. Busca la sección **Cron Jobs**
4. Deberías ver:
   ```
   Path: /api/cron/daily-digest
   Schedule: 0 13 * * * (Every day at 1:00 PM UTC)
   Status: Active
   ```

### Probar manualmente AHORA:
Abre esta URL en tu navegador (reemplaza `tu-app` con tu dominio de Vercel):

```
https://tu-app.vercel.app/api/cron/daily-digest?secret=bb13da8ced4026e79a6175e7de98caa695c1b71a77374f173b7ee0b3f56ff36e
```

Deberías ver:
```json
{
  "success": true,
  "message": "Digest enviado a X usuarios",
  "data": {
    "sentCount": 3,
    "totalTasks": 8
  }
}
```

---

## 🎉 ¡Listo!

A partir de mañana, todos los días a las **8:00 AM (hora de Ecuador)**, los usuarios recibirán automáticamente:

📱 **"Tienes 5 tareas programadas para hoy"**
Con logo del cliente y detalle de cuántos Reels, Flyers y Stories.

---

## 🆘 Si algo falla

**No aparece "Cron Jobs" en Vercel:**
- Asegúrate que `vercel.json` esté en la raíz del proyecto
- Verifica que el commit y push se hayan hecho correctamente

**Error 401 al probar la URL:**
- Verifica que copiaste bien el `CRON_SECRET` en Vercel
- Espera 2 minutos después del deploy

**¿Preguntas?**
Avísame y te ayudo 🚀
