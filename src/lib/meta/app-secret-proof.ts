/**
 * `appsecret_proof` para las llamadas a Graph.
 *
 * Es el HMAC-SHA256 del token con el secreto de la app que emitió el token.
 * Con la opción "Requerir secreto de la app" activada en Meta Developers,
 * Graph rechaza cualquier llamada sin esta prueba: un token filtrado deja de
 * servir fuera del servidor, porque quien lo robó no tiene el secreto.
 *
 * Ojo: Graph rechaza una prueba hecha con el secreto de OTRA app ("Invalid
 * appsecret_proof"). El token de usuario del sistema puede venir de una app
 * distinta a la de META_APP_SECRET (la del login OAuth), así que en ese modo
 * solo se firma con META_SYSTEM_USER_APP_SECRET, y si no está, no se firma.
 *
 * Sin alias `@/` para que las pruebas unitarias puedan importarlo.
 */

import { createHmac } from "node:crypto";

/** Secreto de la app que emitió el token que usa la app hoy. */
export function resolveProofSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.META_SYSTEM_USER_TOKEN?.trim()) {
    return env.META_SYSTEM_USER_APP_SECRET?.trim() || undefined;
  }
  return env.META_APP_SECRET?.trim() || undefined;
}

export function appSecretProof(
  accessToken: string,
  appSecret: string | undefined = resolveProofSecret()
): string | null {
  if (!appSecret || !accessToken) return null;
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

/** Agrega `appsecret_proof` a los parámetros de una llamada, si hay secreto. */
export function withAppSecretProof(
  params: URLSearchParams,
  accessToken: string
): URLSearchParams {
  const proof = appSecretProof(accessToken);
  if (proof) params.set("appsecret_proof", proof);
  return params;
}
