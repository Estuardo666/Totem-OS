/**
 * Autorización de las rutas de cron.
 *
 * Acepta dos orígenes: el propio scheduler de Vercel, que marca sus peticiones
 * con `x-vercel-cron-id`, o una llamada manual con `Authorization: Bearer
 * $CRON_SECRET`.
 *
 * Falla cerrado: sin CRON_SECRET configurado, una petición con Bearer nunca
 * pasa. De lo contrario un despliegue mal configurado dejaría los crons
 * abiertos a cualquiera.
 */

export interface CronAuthInput {
  authorizationHeader: string | null;
  vercelCronHeader: string | null;
  /** Solo para la variante GET de diagnóstico manual: ?secret=... */
  secretParam?: string | null;
  cronSecret: string | undefined;
}

export function isAuthorizedCronRequest(input: CronAuthInput): boolean {
  if (input.vercelCronHeader) return true;

  const secret = input.cronSecret;
  if (!secret) return false;

  if (input.authorizationHeader === `Bearer ${secret}`) return true;

  // La comparación del parámetro exige un valor no vacío para que `?secret=`
  // sin valor no coincida con un CRON_SECRET ausente.
  if (input.secretParam && input.secretParam === secret) return true;

  return false;
}
