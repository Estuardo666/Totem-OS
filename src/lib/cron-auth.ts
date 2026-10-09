/**
 * Autorización de las rutas de cron.
 *
 * La única credencial válida es `Authorization: Bearer $CRON_SECRET`. Vercel
 * la envía sola en cada ejecución programada cuando la variable existe.
 *
 * No se confía en `x-vercel-cron-id`: es una cabecera común que cualquier
 * cliente puede enviar, así que aceptarla dejaba los crons abiertos.
 * Tampoco se acepta el secreto en la query (`?secret=`): las URLs quedan en
 * los logs de la plataforma y del navegador.
 *
 * Falla cerrado: sin CRON_SECRET configurado, ninguna petición pasa.
 */

import { timingSafeEqual } from "node:crypto";

export interface CronAuthInput {
  authorizationHeader: string | null;
  cronSecret: string | undefined;
}

export function isAuthorizedCronRequest(input: CronAuthInput): boolean {
  const secret = input.cronSecret;
  if (!secret || !input.authorizationHeader) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(input.authorizationHeader);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Atajo para las rutas: lee la cabecera y el secreto del entorno. */
export function isAuthorizedCron(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
  });
}

/**
 * Variante legacy `x-cron-secret: $CRON_SECRET`, que solo usa monthly-payments.
 * Mismas reglas: falla cerrado y compara en tiempo constante.
 */
export function isAuthorizedCronSecretHeader(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const received = request.headers.get("x-cron-secret");
  if (!secret || !received) return false;
  return isAuthorizedCronRequest({
    authorizationHeader: `Bearer ${received}`,
    cronSecret: secret,
  });
}
