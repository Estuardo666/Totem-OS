/**
 * `appsecret_proof` para las llamadas a Graph.
 *
 * Es el HMAC-SHA256 del token con el secreto de la app. Con la opción
 * "Requerir secreto de la app" activada en Meta Developers, Graph rechaza
 * cualquier llamada sin esta prueba: un token filtrado deja de servir fuera
 * del servidor, porque quien lo robó no tiene el secreto.
 *
 * Sin alias `@/` para que las pruebas unitarias puedan importarlo.
 */

import { createHmac } from "node:crypto";

export function appSecretProof(
  accessToken: string,
  appSecret: string | undefined = process.env.META_APP_SECRET
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
