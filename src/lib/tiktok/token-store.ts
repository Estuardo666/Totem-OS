/**
 * Acceso a los tokens de TikTok.
 *
 * Igual que en Meta, el cifrado ocurre aquí dentro para que ningún call site
 * pueda olvidarlo. La diferencia es que TikTok necesita renovación *en línea*:
 * el access token dura 24 horas, así que un cron diario no alcanza.
 */

import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto/token-cipher.ts";
import {
  TikTokAuthError,
  refreshTikTokToken,
  type TikTokTokenResponse,
} from "./auth-service.ts";

/** Margen antes del vencimiento para renovar. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface TikTokAccount {
  id: string;
  openId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  refreshExpiresAt: Date;
  refreshFailedAt: Date | null;
}

/** Cuenta de TikTok de la agencia, con los tokens ya descifrados. */
export async function getTikTokAccount(): Promise<TikTokAccount | null> {
  const account = await db.agencyTikTokAccount.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!account) return null;

  return {
    id: account.id,
    openId: account.openId,
    displayName: account.displayName,
    accessToken: decryptToken(account.accessToken),
    refreshToken: decryptToken(account.refreshToken),
    tokenExpiresAt: account.tokenExpiresAt,
    refreshExpiresAt: account.refreshExpiresAt,
    refreshFailedAt: account.refreshFailedAt,
  };
}

/** Guarda un par de tokens recién emitido, cifrado. */
export async function saveTikTokToken(
  token: TikTokTokenResponse,
  displayName: string,
  options: { markRefreshed?: boolean } = {}
): Promise<void> {
  const now = Date.now();
  const tokenExpiresAt = new Date(now + (Number(token.expires_in) || 86400) * 1000);
  const refreshExpiresAt = new Date(
    now + (Number(token.refresh_expires_in) || 31536000) * 1000
  );

  await db.agencyTikTokAccount.upsert({
    where: { openId: token.open_id },
    update: {
      displayName,
      accessToken: encryptToken(token.access_token),
      refreshToken: encryptToken(token.refresh_token),
      tokenExpiresAt,
      refreshExpiresAt,
      scopes: token.scope ?? "",
      ...(options.markRefreshed ? { lastRefreshedAt: new Date() } : {}),
      refreshFailedAt: null,
    },
    create: {
      openId: token.open_id,
      displayName,
      accessToken: encryptToken(token.access_token),
      refreshToken: encryptToken(token.refresh_token),
      tokenExpiresAt,
      refreshExpiresAt,
      scopes: token.scope ?? "",
    },
  });
}

/**
 * Devuelve un access token válido, renovándolo si está por vencer.
 *
 * Se llama antes de cada consulta a la API, no una vez al día: con 24 horas de
 * vida, cualquier token guardado ayer ya no sirve.
 *
 * TikTok rota el refresh_token en cada renovación, así que se guardan los dos
 * valores nuevos; conservar el anterior dejaría la cuenta sin poder renovar.
 */
export async function getValidTikTokToken(): Promise<string> {
  const account = await getTikTokAccount();
  if (!account) {
    throw new TikTokAuthError("No hay una cuenta de TikTok conectada.");
  }

  const now = Date.now();

  if (account.refreshExpiresAt.getTime() <= now) {
    // El refresh de 365 días venció: no hay forma de recuperarse sin que una
    // persona vuelva a autorizar.
    await markTikTokRefreshFailed(account.id);
    throw new TikTokAuthError(
      "La autorización de TikTok caducó por completo. Vuelve a conectar la cuenta."
    );
  }

  if (account.tokenExpiresAt.getTime() - now > REFRESH_MARGIN_MS) {
    return account.accessToken;
  }

  try {
    const renewed = await refreshTikTokToken(account.refreshToken);
    await saveTikTokToken(renewed, account.displayName, { markRefreshed: true });
    return renewed.access_token;
  } catch (error) {
    await markTikTokRefreshFailed(account.id);
    throw error instanceof TikTokAuthError
      ? error
      : new TikTokAuthError(
          `No se pudo renovar el token de TikTok: ${
            error instanceof Error ? error.message : "error desconocido"
          }`
        );
  }
}

/** Marca que la renovación falló, para mostrar el aviso de reconexión. */
export async function markTikTokRefreshFailed(id: string): Promise<void> {
  await db.agencyTikTokAccount.update({
    where: { id },
    data: { refreshFailedAt: new Date() },
  });
}

/** Elimina la conexión de TikTok y desvincula a los clientes que la usaban. */
export async function disconnectTikTok(): Promise<void> {
  await db.$transaction([
    db.client.updateMany({
      where: { tiktokOpenId: { not: null } },
      data: { tiktokOpenId: null, tiktokUsername: null },
    }),
    db.agencyTikTokAccount.deleteMany({}),
  ]);
}
