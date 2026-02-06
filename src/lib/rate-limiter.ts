/**
 * Simple in-memory rate limiter
 * Ideal para cPanel/solo-server setup
 * 
 * Limpia registros antiguos cada 5 minutos
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

const store = new Map<string, Map<string, RateLimitEntry>>();

// Limpiar registros cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entries] of store.entries()) {
    const filtered = new Map(
      [...entries.entries()].filter(([, entry]) => entry.resetTime > now)
    );
    if (filtered.size === 0) {
      store.delete(key);
    } else {
      store.set(key, filtered);
    }
  }
}, 5 * 60 * 1000);

/**
 * Limitar tasa de peticiones
 * @param identifier ID único (IP, user ID, etc)
 * @param bucket Nombre del bucket (ej: "auth", "transcribe")
 * @param limit Máximo de intentos permitidos
 * @param windowMs Ventana de tiempo en milisegundos
 * @returns Resultado del rate limit check
 */
export function checkRateLimit(
  identifier: string,
  bucket: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const key = `${bucket}:${identifier}`;
  const now = Date.now();

  let buckets = store.get(key);
  if (!buckets) {
    buckets = new Map();
    store.set(key, buckets);
  }

  // Limpiar entries expiradas para este bucket
  const expiredKeys = Array.from(buckets.entries())
    .filter(([, entry]) => entry.resetTime <= now)
    .map(([k]) => k);
  expiredKeys.forEach((k) => buckets!.delete(k));

  // Obtener o crear entry para esta ventana
  const windowKey = `${Math.floor(now / windowMs)}`;
  let entry = buckets.get(windowKey);

  if (!entry) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    buckets.set(windowKey, entry);
  }

  const allowed = entry.count < limit;
  entry.count++;

  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000);

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
    retryAfter,
  };
}

/**
 * Obtener información de un rate limit sin incrementar contador
 */
export function getRateLimitInfo(
  identifier: string,
  bucket: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const key = `${bucket}:${identifier}`;
  const now = Date.now();

  const buckets = store.get(key);
  const windowKey = `${Math.floor(now / windowMs)}`;
  const entry = buckets?.get(windowKey);

  const count = entry?.count ?? 0;
  const remaining = Math.max(0, limit - count);
  const resetTime = entry?.resetTime ?? now + windowMs;

  return {
    allowed: count < limit,
    remaining,
    resetTime,
  };
}

/**
 * Reset manual de un bucket
 */
export function resetRateLimit(identifier: string, bucket: string): void {
  const key = `${bucket}:${identifier}`;
  store.delete(key);
}

/**
 * Obtener IP del cliente (compatible con proxies/cPanel)
 */
export function getClientIP(request: Request | { headers: Headers }): string {
  const headers = request instanceof Request ? request.headers : request.headers;

  // Verificar headers de proxy en orden de confianza
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() || // Cloudflare
    headers.get("x-client-ip")?.trim() ||
    "unknown";

  return ip;
}
