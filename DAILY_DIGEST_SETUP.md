# Configuración de Smart Digest Diario

Este documento explica cómo configurar el envío automático del digest diario de tareas a las 8am (hora de Ecuador).

## 📋 Resumen

El smart digest consolida todas las tareas programadas para el día en **UNA SOLA notificación** por usuario, evitando spam de notificaciones individuales.

**Características:**
- ✅ Ejecuta todos los días a las 8:00 AM (Ecuador = UTC-5)
- ✅ Agrupa tareas por usuario
- ✅ Incluye rich media (logo del cliente)
- ✅ Detalla cantidad de Reels, Flyers y Stories
- ✅ Notificación in-app + PUSH (OneSignal)

---

## 🔧 Configuración paso a paso

### 1️⃣ **Agregar variable de entorno**

Edita tu archivo `.env` y agrega:

```env
# Secret para proteger endpoints de cron
CRON_SECRET="tu-secreto-aleatorio-muy-seguro-123456"
```

⚠️ **Importante:** Genera un secreto fuerte y único. Ejemplo:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 2️⃣ **Configurar Cron Job**

Elige una de las siguientes opciones según tu plataforma de hosting:

#### **Opción A: cPanel Cron Jobs** (recomendado para Totem OS)

1. Ingresa a cPanel → **Cron Jobs**
2. Crea un nuevo cron con esta configuración:

**Horario:**
```
Minuto: 0
Hora: 13
Día: *
Mes: *
Día de semana: *
```
> 🕐 **Nota:** 13:00 UTC = 8:00 AM Ecuador (UTC-5)

**Comando:**
```bash
curl -X POST https://tu-dominio.com/api/cron/daily-digest \
  -H "Authorization: Bearer tu-secreto-aleatorio-muy-seguro-123456"
```

Reemplaza:
- `tu-dominio.com` → Tu dominio real de Totem OS
- `tu-secreto-aleatorio-muy-seguro-123456` → El valor de `CRON_SECRET` de tu `.env`

---

#### **Opción B: Vercel Cron** (si migras a Vercel)

Agrega en `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 13 * * *"
    }
  ]
}
```

Y actualiza `src/app/api/cron/daily-digest/route.ts` para verificar el header de Vercel:

```typescript
// Verificar que viene de Vercel Cron
if (process.env.VERCEL === "1") {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
```

---

#### **Opción C: GitHub Actions** (gratis, alternativa externa)

Crea `.github/workflows/daily-digest.yml`:

```yaml
name: Daily Task Digest
on:
  schedule:
    - cron: '0 13 * * *'  # 13:00 UTC = 8am Ecuador
  workflow_dispatch:  # Permite ejecutar manualmente

jobs:
  send-digest:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger digest endpoint
        run: |
          curl -X POST https://tu-dominio.com/api/cron/daily-digest \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Luego agrega el secreto en GitHub:
1. Repo → Settings → Secrets → Actions
2. Crea `CRON_SECRET` con el mismo valor de tu `.env`

---

### 3️⃣ **Probar el endpoint manualmente**

Ejecuta en tu terminal para probar:

```bash
curl -X POST http://localhost:3000/api/cron/daily-digest \
  -H "Authorization: Bearer tu-secreto-aleatorio-muy-seguro-123456"
```

O desde el navegador (solo para testing):
```
http://localhost:3000/api/cron/daily-digest?secret=tu-secreto-aleatorio-muy-seguro-123456
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Digest enviado a 3 usuarios",
  "data": {
    "sentCount": 3,
    "totalTasks": 8
  }
}
```

---

## 📊 Ejemplo de notificación recibida

**Usuario Editor (4 tareas para hoy):**

🔔 **Notificación PUSH:**
```
Título: Tienes 4 tareas programadas para hoy
Mensaje: Coca Cola, Nike, Adidas • 2 Reels, 1 Flyer, 1 Story
Imagen: [Logo de Coca Cola]
```

**Usuario sin tareas:**
```
📭 No recibe notificación (solo se notifica a usuarios con tareas programadas)
```

---

## 🛠️ Troubleshooting

### El cron no se ejecuta

1. **Verificar logs del servidor:**
   - cPanel: Acceso y logs de errores → error_log
   - Vercel: Dashboard → Logs → Cron

2. **Verificar zona horaria:**
   ```bash
   # Debe mostrarte UTC-5 (Ecuador)
   echo "America/Guayaquil"
   ```

3. **Probar endpoint manualmente** (ver sección 3️⃣)

### Las notificaciones no llegan

1. **Verificar que OneSignal esté configurado:**
   ```env
   ONESIGNAL_APP_ID=xxx
   ONESIGNAL_REST_API_KEY=xxx
   ```

2. **Verificar que los usuarios tengan playerIds registrados:**
   ```sql
   SELECT * FROM OneSignalPlayer WHERE subscribed = 1;
   ```

3. **Revisar logs en OneSignal dashboard:**
   - OneSignal Dashboard → Delivery → View Details

---

## 🔄 Actualización futura: Horario personalizado

Si en el futuro quieres permitir que cada usuario configure su horario preferido:

1. Agregar campo `digestTime` a tabla `User` (ej: "08:00")
2. Modificar cron para ejecutar cada hora
3. Filtrar usuarios por `digestTime` en `sendDailyTaskDigest()`

---

## ✅ Checklist de implementación

- [ ] Agregar `CRON_SECRET` a `.env` y `.env.production`
- [ ] Configurar cron job en cPanel/Vercel/GitHub Actions
- [ ] Probar endpoint manualmente con curl
- [ ] Verificar que las notificaciones lleguen con imagen
- [ ] Monitorear logs por 3 días para detectar errores

---

**Última actualización:** Febrero 8, 2026  
**Archivo de implementación:** `/src/app/api/cron/daily-digest/route.ts`  
**Función principal:** `sendDailyTaskDigest()` en `/src/actions/notification-actions.ts`
