"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getManagedPages, getInstagramBusinessAccount, getMetaAuthorizationUrl, getAdAccounts, checkPermissions } from "@/lib/meta/auth-service";
import { META_STATE_COOKIE, createState, setOAuthCookie } from "@/lib/oauth-state";
import { getAgencyToken, writePageToken } from "@/lib/meta/token-store";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";

/**
 * Obtiene la URL de autorización de Meta
 */
export async function getMetaAuthUrl(): Promise<ApiResponse<{ url: string }>> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    const state = createState();
    await setOAuthCookie(META_STATE_COOKIE, state);

    const url = getMetaAuthorizationUrl(state);
    return {
      success: true,
      data: { url },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al generar URL de autorización",
    };
  }
}

/**
 * Obtiene la cuenta de Meta conectada con información de permisos
 */
export async function getConnectedMetaAccount(): Promise<
  ApiResponse<{
    id: string;
    facebookUserId: string;
    name: string;
    tokenExpiresAt: Date;
    permissions?: {
      permissions: Record<string, boolean>;
      missing: string[];
    };
  } | null>
> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    const account = await getAgencyToken();

    if (!account) {
      return {
        success: true,
        data: null,
      };
    }

    // Verificar permisos
    let permissions;
    try {
      permissions = await checkPermissions(account.accessToken);
    } catch (error) {
      console.error("Error al verificar permisos:", error);
      // Si falla la verificación, continuamos sin permisos
    }

    return {
      success: true,
      data: {
        id: account.id,
        facebookUserId: account.facebookUserId,
        name: account.name,
        tokenExpiresAt: account.tokenExpiresAt,
        permissions,
      },
    };
  } catch (error) {
    console.error("Error al obtener cuenta de Meta:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener cuenta de Meta",
    };
  }
}

/**
 * Obtiene las cuentas publicitarias disponibles para el usuario conectado
 */
export async function getAvailableAdAccounts(): Promise<
  ApiResponse<
    Array<{
      id: string;
      name: string;
      account_id: string;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    const account = await getAgencyToken();

    if (!account) {
      return {
        success: false,
        error: "No hay cuenta de Meta conectada",
      };
    }

    const adAccounts = await getAdAccounts(account.accessToken);

    return {
      success: true,
      data: adAccounts,
    };
  } catch (error) {
    console.error("Error al obtener cuentas publicitarias:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener cuentas publicitarias",
    };
  }
}

/**
 * Obtiene las páginas gestionadas por la cuenta de Meta conectada
 */
export async function getManagedMetaPages(): Promise<
  ApiResponse<
    Array<{
      id: string;
      name: string;
      access_token: string;
      instagramAccount: {
        id: string;
        username: string;
      } | null;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    // Obtener la cuenta de Meta conectada
    const account = await getAgencyToken();

    if (!account) {
      return {
        success: false,
        error: "No hay cuenta de Meta conectada",
      };
    }

    // Obtener páginas gestionadas
    const pages = await getManagedPages(account.accessToken);

    // Para cada página, intentar obtener la cuenta de Instagram Business asociada
    const pagesWithInstagram = await Promise.all(
      pages.map(async (page) => {
        const instagramAccount = await getInstagramBusinessAccount(page.id, page.access_token);
        return {
          id: page.id,
          name: page.name,
          access_token: page.access_token,
          instagramAccount,
        };
      })
    );

    return {
      success: true,
      data: pagesWithInstagram,
    };
  } catch (error) {
    console.error("Error al obtener páginas gestionadas:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener páginas gestionadas",
    };
  }
}

/**
 * Vincula una página de Facebook a un cliente
 */
export async function linkPageToClient(
  clientId: string,
  pageId: string,
  pageAccessToken: string,
  instagramBusinessId?: string | null,
  adAccountId?: string | null
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    // Verificar que el cliente existe
    const client = await db.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    // Actualizar el cliente con los IDs de página, Instagram y Ad Account
    await db.client.update({
      where: { id: clientId },
      data: {
        facebookPageId: pageId,
        pageAccessToken: writePageToken(pageAccessToken),
        instagramBusinessId: instagramBusinessId || null,
        adAccountId: adAccountId || null,
      },
    });

    // Espejar la cuenta publicitaria en ClientAdAccount, que es la fuente que
    // lee la sincronización. Client.adAccountId queda solo por compatibilidad.
    if (adAccountId) {
      await db.clientAdAccount.upsert({
        where: {
          clientId_platform_adAccountId: {
            clientId,
            platform: "META_ADS",
            adAccountId,
          },
        },
        update: { isActive: true },
        create: {
          clientId,
          platform: "META_ADS",
          adAccountId,
          name: client.name,
        },
      });
    }

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/admin/settings/integrations");

    return {
      success: true,
      data: { success: true },
    };
  } catch (error) {
    console.error("Error al vincular página a cliente:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al vincular página a cliente",
    };
  }
}

