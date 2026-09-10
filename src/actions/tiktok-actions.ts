"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import {
  getTikTokAuthorizationUrl,
  isTikTokConfigured,
  TIKTOK_SCOPES,
} from "@/lib/tiktok/auth-service";
import { fetchTikTokProfileStats } from "@/lib/tiktok/metrics-service";
import {
  disconnectTikTok,
  getTikTokAccount,
  getValidTikTokToken,
} from "@/lib/tiktok/token-store";
import { TIKTOK_STATE_COOKIE, createState, setOAuthCookie } from "@/lib/oauth-state";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";

/**
 * Devuelve un mensaje de error si la sesión no puede gestionar integraciones.
 * `auth()` está sobrecargado, así que se tipa la sesión directamente en vez
 * de inferirla de su retorno.
 */
function guard(session: Session | null): string | null {
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
    return "No autorizado";
  }
  return null;
}

/** URL de autorización de TikTok, con su cookie de state. */
export async function getTikTokAuthUrl(): Promise<ApiResponse<{ url: string }>> {
  try {
    const error = guard(await auth());
    if (error) return { success: false, error };

    if (!isTikTokConfigured()) {
      return {
        success: false,
        error:
          "Falta configurar TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET. " +
          "Se obtienen registrando la app en developers.tiktok.com.",
      };
    }

    const state = createState();
    await setOAuthCookie(TIKTOK_STATE_COOKIE, state);

    return { success: true, data: { url: getTikTokAuthorizationUrl(state) } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al generar la URL de autorización",
    };
  }
}

/**
 * Estado de la conexión de TikTok para la página de integraciones.
 *
 * Distingue "sin configurar" de "sin conectar": lo primero lo arregla un
 * administrador con las claves, lo segundo un clic en conectar.
 */
export async function getTikTokConnection(): Promise<
  ApiResponse<{
    configured: boolean;
    connected: boolean;
    displayName: string | null;
    openId: string | null;
    tokenExpiresAt: Date | null;
    refreshExpiresAt: Date | null;
    needsReconnect: boolean;
    scopes: string[];
  }>
> {
  try {
    const error = guard(await auth());
    if (error) return { success: false, error };

    const configured = isTikTokConfigured();
    const account = configured ? await getTikTokAccount() : null;

    return {
      success: true,
      data: {
        configured,
        connected: Boolean(account),
        displayName: account?.displayName ?? null,
        openId: account?.openId ?? null,
        tokenExpiresAt: account?.tokenExpiresAt ?? null,
        refreshExpiresAt: account?.refreshExpiresAt ?? null,
        needsReconnect: Boolean(account?.refreshFailedAt),
        scopes: [...TIKTOK_SCOPES],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al leer la conexión de TikTok",
    };
  }
}

/**
 * Vincula el perfil de TikTok conectado a un cliente.
 *
 * Solo hay un perfil por conexión —la Display API no permite gestionar varios—
 * así que vincularlo a un cliente nuevo lo desvincula del anterior.
 */
export async function linkTikTokToClient(
  clientId: string
): Promise<ApiResponse<{ username: string }>> {
  try {
    const error = guard(await auth());
    if (error) return { success: false, error };

    const account = await getTikTokAccount();
    if (!account) {
      return { success: false, error: "No hay una cuenta de TikTok conectada" };
    }

    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) return { success: false, error: "Cliente no encontrado" };

    // Un perfil, un cliente: liberar cualquier vínculo previo.
    await db.client.updateMany({
      where: { tiktokOpenId: account.openId, id: { not: clientId } },
      data: { tiktokOpenId: null, tiktokUsername: null },
    });

    await db.client.update({
      where: { id: clientId },
      data: { tiktokOpenId: account.openId, tiktokUsername: account.displayName },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/admin/settings/integrations");

    return { success: true, data: { username: account.displayName } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al vincular TikTok",
    };
  }
}

/** Desvincula TikTok de un cliente, sin tocar la conexión de la agencia. */
export async function unlinkTikTokFromClient(
  clientId: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const error = guard(await auth());
    if (error) return { success: false, error };

    await db.client.update({
      where: { id: clientId },
      data: { tiktokOpenId: null, tiktokUsername: null },
    });

    revalidatePath(`/clients/${clientId}`);
    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al desvincular TikTok",
    };
  }
}

/** Elimina la conexión de TikTok de la agencia. */
export async function disconnectTikTokAccount(): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const error = guard(await auth());
    if (error) return { success: false, error };

    await disconnectTikTok();
    revalidatePath("/admin/settings/integrations");

    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al desconectar TikTok",
    };
  }
}

/**
 * Comprueba la conexión contra la API real.
 * Sirve para verificar la configuración sin esperar a la sincronización nocturna.
 */
export async function testTikTokConnection(): Promise<
  ApiResponse<{ displayName: string; followers: number; videos: number; likes: number }>
> {
  try {
    const error = guard(await auth());
    if (error) return { success: false, error };

    const token = await getValidTikTokToken();
    const stats = await fetchTikTokProfileStats(token);

    return {
      success: true,
      data: {
        displayName: stats.displayName,
        followers: stats.followerCount,
        videos: stats.videoCount,
        likes: stats.likesCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al probar la conexión de TikTok",
    };
  }
}
