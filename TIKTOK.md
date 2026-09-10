# Integración de TikTok

El código está completo y desplegado. Solo faltan las claves de la app: mientras
no existan, la tarjeta de TikTok en `/admin/settings/integrations` muestra estas
mismas instrucciones y el botón de conectar queda oculto.

## Lo que falta hacer (una vez)

### 1. Registrar la app
En [developers.tiktok.com](https://developers.tiktok.com/) → **Manage apps** →
**Connect an app**.

### 2. Agregar los productos
- **Login Kit** — el flujo OAuth.
- **Display API** — perfil y lista de videos.

### 3. Configurar la URL de retorno
En Login Kit → *Redirect URI*:

```
https://totem-os.vercel.app/api/auth/callback/tiktok
```

Debe coincidir exactamente, incluido el `https://` y sin barra final. TikTok
rechaza el flujo si difiere en un carácter.

### 4. Solicitar los permisos

| Permiso | Para qué |
|---|---|
| `user.info.basic` | Identidad del perfil (open_id, nombre, avatar) |
| `user.info.stats` | Seguidores, me gusta totales, número de videos |
| `video.list` | Lista de videos con vistas, likes, comentarios y compartidos |

Los tres son de **lectura**. Totem no publica ni borra contenido en TikTok, y
deliberadamente no se piden permisos de escritura.

`video.list` suele requerir revisión de TikTok (1-3 días hábiles). Los otros dos
funcionan de inmediato en modo sandbox con las cuentas que agregues como
*target users*.

### 5. Cargar las claves

```bash
vercel env add TIKTOK_CLIENT_KEY production
vercel env add TIKTOK_CLIENT_SECRET production
```

Repetir para `preview` y `development`, y agregarlas también al `.env` local.

### 6. Conectar
Entrar a `/admin/settings/integrations`, pulsar **Conectar con TikTok**,
autorizar, y luego **Probar conexión** para confirmar que la API responde.

## Cómo funciona una vez conectado

**Renovación de tokens.** El access token de TikTok dura **24 horas**, no 60
días como el de Meta. Por eso se renueva *en línea* antes de cada consulta, no
en el cron: cualquier token guardado ayer ya está vencido. TikTok además **rota
el refresh_token** en cada renovación, así que se guardan ambos valores nuevos —
conservar el anterior dejaría la cuenta sin poder renovarse.

El refresh token dura **365 días**. Pasado ese plazo hay que volver a autorizar
a mano; la tarjeta muestra la fecha de vencimiento y avisa si la renovación
falla.

**Los datos son snapshots, no serie histórica.** La Display API solo devuelve
totales actuales: no existe forma de pedir "los seguidores del 3 de agosto". Por
eso el sync guarda un snapshot por día, fechado a medianoche UTC, y los deltas
se calculan al leer diferenciando días consecutivos.

La consecuencia práctica: **lo que no se recolecte hoy se pierde**. Conviene
conectar cuanto antes aunque el informe no se use todavía, porque el histórico
empieza a existir recién desde la primera sincronización.

**Un perfil por conexión.** La Display API autoriza un usuario, no una cartera
de cuentas. Vincular el perfil a un cliente nuevo lo desvincula del anterior.
Para varios clientes con TikTok hace falta una conexión por cliente, o migrar a
la TikTok Business API.

## Métricas que se guardan

En `ClientMetric` con `platform = "TIKTOK"`:

| Métrica | Origen |
|---|---|
| `follower_count` | Total de seguidores del perfil |
| `likes_count` | Me gusta acumulados del perfil |
| `video_count` | Número de videos publicados |
| `video_views` | Suma de vistas de los últimos 20 videos |
| `video_likes` | Suma de me gusta de esos videos |
| `video_comments` | Suma de comentarios |
| `video_shares` | Suma de compartidos |

Las cuatro `video_*` son de la ventana de 20 videos, no del histórico completo
del perfil.

## TikTok Ads

Fuera de alcance. Requiere la **Marketing API**, que es una app y un proceso de
aprobación distintos. Al verificar en septiembre de 2026 no había registro en
TikTok Business Center ni cuenta en Ads Manager, así que no había nada que
integrar.
