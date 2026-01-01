"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getManagedPages, getInstagramBusinessAccount, getMetaAuthorizationUrl, getAdAccounts, checkPermissions } from "@/lib/meta/auth-service";
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

    const url = getMetaAuthorizationUrl();
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

    const account = await db.agencyMetaAccount.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

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

    const account = await db.agencyMetaAccount.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

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
    const account = await db.agencyMetaAccount.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

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
        pageAccessToken: pageAccessToken,
        instagramBusinessId: instagramBusinessId || null,
        adAccountId: adAccountId || null,
      },
    });

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

