# Cron jobs

## WhatsApp — staging desactivado

El worker es el único emisor; las rutas de Vercel solo encolan. Todos los
recordatorios respetan pausa, consentimiento y habilitación de clientes. El
staging tiene `WA_DISABLED=1`, `WA_PAIRING_ONLY=1` y `SRI_ENABLED=0`.

Hay un único cron de Hostinger: ping al `/health` del subdominio de staging cada
minuto. UID `d6tlvmxJDl`; comando termina en `HEALTH_OK` si la solicitud tiene
éxito. No encola mensajes ni llama rutas de Vercel. No hay crons de WhatsApp en
Vercel ni cambios a `vercel.json`.

| Ruta | Horario Ecuador | Cron | Estado |
|---|---|---|---|
| Worker staging `/health` | Cada minuto | `* * * * *` | Activo en Hostinger |
| `/api/cron/whatsapp-team-daily` | 08:00 | `0 13 * * *` | Pendiente de despliegue del backend |
| `/api/cron/shooting-reminders-morning` | 07:00 | `0 12 * * *` | Pendiente |
| `/api/cron/shooting-reminders-hourly` | Cada 15 minutos | `*/15 * * * *` | Pendiente |
| `/api/cron/cobranza-check` | 09:00 | `0 14 * * *` | Pendiente |
| `/api/cron/whatsapp-approval-reminders` | Cada hora, 08:00–19:00 | `0 0,13-23 * * *` | Pendiente |
| `/api/cron/whatsapp-watchdog` | Cada 5 minutos | `*/5 * * * *` | Pendiente |

Antes de instalar crons que llaman las rutas POST de Vercel: comprobar la zona
horaria real del servidor y guardar secretos en `~/.totem_cron` con permisos
600; nunca pegar el Bearer en el panel. Ejemplo sin credenciales literales:

```sh
. ~/.totem_cron && curl -fsS --max-time 60 -X POST -H "Authorization: Bearer $CRON_SECRET" https://totem-os.vercel.app/api/cron/whatsapp-team-daily
```

`daily-digest`, `calendar-webhook-renew`, `monthly-payments`, `sync-compact` y
SRI no se activan dentro de este rollout. Detalles en `docs/WHATSAPP_LOCAL.md`.

## Programados

| Ruta | Horario (UTC) | Hora Ecuador | Qué hace |
|---|---|---|---|
| `/api/cron/sync-social-metrics` | `0 9 * * *` | 04:00 | Renueva el token de Meta y sincroniza métricas de todos los clientes |

## No programados (rutas que existen, pero no corren solas)

El plan de Vercel es **Hobby**: máximo 2 cron jobs y solo con granularidad
diaria. Estas rutas existen y funcionan si se las invoca a mano, pero no están
en `vercel.json`:

| Ruta | Horario deseado | Por qué no está activo |
|---|---|---|
| `/api/cron/daily-digest` | `0 13 * * *` | Envía correos a los usuarios. Nunca ha estado activo. |
| `/api/cron/cobranza-check` | `0 14 * * *` | Nunca ha estado activo. |
| `/api/cron/shooting-reminders-morning` | `0 12 * * *` | Nunca ha estado activo. |
| `/api/cron/shooting-reminders-hourly` | `*/15 * * * *` | Imposible en Hobby: exige granularidad sub-diaria. |
| `/api/cron/calendar-webhook-renew` | `0 */12 * * *` | Imposible en Hobby: dos veces al día. |
| `/api/cron/refresh-social-tokens` | — | Integrado dentro de `sync-social-metrics`. Queda como disparador manual. |
| `/api/cron/monthly-payments` | — | Sin horario definido. |
| `/api/cron/sync-compact` | — | Sin horario definido. |

**Contexto importante:** hasta septiembre de 2026, `vercel.json` estaba cubierto
por la regla `*.json` de `.gitignore`, así que nunca llegó a un despliegue.
Vercel reportaba cero crons definidos: **ninguno de los cinco de arriba había
corrido jamás**. Activarlos ahora no es "restaurar" nada, es estrenar un
comportamiento nuevo —correos a clientes incluidos— y por eso requiere una
decisión explícita.

## Prueba manual

Todas aceptan `POST` y `GET` solo con `Authorization: Bearer $CRON_SECRET`.
El secreto ya no se acepta en la URL (`?secret=`) porque quedaba en los logs, ni
se confía en el header `x-vercel-cron-id`, que cualquiera puede enviar. Vercel
manda el Bearer solo en cada ejecución programada si `CRON_SECRET` está definido:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  -X POST https://totem-os.vercel.app/api/cron/sync-social-metrics
```

`sync-social-metrics` acepta `?days=N` (1-90, por defecto 28) y `?offset=N`
para retomar una corrida que se cortó por tiempo.

## Si se sube a Pro

Con Pro desaparece el límite de 2 crons y la granularidad diaria. Ahí conviene
decidir cuáles de las rutas inactivas se activan, teniendo en cuenta que varias
envían correos.
