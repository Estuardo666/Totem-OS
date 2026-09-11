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
import { decideAgencyRefresh, resolveExpiryDate } from "./token-refresh-policy.ts";

export { needsRefresh, REFRESH_THRESHOLD_DAYS, decideAgencyRefresh } from "./token-refresh-policy.ts";


export interface RefreshResult {
  refreshed: boolean;
  /** Cómo se obtuvo el token en uso. Ausente si no hay ninguno conectado. */
  mode?: "oauth" | "system_user";
  expiresAt?: Date | null;
  pageTokensRenewed?: number;
  /**
   * Clientes con página vinculada que no aparecieron entre las gestionadas.
   * Con un usuario del sistema casi siempre significa "falta asignar ese
   * activo en Business Manager", que es un error accionable y no un parpadeo.
   */
  unmatchedClients?: string[];
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

  const decision = decideAgencyRefresh({
    mode: account.mode,
    expiresAt: account.tokenExpiresAt,
    force: options.force,
    thresholdDays: options.thresholdDays,
  });

  if (decision.action === "skip") {
    return {
      refreshed: false,
      mode: account.mode,
      expiresAt: account.tokenExpiresAt,
      reason: decision.reason,
    };
  }

  if (decision.action === "pages_only") {
    // Sin intercambio de token, pero sí refresco de páginas. `refreshed: false`
    // es la respuesta honesta: no se renovó nada, no había nada que renovar.
    const pages = await refreshClientPageTokens(account.accessToken);
    return {
      refreshed: false,
      mode: account.mode,
      expiresAt: null,
      pageTokensRenewed: pages.updated,
      unmatchedClients: pages.unmatched.map((c) => c.id),
      reason: decision.reason,
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
      mode: account.mode,
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

  const pages = await refreshClientPageTokens(renewed.access_token);

  return {
    refreshed: true,
    mode: account.mode,
    expiresAt,
    pageTokensRenewed: pages.updated,
    unmatchedClients: pages.unmatched.map((c) => c.id),
  };
}

/**
 * Vuelve a pedir los tokens de página y los guarda para cada cliente vinculado.
 * Un cliente cuya página ya no esté entre las gestionadas se deja intacto:
 * puede haber perdido el acceso temporalmente y borrar el token empeoraría
 * la recuperación.
 */
export interface PageTokenRefreshResult {
  updated: number;
  unmatched: Array<{ id: string; name: string; facebookPageId: string }>;
}

export async function refreshClientPageTokens(
  userAccessToken: string
): Promise<PageTokenRefreshResult> {
  const pages = await getManagedPages(userAccessToken);

  const tokenByPageId = new Map(pages.map((p) => [p.id, p.access_token]));

  const clients = await db.client.findMany({
    where: { facebookPageId: { not: null } },
    select: { id: true, name: true, facebookPageId: true },
  });

  let updated = 0;
  const unmatched: PageTokenRefreshResult["unmatched"] = [];

  for (const client of clients) {
    const facebookPageId = client.facebookPageId as string;
    const pageToken = tokenByPageId.get(facebookPageId);

    if (!pageToken) {
      unmatched.push({ id: client.id, name: client.name, facebookPageId });
      continue;
    }

    await db.client.update({
      where: { id: client.id },
      data: { pageAccessToken: writePageToken(pageToken) },
    });
    updated++;
  }

  return { updated, unmatched };
}
