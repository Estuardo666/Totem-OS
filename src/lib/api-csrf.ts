import { timingSafeEqual } from "crypto";
import { ApiProblem, type ApiRequestContext } from "./api-kernel.ts";

export const API_CSRF_COOKIE = "totem.csrf-token";
export const API_CSRF_HEADER = "x-csrf-token";
const API_CSRF_MAX_AGE_SECONDS = 24 * 60 * 60;

function readCookieHeader(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key !== name) continue;
    const value = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

function safeEqualToken(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

export function csrfTokenFromRequest(request: Request): string | null {
  return readCookieHeader(request, API_CSRF_COOKIE);
}

export function validateCsrf(context: ApiRequestContext): void {
  if (isSafeMethod(context.request.method)) return;

  const cookieToken = csrfTokenFromRequest(context.request);
  const headerToken = context.request.headers.get(API_CSRF_HEADER);
  if (!safeEqualToken(cookieToken, headerToken)) {
    throw new ApiProblem({
      status: 403,
      code: "CSRF_FAILED",
      title: "CSRF validation failed",
      detail: "A matching CSRF cookie and header are required for this request.",
    });
  }
}

function newCsrfToken(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}

/** Emite un token legible por clientes que usan la sesión de cookie de Auth.js. */
export function attachCsrfCookie(response: Response, context: ApiRequestContext): Response {
  if (csrfTokenFromRequest(context.request)) return response;

  const headers = new Headers(response.headers);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append(
    "set-cookie",
    `${API_CSRF_COOKIE}=${newCsrfToken()}; Path=/; SameSite=Lax; Max-Age=${API_CSRF_MAX_AGE_SECONDS}${secure}`
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
