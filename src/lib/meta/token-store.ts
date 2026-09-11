/**
 * Acceso a los tokens de Meta.
 *
 * Todo lectura/escritura de un token pasa por aquí y el cifrado ocurre dentro,
 * de modo que ningún call site pueda olvidarlo. Los servicios de Graph reciben
 * siempre texto plano; la base de datos guarda siempre texto cifrado.
 */

import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto/token-cipher.ts";
import { buildSystemUserAccount } from "./system-user.ts";
import type { AgencyToken } from "./system-user.ts";

export type { AgencyToken, AgencyTokenMode } from "./system-user.ts";

/**
 * Devuelve la cuenta de Meta de la agencia con su token ya descifrado.
 *
 * La app es de un solo inquilino: existe como mucho una cuenta conectada, así
 * que se toma la más reciente.
 */
export async function getAgencyToken(): Promise<AgencyToken | null> {
  // El entorno gana: si hay un usuario del sistema configurado, la base de
  // datos ni se consulta. La fila de OAuth se deja intacta a propósito, porque
  // es el material para revertir borrando la variable.
  const systemUser = buildSystemUserAccount();
  if (systemUser) return systemUser;

  const account = await db.agencyMetaAccount.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!account) return null;

  return {
    mode: "oauth",
    id: account.id,
    facebookUserId: account.facebookUserId,
    name: account.name,
    accessToken: decryptToken(account.accessToken),
    tokenExpiresAt: account.tokenExpiresAt,
    scopes: account.scopes,
    lastRefreshedAt: account.lastRefreshedAt,
    refreshFailedAt: account.refreshFailedAt,
  };
}

/**
 * Crea o actualiza la cuenta de Meta de la agencia.
 * Al guardar se limpia `refreshFailedAt`: un token nuevo cancela el aviso de
 * reconexión pendiente.
 */
export async function saveAgencyToken(input: {
  facebookUserId: string;
  name: string;
  accessToken: string;
  tokenExpiresAt: Date;
  scopes?: string | null;
  markRefreshed?: boolean;
}): Promise<void> {
  const encrypted = encryptToken(input.accessToken);
  const now = new Date();

  await db.agencyMetaAccount.upsert({
    where: { facebookUserId: input.facebookUserId },
    update: {
      name: input.name,
      accessToken: encrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
      ...(input.markRefreshed ? { lastRefreshedAt: now } : {}),
      refreshFailedAt: null,
    },
    create: {
      facebookUserId: input.facebookUserId,
      name: input.name,
      accessToken: encrypted,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: input.scopes ?? null,
    },
  });
}

/**
 * Marca que la renovación falló, para que la UI ofrezca reconectar.
 * No borra el token: puede seguir siendo válido hasta su fecha de expiración.
 */
export async function markAgencyRefreshFailed(id: string): Promise<void> {
  await db.agencyMetaAccount.update({
    where: { id },
    data: { refreshFailedAt: new Date() },
  });
}

/**
 * Token de página de un cliente, ya descifrado.
 * Devuelve null si el cliente no tiene página vinculada.
 */
export async function getClientPageToken(
  clientId: string
): Promise<{ facebookPageId: string; pageAccessToken: string } | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { facebookPageId: true, pageAccessToken: true },
  });

  if (!client?.facebookPageId || !client.pageAccessToken) return null;

  return {
    facebookPageId: client.facebookPageId,
    pageAccessToken: decryptToken(client.pageAccessToken),
  };
}

/** Guarda el token de página de un cliente, cifrado. */
export async function saveClientPageToken(
  clientId: string,
  pageAccessToken: string
): Promise<void> {
  await db.client.update({
    where: { id: clientId },
    data: { pageAccessToken: encryptToken(pageAccessToken) },
  });
}

/**
 * Descifra un token de página ya cargado en memoria.
 *
 * Para los casos donde el cliente se leyó junto con otros campos y volver a
 * consultarlo solo por el token sería una consulta de más.
 */
export function readPageToken(stored: string): string {
  return decryptToken(stored);
}

/** Cifra un token de página para escribirlo dentro de un update mayor. */
export function writePageToken(plaintext: string): string {
  return encryptToken(plaintext);
}
