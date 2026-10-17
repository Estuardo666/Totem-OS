/**
 * Configuración del asistente de IA ("modelo pensador").
 *
 * Independiente de la configuración de IA del generador de contenido
 * (`activeAiProvider` en GlobalConfig): aquí las claves se guardan cifradas
 * y nunca salen del servidor.
 *
 * Claves en GlobalConfig:
 *   assistant.provider       → "anthropic" | "openai" | "groq" | "google"
 *   assistant.model          → id del modelo
 *   assistant.key.<provider> → API key cifrada (AES-256-GCM, token-cipher)
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto/token-cipher";

import {
  ASSISTANT_PROVIDERS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  DEFAULT_LIVE_VOICE,
  DEFAULT_OPENAI_VOICE,
  DEFAULT_OPENAI_REALTIME_MODEL,
  DEFAULT_VOICE_PROVIDER,
  DEFAULT_XAI_VOICE,
  VOICE_PROVIDERS,
  type VoiceProvider,
  PROVIDER_CATALOG,
  type AssistantProvider,
  isAssistantProvider,
} from "./catalog";

export { ASSISTANT_PROVIDERS, PROVIDER_CATALOG, isAssistantProvider, type AssistantProvider };

const KEY_PROVIDER = "assistant.provider";
const KEY_MODEL = "assistant.model";
const apiKeyName = (provider: AssistantProvider) => `assistant.key.${provider}`;

/** Últimos 4 caracteres, para mostrar en la UI sin exponer la clave. */
export function maskKey(key: string): string {
  return key.length <= 4 ? "••••" : `••••${key.slice(-4)}`;
}

/** Clave guardada (descifrada) o, si no hay, la del entorno. */
export async function getProviderApiKey(
  provider: AssistantProvider
): Promise<{ key: string; source: "db" | "env" } | null> {
  const row = await db.globalConfig.findUnique({ where: { key: apiKeyName(provider) } });
  if (row?.value) {
    return { key: decryptToken(row.value), source: "db" };
  }
  const envKey = process.env[PROVIDER_CATALOG[provider].envKey];
  return envKey ? { key: envKey, source: "env" } : null;
}

export async function getAssistantSelection(): Promise<{
  provider: AssistantProvider;
  model: string;
}> {
  const rows = await db.globalConfig.findMany({
    where: { key: { in: [KEY_PROVIDER, KEY_MODEL] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const provider = byKey.get(KEY_PROVIDER);
  return {
    provider: isAssistantProvider(provider) ? provider : DEFAULT_PROVIDER,
    model: byKey.get(KEY_MODEL) || DEFAULT_MODEL,
  };
}

export async function saveAssistantSelection(input: {
  provider: AssistantProvider;
  model: string;
  apiKey?: string;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.globalConfig.upsert({
      where: { key: KEY_PROVIDER },
      update: { value: input.provider },
      create: { key: KEY_PROVIDER, value: input.provider },
    });
    await tx.globalConfig.upsert({
      where: { key: KEY_MODEL },
      update: { value: input.model },
      create: { key: KEY_MODEL, value: input.model },
    });
    if (input.apiKey) {
      const encrypted = encryptToken(input.apiKey);
      await tx.globalConfig.upsert({
        where: { key: apiKeyName(input.provider) },
        update: { value: encrypted },
        create: { key: apiKeyName(input.provider), value: encrypted },
      });
    }
  });
}

export async function deleteProviderApiKey(provider: AssistantProvider): Promise<void> {
  await db.globalConfig.deleteMany({ where: { key: apiKeyName(provider) } });
}

/** Construye el modelo del AI SDK para un proveedor, modelo y clave dados. */
export function buildModel(
  provider: AssistantProvider,
  model: string,
  apiKey: string
): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "groq":
      return createGroq({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
  }
}

/** Modelo activo del asistente, listo para streamText/generateText. */
export async function getAssistantModel(modelOverride?: string): Promise<
  { model: LanguageModel; provider: AssistantProvider; modelId: string } | { error: string }
> {
  if (modelOverride !== undefined && (typeof modelOverride !== "string" || !modelOverride.trim() || modelOverride.trim().length > 200)) {
    return { error: "El modelo configurado para WhatsApp no es válido." };
  }
  const selection = await getAssistantSelection();
  const model = modelOverride?.trim() ?? selection.model.trim();
  if (!model || model.length > 200) return { error: "El modelo del asistente no es válido." };
  const { provider } = selection;
  const key = await getProviderApiKey(provider);
  if (!key) {
    return {
      error: `Falta la API key de ${PROVIDER_CATALOG[provider].label}. Configúrala en Configuración → Asistente IA.`,
    };
  }
  return { model: buildModel(provider, model, key.key), provider, modelId: model };
}

const KEY_VOICE = "assistant.voice";
const KEY_VOICE_PROVIDER = "assistant.voiceProvider";
const KEY_OPENAI_VOICE = "assistant.openaiVoice";
const KEY_OPENAI_MODEL = "assistant.openaiRealtimeModel";
const KEY_XAI_VOICE = "assistant.xaiVoice";

export interface VoiceSettings {
  voiceProvider: VoiceProvider;
  /** Voz de Gemini Live. */
  voice: string;
  /** Voz de OpenAI Realtime. */
  openaiVoice: string;
  /** Modelo de OpenAI Realtime (mini o completo). */
  openaiModel: string;
  /** Voz de Grok Voice (xAI). */
  xaiVoice: string;
}

export async function getVoiceSettings(): Promise<VoiceSettings> {
  const rows = await db.globalConfig.findMany({
    where: { key: { in: [KEY_VOICE, KEY_VOICE_PROVIDER, KEY_OPENAI_VOICE, KEY_OPENAI_MODEL, KEY_XAI_VOICE] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const provider = byKey.get(KEY_VOICE_PROVIDER);
  return {
    voiceProvider: VOICE_PROVIDERS.find((p) => p.id === provider)?.id ?? DEFAULT_VOICE_PROVIDER,
    voice: byKey.get(KEY_VOICE) || DEFAULT_LIVE_VOICE,
    openaiVoice: byKey.get(KEY_OPENAI_VOICE) || DEFAULT_OPENAI_VOICE,
    openaiModel: byKey.get(KEY_OPENAI_MODEL) || DEFAULT_OPENAI_REALTIME_MODEL,
    xaiVoice: byKey.get(KEY_XAI_VOICE) || DEFAULT_XAI_VOICE,
  };
}

export async function saveVoiceSettings(input: Partial<VoiceSettings>): Promise<void> {
  const entries: [string, string | undefined][] = [
    [KEY_VOICE_PROVIDER, input.voiceProvider],
    [KEY_VOICE, input.voice],
    [KEY_OPENAI_VOICE, input.openaiVoice],
    [KEY_OPENAI_MODEL, input.openaiModel],
    [KEY_XAI_VOICE, input.xaiVoice],
  ];
  await db.$transaction(
    entries
      .filter((e): e is [string, string] => Boolean(e[1]))
      .map(([key, value]) =>
        db.globalConfig.upsert({ where: { key }, update: { value }, create: { key, value } })
      )
  );
}
