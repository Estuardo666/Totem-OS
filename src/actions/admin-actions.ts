"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ApiResponse } from "@/types";
import { z } from "zod";

const aiProviderSchema = z.enum(["openai", "grok", "deepseek", "google"]);

const updateGlobalAiConfigSchema = z.object({
  activeProvider: aiProviderSchema,
  openaiApiKey: z.string().optional(),
  grokApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
});

/**
 * Actualiza la configuración global de IA
 * Solo accesible para ADMIN
 */
export async function updateGlobalAiConfig(
  input: unknown
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden configurar IA.",
      };
    }

    // 2. Validar con Zod
    const validatedData = updateGlobalAiConfigSchema.parse(input);

    // 3. Usar transacción para asegurar atomicidad y evitar conflictos
    await db.$transaction(async (prisma) => {
      // Actualizar o crear configuración de proveedor activo
      await prisma.globalConfig.upsert({
        where: { key: "activeAiProvider" },
        update: {
          value: JSON.stringify(validatedData.activeProvider),
        },
        create: {
          key: "activeAiProvider",
          value: JSON.stringify(validatedData.activeProvider),
        },
      });

      // Actualizar API Keys (solo si se proporcionaron)
      if (validatedData.openaiApiKey !== undefined) {
        await prisma.globalConfig.upsert({
          where: { key: "openaiApiKey" },
          update: {
            value: validatedData.openaiApiKey,
          },
          create: {
            key: "openaiApiKey",
            value: validatedData.openaiApiKey,
          },
        });
      }

      if (validatedData.grokApiKey !== undefined) {
        await prisma.globalConfig.upsert({
          where: { key: "grokApiKey" },
          update: {
            value: validatedData.grokApiKey,
          },
          create: {
            key: "grokApiKey",
            value: validatedData.grokApiKey,
          },
        });
      }

      if (validatedData.deepseekApiKey !== undefined) {
        await prisma.globalConfig.upsert({
          where: { key: "deepseekApiKey" },
          update: {
            value: validatedData.deepseekApiKey,
          },
          create: {
            key: "deepseekApiKey",
            value: validatedData.deepseekApiKey,
          },
        });
      }

      if (validatedData.googleApiKey !== undefined) {
        await prisma.globalConfig.upsert({
          where: { key: "googleApiKey" },
          update: {
            value: validatedData.googleApiKey,
          },
          create: {
            key: "googleApiKey",
            value: validatedData.googleApiKey,
          },
        });
      }
    });

    // 5. Revalidar rutas
    revalidatePath("/admin/settings");

    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar configuración de IA",
    };
  }
}

/**
 * Obtiene la configuración actual de IA
 * Solo accesible para ADMIN
 */
export async function getGlobalAiConfig(): Promise<
  ApiResponse<{
    activeProvider: string | null;
    openaiApiKey: string | null;
    grokApiKey: string | null;
    deepseekApiKey: string | null;
    googleApiKey: string | null;
  }>
> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    // 2. Obtener configuración
    const [activeProvider, openaiKey, grokKey, deepseekKey, googleKey] =
      await Promise.all([
        db.globalConfig.findUnique({ where: { key: "activeAiProvider" } }),
        db.globalConfig.findUnique({ where: { key: "openaiApiKey" } }),
        db.globalConfig.findUnique({ where: { key: "grokApiKey" } }),
        db.globalConfig.findUnique({ where: { key: "deepseekApiKey" } }),
        db.globalConfig.findUnique({ where: { key: "googleApiKey" } }),
      ]);

    return {
      success: true,
      data: {
        activeProvider: activeProvider
          ? JSON.parse(activeProvider.value)
          : null,
        openaiApiKey: openaiKey?.value || null,
        grokApiKey: grokKey?.value || null,
        deepseekApiKey: deepseekKey?.value || null,
        googleApiKey: googleKey?.value || null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener configuración de IA",
    };
  }
}

const updateClientStrategySchema = z.object({
  clientId: z.string().cuid(),
  businessDescription: z.string().optional(),
  toneOfVoice: z.string().optional(),
  audience: z.string().optional(),
  values: z.string().optional(),
  prohibitedTopics: z.string().optional(),
});

/**
 * Actualiza el ADN de marca (estrategia) de un cliente
 */
