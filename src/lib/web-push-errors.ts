const APPLE_REASONS = new Set(["VapidPkHashMismatch", "BadJwtToken", "BadTtl", "BadUrgency", "BadWebPushRequest", "PayloadEmpty", "PayloadTooLarge"]);

export function classifyWebPushFailure(error: unknown, endpoint: string) {
  const failure = error as { statusCode?: number; status?: number; body?: string } | null;
  const status = failure?.statusCode ?? failure?.status ?? 0;
  const host = new URL(endpoint).hostname;
  let reason: string | null = null;
  try {
    const value = JSON.parse(failure?.body ?? "").reason;
    if (typeof value === "string" && APPLE_REASONS.has(value)) reason = value;
  } catch { /* Never publish arbitrary provider bodies or credentials. */ }
  const retire = status === 404 || status === 410
    || (host === "web.push.apple.com" && status === 400 && reason === "VapidPkHashMismatch")
    || (host.endsWith(".notify.windows.com") && status === 401);
  return { status, host, reason, retire };
}
