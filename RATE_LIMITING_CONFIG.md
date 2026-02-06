# Rate Limiting Configuration - Totem OS

## Overview
Rate limiting protege los endpoints críticos contra ataques de fuerza bruta, spam y DoS.

Implementación: **In-memory store** (sin necesidad de Redis)
- Ideal para cPanel/single-server setup
- Auto-limpieza cada 5 minutos
- Identifica clientes por IP

---

## Límites por Endpoint

### 🔴 **Crítico: API de Transcripción & TTS**
| Endpoint | Límite | Ventana | Uso |
|----------|--------|---------|-----|
| `POST /api/transcribe` | 10/min | 60s | Conversión voz→texto |
| `POST /api/tts` | 10/min | 60s | Conversión texto→voz |

**Cuándo se activa:** Si usuario hace >10 requests en 60 segundos
**Respuesta:** HTTP 429 + header `Retry-After`

### 🟠 **Alto: Registro & Bootstrap**
| Endpoint | Límite | Ventana | Uso |
|----------|--------|---------|-----|
| `POST /api/onesignal/register` | 30/min | 60s | Registro de push notifications |
| `GET /api/voice/bootstrap` | 60/min | 60s | Inicialización de voice control |

---

## Response Format (Rate Limited)

### Status Code: 429 (Too Many Requests)
```json
{
  "error": "Demasiados intentos. Inténtalo más tarde.",
  "retryAfter": 45
}
```

### Response Headers
```
Retry-After: 45
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-02-06T14:30:45.000Z
```

**Cliente debe:** Wait `Retry-After` segundos antes de reintentar

---

## Uso Normal (Sin Límite Activado)

### Response Headers
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 2026-02-06T14:30:45.000Z
```

---

## How It Works

### 1. Detección de Cliente
```typescript
// Orden de confianza para extraer IP:
1. X-Forwarded-For (proxies)
2. X-Real-IP (nginx)
3. CF-Connecting-IP (Cloudflare)
4. X-Client-IP (otros)
5. "unknown" (fallback)
```

### 2. Contador por Bucket
```typescript
// Ventanas de tiempo: cada minuto es una "ventana"
Ventana 1: 00:00-00:59 → hasta 10 requests
Ventana 2: 01:00-01:59 → hasta 10 requests (contador reset)

// Si solicitud en ventana 2, ventana 1 se borra
```

### 3. Auto-Limpieza
```typescript
// Cada 5 minutos:
- Elimina buckets expirados
- Libera memoria automáticamente
- Sin necesidad de mantenimiento
```

---

## Testing

### Simular Rate Limit (Transcribe)
```bash
# Bash script para probar
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/transcribe \
    -F "file=@audio.wav" &
done
wait

# Deberías ver:
# - Respuestas 200 en requests 1-10
# - Respuestas 429 en requests 11-15
```

### Check de Límites Actuales
```typescript
// En servidor (debugging):
import { getRateLimitInfo } from "@/lib/rate-limiter";

const info = getRateLimitInfo("192.168.1.100", "transcribe", 10, 60000);
console.log(info);
// { allowed: true, remaining: 7, resetTime: ... }
```

---

## Production Considerations

### ✅ Lo que funciona bien en cPanel
- ✅ In-memory store (una máquina)
- ✅ No requiere Redis
- ✅ Auto-limpieza eficiente
- ✅ Bajo overhead (µs por request)

### ⚠️ Limitaciones
- ❌ **Si escalas a múltiples servidores:** Cada servidor tiene su propio contador
  - Solución: Implementar Redis después
- ❌ **Si reinicia servidor:** Contadores se resetean
  - Impacto: Mínimo (5 min de historial)

### 🔧 Futuro: Migrar a Redis
```typescript
// Cuando escales a múltiples servidores:
// 1. Instalar Redis en cPanel o cloud
// 2. Cambiar store de Map a Redis hash
// 3. Mismo interface, funciona igual
```

---

## API de Rate Limiter

### `checkRateLimit(identifier, bucket, limit, windowMs)`
```typescript
import { checkRateLimit } from "@/lib/rate-limiter";

const result = checkRateLimit(
  "192.168.1.100",      // IP del cliente
  "transcribe",         // nombre del bucket
  10,                   // máximo de intentos
  60 * 1000             // ventana en millisegundos
);

// Retorna:
// {
//   allowed: boolean
//   remaining: number
//   resetTime: number (timestamp)
//   retryAfter?: number (segundos)
// }
```

### `getClientIP(request)`
```typescript
import { getClientIP } from "@/lib/rate-limiter";

const ip = getClientIP(request);
// "192.168.1.100" o "unknown"
```

### `resetRateLimit(identifier, bucket)`
```typescript
import { resetRateLimit } from "@/lib/rate-limiter";

// Para emergencias (e.j.: usuario bloqueado injustamente)
resetRateLimit("192.168.1.100", "transcribe");
```

---

## Monitoreo

### Logs recomendados (agregar después)
```typescript
if (!rateLimitResult.allowed) {
  // Log para análisis
  console.warn(`[RATE_LIMIT] ${clientIP} ${bucket}: ${attempt} intentos`);
  
  // Opcional: enviar a analytics
  sendToMonitoring({ clientIP, bucket, status: 429 });
}
```

### Alertas recomendadas
- 🔴 Si IP > 3 bloques en 10 min → Posible ataque
- 🟡 Si recurso crece > 1GB → Limpiar más frecuentemente

---

## Cambios por Implementar

### ✅ HECHO (HOY)
- [x] Rate limiter utility (`src/lib/rate-limiter.ts`)
- [x] Protección en `/api/transcribe`
- [x] Protección en `/api/tts`
- [x] Protección en `/api/onesignal/register`
- [x] Protección en `/api/voice/bootstrap`

### ⏳ PRÓXIMO SPRINT
- [ ] Agregar logging/alertas
- [ ] Migrar a Redis (si escala)
- [ ] Dashboard de rate limiting admin
- [ ] Whitelisting de IPs (para partners)
- [ ] Rate limiting adaptativo (aumentar límites con histórico)

---

## Referencias

- **OWASP:** https://owasp.org/www-community/attacks/Brute_force_attack
- **RFC 6585:** HTTP Status 429 Too Many Requests
- **Best Practices:** Rack recommended: 1-10 req/min para auth, 100+ para API público