export async function updateClientStrategy(
  input: unknown
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    // 1. Validar sesión
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    // 2. Validar con Zod
    const validatedData = updateClientStrategySchema.parse(input);

    // 3. Obtener cliente actual para preservar otros datos
    const client = await db.client.findUnique({
      where: { id: validatedData.clientId },
    });

    if (!client) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    // 4. Parsear brandDNA existente o crear nuevo
    let brandDNA: {
      businessDescription?: string;
      toneOfVoice?: string;
      audience?: string;
      values?: string;
      prohibitedTopics?: string;
    } = {};

    if (client.brandDNA) {
      try {
        brandDNA = JSON.parse(client.brandDNA);
      } catch (error) {
        console.error("Error al parsear brandDNA existente:", error);
      }
    }

    // 5. Actualizar solo los campos proporcionados (convertir strings vacíos a undefined)
    if (validatedData.businessDescription !== undefined) {
      brandDNA.businessDescription = validatedData.businessDescription.trim() || undefined;
    }
    if (validatedData.toneOfVoice !== undefined) {
      brandDNA.toneOfVoice = validatedData.toneOfVoice.trim() || undefined;
    }
    if (validatedData.audience !== undefined) {
      brandDNA.audience = validatedData.audience.trim() || undefined;
    }
    if (validatedData.values !== undefined) {
      brandDNA.values = validatedData.values.trim() || undefined;
    }
    if (validatedData.prohibitedTopics !== undefined) {
      brandDNA.prohibitedTopics = validatedData.prohibitedTopics.trim() || undefined;
    }

    // Debug: Log antes de guardar
    console.log("[updateClientStrategy] BrandDNA a guardar:", JSON.stringify(brandDNA, null, 2));

    // 6. Guardar en base de datos
    const updatedClient = await db.client.update({
      where: { id: validatedData.clientId },
      data: {
        brandDNA: JSON.stringify(brandDNA),
      },
      select: {
        id: true,
        brandDNA: true,
      },
    });

    // Debug: Verificar que se guardó correctamente
    console.log("[updateClientStrategy] BrandDNA guardado:", updatedClient.brandDNA);

    // 7. Revalidar rutas
    revalidatePath(`/clients/${validatedData.clientId}`);
    revalidatePath("/clients");

    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar estrategia del cliente",
    };
  }
}

/**
 * Obtiene la configuración de marca (logos) - Versión pública
 * Accesible sin autenticación para mostrar logos en páginas públicas
 */
export async function getPublicBrandSettings(): Promise<
  ApiResponse<{
    logoLight: string | null;
    logoDark: string | null;
  }>
> {
  try {
    // Obtener configuración (sin validar autenticación)
    const brandSettings = await db.globalConfig.findUnique({
      where: { key: "brand_settings" },
    });

    if (!brandSettings) {
      return {
        success: true,
        data: {
          logoLight: null,
          logoDark: null,
        },
      };
    }

    // Parsear JSON
    try {
      const parsed = JSON.parse(brandSettings.value) as {
        logoLight?: string;
        logoDark?: string;
      };

      return {
        success: true,
        data: {
          logoLight: parsed.logoLight || null,
          logoDark: parsed.logoDark || null,
        },
      };
    } catch (parseError) {
      console.error("Error al parsear brand_settings:", parseError);
      return {
        success: true,
        data: {
          logoLight: null,
          logoDark: null,
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener configuración de marca",
    };
  }
}

/**
 * Obtiene la configuración de marca (logos)
 * Solo accesible para ADMIN
 */
export async function getBrandSettings(): Promise<
  ApiResponse<{
    logoLight: string | null;
    logoDark: string | null;
  }>
> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden ver la configuración de marca.",
      };
    }

    // 2. Obtener configuración
    const brandSettings = await db.globalConfig.findUnique({
      where: { key: "brand_settings" },
    });

    if (!brandSettings) {
      return {
        success: true,
        data: {
          logoLight: null,
          logoDark: null,
        },
      };
    }

    // 3. Parsear JSON
    try {
      const parsed = JSON.parse(brandSettings.value) as {
        logoLight?: string;
        logoDark?: string;
      };

      return {
        success: true,
        data: {
          logoLight: parsed.logoLight || null,
          logoDark: parsed.logoDark || null,
        },
      };
    } catch (parseError) {
      console.error("Error al parsear brand_settings:", parseError);
      return {
        success: true,
        data: {
          logoLight: null,
          logoDark: null,
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener configuración de marca",
    };
  }
}

const updateBrandSettingsSchema = z.object({
  logoLight: z.string().url().optional(),
  logoDark: z.string().url().optional(),
});

