# Cron jobs

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

Todas aceptan `POST` con `Authorization: Bearer $CRON_SECRET`, y `GET` con
`?secret=$CRON_SECRET` para diagnóstico:

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
