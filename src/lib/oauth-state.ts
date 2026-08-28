import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Protección de correlación para los flujos OAuth manuales (Google Calendar y Meta).
 *
 * Sin `state`, el callback acepta cualquier `code` que llegue: un atacante puede
 * inducir a un usuario autenticado a completar un flujo iniciado por el atacante
 * y dejar la cuenta ajena conectada a la suya (conexión cruzada / CSRF de login).
 * El `state` se guarda en una cookie httpOnly y se compara al volver; si no
 * coincide, el callback se rechaza.
 *
 * PKCE añade la segunda mitad: el `code` solo sirve si quien lo canjea conoce el
 * verificador que originó el desafío, así que un código interceptado no basta.
 */

const MAX_AGE_SECONDS = 10 * 60;

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function createState(): string {
  return base64url(randomBytes(32));
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** Comparación en tiempo constante, tolerante a longitudes distintas. */
export function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function setOAuthCookie(name: string, value: string): Promise<void> {
  const store = await cookies();
  store.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` permite que la cookie viaje en la navegación de vuelta del proveedor,
    // que es un GET de nivel superior; `strict` la bloquearía y rompería el flujo.
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readOAuthCookie(name: string): Promise<string | undefined> {
  const store = await cookies();
  return store.get(name)?.value;
}

export async function clearOAuthCookies(...names: string[]): Promise<void> {
  const store = await cookies();
  for (const name of names) {
    store.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
}

export const GOOGLE_STATE_COOKIE = "gcal_oauth_state";
export const GOOGLE_VERIFIER_COOKIE = "gcal_oauth_verifier";
export const META_STATE_COOKIE = "meta_oauth_state";
