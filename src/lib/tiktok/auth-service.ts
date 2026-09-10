/**
 * Autenticación de TikTok (Login Kit v2).
 *
 * A diferencia de Meta, TikTok sí emite refresh_token: el access token vive
 * 24 horas y el de refresco 365 días. Eso obliga a renovar en línea antes de
 * cada llamada, no solo en un cron diario.
 */

const AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIMEOUT_MS = 10000;

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/callback/tiktok`;

/**
 * Permisos solicitados. Todos de lectura: Totem no publica en TikTok.
 *
 * - user.info.basic: identidad del perfil (open_id, nombre, avatar)
 * - user.info.stats: seguidores, likes y número de videos
 * - video.list:      lista de videos con sus métricas
 */
export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.stats",
  "video.list",
] as const;

export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number; // 86400 (24 h)
  refresh_token: string;
  refresh_expires_in: number; // 31536000 (365 d)
  open_id: string;
  scope: string;
  token_type: string;
}

/** El token de TikTok caducó y su refresh ya no sirve: hay que reconectar. */
export class TikTokAuthError extends Error {
  constructor(
    message: string = "La conexión con TikTok expiró. Vuelve a conectar la cuenta."
  ) {
    super(message);
    this.name = "TikTokAuthError";
  }
}

export function isTikTokConfigured(): boolean {
  return Boolean(TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET);
}

function requireConfig(): { key: string; secret: string } {
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    throw new Error(
      "TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET deben estar configurados. " +
        "Se obtienen registrando la app en developers.tiktok.com."
    );
  }
  return { key: TIKTOK_CLIENT_KEY, secret: TIKTOK_CLIENT_SECRET };
}

/**
 * URL del diálogo de autorización.
 * El `state` se valida en el callback contra una cookie httpOnly, igual que Meta.
 */
export function getTikTokAuthorizationUrl(state: string): string {
  const { key } = requireConfig();

  const params = new URLSearchParams({
    client_key: key,
    scope: TIKTOK_SCOPES.join(","),
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state,
  });

  return `${AUTH_BASE}?${params.toString()}`;
}

/**
 * TikTok responde siempre 200 y señala el fallo dentro del cuerpo, en
 * `error` (para /oauth) o `error.code !== "ok"` (para el resto). Comprobar
 * solo `response.ok` dejaría pasar errores como si fueran datos.
 */
function assertTikTokOk(payload: Record<string, unknown>): void {
  const error = payload.error;

  // Forma del endpoint de OAuth: { error: "...", error_description: "..." }
  if (typeof error === "string" && error && error !== "ok") {
    const description = payload.error_description;
    const message = typeof description === "string" ? description : error;
    if (/invalid_grant|expired/i.test(`${error} ${message}`)) {
      throw new TikTokAuthError();
    }
    throw new Error(`TikTok: ${message}`);
  }

  // Forma del resto de la API: { error: { code, message, log_id } }
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: string; message?: string };
    if (code && code !== "ok") {
      if (/access_token_invalid|scope_not_authorized|invalid_grant/i.test(code)) {
        throw new TikTokAuthError();
      }
      throw new Error(`TikTok: ${message || code}`);
    }
  }
}

async function postToken(body: Record<string, string>): Promise<TikTokTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // TikTok exige este header en el endpoint de token.
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  const payload = await response.json();
  assertTikTokOk(payload);

  if (!payload.access_token) {
    throw new Error("TikTok no devolvió un token de acceso.");
  }

  return payload as TikTokTokenResponse;
}

/** Intercambia el código del callback por un par de tokens. */
export async function exchangeTikTokCodeForToken(
  code: string
): Promise<TikTokTokenResponse> {
  const { key, secret } = requireConfig();

  return postToken({
    client_key: key,
    client_secret: secret,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
  });
}

/**
 * Renueva el access token.
 *
 * TikTok rota el refresh_token en cada renovación: la respuesta trae uno
 * nuevo y el anterior deja de servir, así que hay que guardar ambos.
 */
export async function refreshTikTokToken(
  refreshToken: string
): Promise<TikTokTokenResponse> {
  const { key, secret } = requireConfig();

  return postToken({
    client_key: key,
    client_secret: secret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
