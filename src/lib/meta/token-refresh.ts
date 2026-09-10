/**
 * Renovación del token de larga duración de Meta.
 *
 * Meta no tiene refresh_token: un token largo se renueva volviendo a pasarlo
 * por el mismo intercambio `fb_exchange_token`, que devuelve otro de 60 días.
 */

import { db } from "@/lib/db";
import {
  exchangeForLongLivedToken,
  getManagedPages,
} from "./auth-service.ts";
import {
  getAgencyToken,
  markAgencyRefreshFailed,
  saveAgencyToken,
  writePageToken,
} from "./token-store.ts";
import { needsRefresh, resolveExpiryDate } from "./token-refresh-policy.ts";

export { needsRefresh, REFRESH_THRESHOLD_DAYS } from "./token-refresh-policy.ts";


export interface RefreshResult {
  refreshed: boolean;
  expiresAt?: Date;
  pageTokensRenewed?: number;
  reason?: string;
}

/**
 * Renueva el token de la agencia si está por vencer.
 *
 * Tras una renovación exitosa también vuelve a pedir y guardar los tokens de
 * página. Los tokens de página no vencen solos, pero se invalidan cuando el
 * token de usuario que los emitió deja de ser válido; si no se refrescan aquí,
 * se pudren en silencio y la sincronización empieza a fallar sin motivo obvio.
 */
export async function refreshAgencyMetaToken(
  options: { force?: boolean; thresholdDays?: number } = {}
): Promise<RefreshResult> {
  const account = await getAgencyToken();
  if (!account) {
    return { refreshed: false, reason: "No hay una cuenta de Meta conectada." };
  }

  if (
    !options.force &&
    !needsRefresh(account.tokenExpiresAt, options.thresholdDays)
  ) {
    return {
      refreshed: false,
      expiresAt: account.tokenExpiresAt,
      reason: "El token todavía no necesita renovarse.",
    };
  }

  let renewed;
  try {
    renewed = await exchangeForLongLivedToken(account.accessToken);
  } catch (error) {
    // Un 190 aquí significa que el usuario cambió su contraseña o revocó la
    // app: no hay renovación posible, hace falta reconectar a mano.
    await markAgencyRefreshFailed(account.id);
    return {
      refreshed: false,
      reason:
        error instanceof Error
          ? `No se pudo renovar el token: ${error.message}`
          : "No se pudo renovar el token.",
    };
  }

  const expiresAt = resolveExpiryDate(renewed.expires_in);

  await saveAgencyToken({
    facebookUserId: account.facebookUserId,
    name: account.name,
    accessToken: renewed.access_token,
    tokenExpiresAt: expiresAt,
    markRefreshed: true,
  });

  const pageTokensRenewed = await refreshClientPageTokens(renewed.access_token);

  return { refreshed: true, expiresAt, pageTokensRenewed };
}

/**
 * Vuelve a pedir los tokens de página y los guarda para cada cliente vinculado.
 * Un cliente cuya página ya no esté entre las gestionadas se deja intacto:
 * puede haber perdido el acceso temporalmente y borrar el token empeoraría
 * la recuperación.
 */
export async function refreshClientPageTokens(
  userAccessToken: string
): Promise<number> {
  const pages = await getManagedPages(userAccessToken);
  if (pages.length === 0) return 0;

  const tokenByPageId = new Map(pages.map((p) => [p.id, p.access_token]));

  const clients = await db.client.findMany({
    where: { facebookPageId: { not: null } },
    select: { id: true, facebookPageId: true },
  });

  let updated = 0;
  for (const client of clients) {
    const pageToken = tokenByPageId.get(client.facebookPageId!);
    if (!pageToken) continue;

    await db.client.update({
      where: { id: client.id },
      data: { pageAccessToken: writePageToken(pageToken) },
    });
    updated++;
  }

  return updated;
}