/**
 * Desvincula una página de Facebook de un cliente
 */
export async function unlinkPageFromClient(clientId: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    await db.client.update({
      where: { id: clientId },
      data: {
        facebookPageId: null,
        pageAccessToken: null,
        instagramBusinessId: null,
        adAccountId: null,
      },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/admin/settings/integrations");

    return {
      success: true,
      data: { success: true },
    };
  } catch (error) {
    console.error("Error al desvincular página de cliente:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al desvincular página de cliente",
    };
  }
}

/**
 * Desconecta la cuenta de Meta (elimina el registro de AgencyMetaAccount)
 */
export async function disconnectMetaAccount(): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden desconectar cuentas.",
      };
    }

    // Eliminar todas las cuentas de Meta conectadas
    await db.agencyMetaAccount.deleteMany({});

    revalidatePath("/admin/settings/integrations");

    return {
      success: true,
      data: { success: true },
    };
  } catch (error) {
    console.error("Error al desconectar cuenta de Meta:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al desconectar cuenta de Meta",
    };
  }
}


/**
 * Lista las cuentas publicitarias vinculadas a un cliente.
 */
export async function getClientAdAccounts(
  clientId: string
): Promise<ApiResponse<Array<{ id: string; adAccountId: string; name: string; currency: string; isActive: boolean }>>> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return { success: false, error: "No autorizado" };
    }

    const accounts = await db.clientAdAccount.findMany({
      where: { clientId, platform: "META_ADS" },
      select: {
        id: true,
        adAccountId: true,
        name: true,
        currency: true,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, data: accounts };
  } catch (error) {
    console.error("Error al listar cuentas publicitarias:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al listar cuentas publicitarias",
    };
  }
}

/**
 * Vincula una cuenta publicitaria de Meta a un cliente.
 *
 * Un cliente puede tener varias: es común que arrastre una cuenta antigua y
 * otra nueva bajo un Business Manager distinto, y el informe debe sumar ambas.
 * Re-vincular una existente la reactiva en vez de duplicarla.
 */
export async function linkAdAccountToClient(
  clientId: string,
  adAccountId: string,
  name: string,
  currency: string = "USD"
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return { success: false, error: "No autorizado" };
    }

    const normalized = adAccountId.trim().startsWith("act_")
      ? adAccountId.trim()
      : `act_${adAccountId.trim()}`;

    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      return { success: false, error: "Cliente no encontrado" };
    }

    const account = await db.clientAdAccount.upsert({
      where: {
        clientId_platform_adAccountId: {
          clientId,
          platform: "META_ADS",
          adAccountId: normalized,
        },
      },
      update: { name, currency, isActive: true },
      create: {
        clientId,
        platform: "META_ADS",
        adAccountId: normalized,
        name,
        currency,
      },
      select: { id: true },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/admin/settings/integrations");

    return { success: true, data: account };
  } catch (error) {
    console.error("Error al vincular cuenta publicitaria:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al vincular cuenta publicitaria",
    };
  }
}

/**
 * Desvincula una cuenta publicitaria de un cliente.
 *
 * Se desactiva en lugar de borrarse, para que las métricas ya sincronizadas
 * sigan apareciendo en los informes de meses anteriores.
 */
export async function unlinkAdAccountFromClient(
  clientId: string,
  adAccountId: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return { success: false, error: "No autorizado" };
    }

    await db.clientAdAccount.updateMany({
      where: { clientId, platform: "META_ADS", adAccountId },
      data: { isActive: false },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/admin/settings/integrations");

    return { success: true, data: { success: true } };
  } catch (error) {
    console.error("Error al desvincular cuenta publicitaria:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al desvincular cuenta publicitaria",
    };
  }
}