/**
 * Actualiza la configuración de marca (logos)
 * Solo accesible para ADMIN
 */
export async function updateBrandSettings(
  input: unknown
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden actualizar la configuración de marca.",
      };
    }

    // 2. Validar con Zod
    const validatedData = updateBrandSettingsSchema.parse(input);

    // 3. Obtener configuración existente para preservar valores no actualizados
    const existing = await db.globalConfig.findUnique({
      where: { key: "brand_settings" },
    });

    let currentSettings: { logoLight?: string; logoDark?: string } = {};
    if (existing) {
      try {
        currentSettings = JSON.parse(existing.value) as {
          logoLight?: string;
          logoDark?: string;
        };
      } catch (parseError) {
        console.error("Error al parsear brand_settings existente:", parseError);
      }
    }

    // 4. Actualizar solo los campos proporcionados
    const updatedSettings = {
      ...currentSettings,
      ...(validatedData.logoLight !== undefined && {
        logoLight: validatedData.logoLight,
      }),
      ...(validatedData.logoDark !== undefined && {
        logoDark: validatedData.logoDark,
      }),
    };

    // 5. Guardar en base de datos
    await db.globalConfig.upsert({
      where: { key: "brand_settings" },
      update: {
        value: JSON.stringify(updatedSettings),
      },
      create: {
        key: "brand_settings",
        value: JSON.stringify(updatedSettings),
      },
    });

    // 6. Revalidar rutas
    revalidatePath("/");
    revalidatePath("/admin/settings");

    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar configuración de marca",
    };
  }
}

/**
 * Obtiene el background del login - Versión pública
 * Accesible sin autenticación para mostrar en páginas de auth
 */
export async function getPublicLoginBackground(): Promise<
  ApiResponse<{
    backgroundUrl: string | null;
  }>
> {
  try {
    // Obtener configuración (sin validar autenticación)
    const loginBackground = await db.globalConfig.findUnique({
      where: { key: "login_background" },
    });

    if (!loginBackground) {
      return {
        success: true,
        data: {
          backgroundUrl: null,
        },
      };
    }

    // Parsear JSON
    try {
      const parsed = JSON.parse(loginBackground.value) as {
        backgroundUrl?: string;
      };

      return {
        success: true,
        data: {
          backgroundUrl: parsed.backgroundUrl || null,
        },
      };
    } catch (parseError) {
      console.error("Error al parsear login_background:", parseError);
      return {
        success: true,
        data: {
          backgroundUrl: null,
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener background del login",
    };
  }
}

/**
 * Obtiene el background del login
 * Solo accesible para ADMIN
 */
export async function getLoginBackground(): Promise<
  ApiResponse<{
    backgroundUrl: string | null;
  }>
> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden ver el background del login.",
      };
    }

    // 2. Obtener configuración
    const loginBackground = await db.globalConfig.findUnique({
      where: { key: "login_background" },
    });

    if (!loginBackground) {
      return {
        success: true,
        data: {
          backgroundUrl: null,
        },
      };
    }

    // 3. Parsear JSON
    try {
      const parsed = JSON.parse(loginBackground.value) as {
        backgroundUrl?: string;
      };

      return {
        success: true,
        data: {
          backgroundUrl: parsed.backgroundUrl || null,
        },
      };
    } catch (parseError) {
      console.error("Error al parsear login_background:", parseError);
      return {
        success: true,
        data: {
          backgroundUrl: null,
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener background del login",
    };
  }
}

const updateLoginBackgroundSchema = z.object({
  backgroundUrl: z.string().url().optional(),
});

/**
 * Actualiza el background del login
 * Solo accesible para ADMIN
 */
export async function updateLoginBackground(
  input: unknown
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden actualizar el background del login.",
      };
    }

    // 2. Validar con Zod
    const validatedData = updateLoginBackgroundSchema.parse(input);

    // 3. Guardar en base de datos
    await db.globalConfig.upsert({
      where: { key: "login_background" },
      update: {
        value: JSON.stringify({
          backgroundUrl: validatedData.backgroundUrl || null,
        }),
      },
      create: {
        key: "login_background",
        value: JSON.stringify({
          backgroundUrl: validatedData.backgroundUrl || null,
        }),
      },
    });

    // 4. Revalidar rutas
    revalidatePath("/sign-in");
    revalidatePath("/sign-up");
    revalidatePath("/admin/settings");

    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar background del login",
    };
  }
}

