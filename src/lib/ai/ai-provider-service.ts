"use server";

import { db } from "@/lib/db";

export type AIProvider = "openai" | "grok" | "deepseek" | "google";

interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // Opcional: solo para OpenAI
  model?: string;   // Opcional: solo para OpenAI
}

/**
 * Obtiene la configuración de un proveedor específico
 */
async function getProviderConfig(
  provider: AIProvider
): Promise<AIProviderConfig | null> {
  try {
    const apiKeyConfig = await db.globalConfig.findUnique({
      where: { key: `${provider}ApiKey` },
    });

    if (!apiKeyConfig) {
      return null;
    }

    return {
      provider,
      apiKey: apiKeyConfig.value,
    };
  } catch (error) {
    console.error(`Error al obtener configuración de ${provider}:`, error);
    return null;
  }
}

/**
 * Obtiene el proveedor activo y su API Key desde la base de datos
 */
export async function getActiveProvider(): Promise<AIProviderConfig | null> {
  try {
    // Buscar configuración de proveedor activo
    const activeProviderConfig = await db.globalConfig.findUnique({
      where: { key: "activeAiProvider" },
    });

    if (!activeProviderConfig) {
      return null;
    }

    const provider = JSON.parse(activeProviderConfig.value) as AIProvider;

    // Buscar la API Key correspondiente
    const apiKeyConfig = await db.globalConfig.findUnique({
      where: { key: `${provider}ApiKey` },
    });

    if (!apiKeyConfig) {
      return null;
    }

    // Si es OpenAI, buscar también el Base URL y el Modelo personalizados
    let baseUrl: string | undefined;
    let model: string | undefined;
    
    if (provider === "openai") {
      const [baseUrlConfig, modelConfig] = await Promise.all([
        db.globalConfig.findUnique({ where: { key: "openaiBaseUrl" } }),
        db.globalConfig.findUnique({ where: { key: "openaiModel" } }),
      ]);
      
      if (baseUrlConfig?.value) {
        baseUrl = baseUrlConfig.value;
      }
      if (modelConfig?.value) {
        model = modelConfig.value;
      }
    }

    return {
      provider,
      apiKey: apiKeyConfig.value,
      baseUrl,
      model,
    };
  } catch (error) {
    console.error("Error al obtener proveedor de IA:", error);
    return null;
  }
}

/**
 * Factory pattern: Devuelve la instancia correcta del modelo según el proveedor
 */
export async function getAiModel(provider?: AIProvider): Promise<AIProviderConfig> {
  const config = provider
    ? await getProviderConfig(provider)
    : await getActiveProvider();

  if (!config) {
    throw new Error("No hay proveedor de IA configurado");
  }

  // Retornar configuración para que el orquestador la use
  return config;
}
