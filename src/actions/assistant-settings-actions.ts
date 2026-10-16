"use server";

import { generateText } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import type { ApiResponse } from "@/types";
import { resolveRoleCode } from "@/lib/roles";
import { LIVE_VOICES } from "@/lib/assistant/catalog";
import {
  ASSISTANT_PROVIDERS,
  PROVIDER_CATALOG,
  type AssistantProvider,
  buildModel,
  deleteProviderApiKey,
  getAssistantSelection,
  getLiveVoice,
  getProviderApiKey,
  maskKey,
  saveLiveVoice,
  saveAssistantSelection,
} from "@/lib/assistant/config";

export interface AssistantSettingsView {
  provider: AssistantProvider;
  model: string;
  voice: string;
  keys: Record<AssistantProvider, { masked: string; source: "db" | "env" } | null>;
}

async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return resolveRoleCode(session?.user) === "ADMIN";
}

/** Configuración actual. Las claves salen enmascaradas, nunca completas. */
export async function getAssistantSettings(): Promise<ApiResponse<AssistantSettingsView>> {
  try {
    if (!(await requireAdmin())) return { success: false, error: "No autorizado" };

    const selection = await getAssistantSelection();
    const entries = await Promise.all(
      ASSISTANT_PROVIDERS.map(async (p) => {
        const key = await getProviderApiKey(p);
        return [p, key ? { masked: maskKey(key.key), source: key.source } : null] as const;
      })
    );

    return {
      success: true,
      data: { ...selection, voice: await getLiveVoice(), keys: Object.fromEntries(entries) as AssistantSettingsView["keys"] },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al leer la configuración",
    };
  }
}

const settingsSchema = z.object({
  provider: z.enum(ASSISTANT_PROVIDERS),
  model: z.string().trim().min(1, "Elige un modelo").max(100),
  apiKey: z.string().trim().max(500).optional(),
  voice: z.enum(LIVE_VOICES.map((v) => v.id) as [string, ...string[]]).optional(),
});

export async function saveAssistantSettings(input: unknown): Promise<ApiResponse<void>> {
  try {
    if (!(await requireAdmin())) return { success: false, error: "No autorizado" };

    const data = settingsSchema.parse(input);
    if (!data.apiKey && !(await getProviderApiKey(data.provider))) {
      return {
        success: false,
        error: `Pega la API key de ${PROVIDER_CATALOG[data.provider].label}`,
      };
    }

    await saveAssistantSelection({ ...data, apiKey: data.apiKey || undefined });
    if (data.voice) await saveLiveVoice(data.voice);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar la configuración",
    };
  }
}

export async function removeAssistantApiKey(provider: unknown): Promise<ApiResponse<void>> {
  try {
    if (!(await requireAdmin())) return { success: false, error: "No autorizado" };
    await deleteProviderApiKey(z.enum(ASSISTANT_PROVIDERS).parse(provider));
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al borrar la clave",
    };
  }
}

/**
 * Prueba la conexión con una llamada mínima. Usa la clave pegada si la hay;
 * si no, la guardada. No guarda nada.
 */
export async function testAssistantConnection(
  input: unknown
): Promise<ApiResponse<{ reply: string; ms: number }>> {
  try {
    if (!(await requireAdmin())) return { success: false, error: "No autorizado" };

    const data = settingsSchema.parse(input);
    const apiKey = data.apiKey || (await getProviderApiKey(data.provider))?.key;
    if (!apiKey) {
      return { success: false, error: "No hay API key para probar" };
    }

    const started = Date.now();
    const { text } = await generateText({
      model: buildModel(data.provider, data.model, apiKey),
      prompt: "Responde solo con la palabra: listo",
      maxOutputTokens: 10,
    });

    return { success: true, data: { reply: text.trim(), ms: Date.now() - started } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo conectar",
    };
  }
}
