/** Catálogo de proveedores y modelos del asistente (seguro para el cliente). */

export const ASSISTANT_PROVIDERS = ["anthropic", "openai", "groq", "google"] as const;
export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];

export const PROVIDER_CATALOG: Record<
  AssistantProvider,
  { label: string; envKey: string; models: { id: string; label: string }[] }
> = {
  anthropic: {
    label: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    ],
  },
  openai: {
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 nano" },
      { id: "gpt-5-mini", label: "GPT-5 mini" },
    ],
  },
  groq: {
    label: "Groq",
    envKey: "GROQ_API_KEY",
    models: [
      { id: "openai/gpt-oss-20b", label: "GPT OSS 20B" },
      { id: "openai/gpt-oss-120b", label: "GPT OSS 120B" },
    ],
  },
  google: {
    label: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    models: [
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
};

export const DEFAULT_PROVIDER: AssistantProvider = "anthropic";
export const DEFAULT_MODEL = "claude-haiku-5-5";

export function isAssistantProvider(value: unknown): value is AssistantProvider {
  return typeof value === "string" && (ASSISTANT_PROVIDERS as readonly string[]).includes(value);
}

/** Voces femeninas de Gemini Live, de la más cálida a la más brillante. */
export const LIVE_VOICES = [
  { id: "Sulafat", label: "Sulafat · cálida" },
  { id: "Achernar", label: "Achernar · suave" },
  { id: "Vindemiatrix", label: "Vindemiatrix · tranquila" },
  { id: "Despina", label: "Despina · fluida" },
  { id: "Aoede", label: "Aoede · ligera" },
  { id: "Kore", label: "Kore · firme" },
  { id: "Leda", label: "Leda · juvenil" },
  { id: "Zephyr", label: "Zephyr · brillante" },
] as const;
export const DEFAULT_LIVE_VOICE = "Sulafat";

export const VOICE_PROVIDERS = [
  { id: "gemini", label: "Gemini Live" },
  { id: "openai", label: "GPT Realtime (OpenAI)" },
] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number]["id"];
export const DEFAULT_VOICE_PROVIDER: VoiceProvider = "gemini";

/** Voces de OpenAI Realtime; marin y cedar son las más naturales. */
export const OPENAI_VOICES = [
  { id: "marin", label: "Marin · natural (femenina)" },
  { id: "coral", label: "Coral · cálida (femenina)" },
  { id: "shimmer", label: "Shimmer · suave (femenina)" },
  { id: "sage", label: "Sage · tranquila (femenina)" },
  { id: "cedar", label: "Cedar · natural (masculina)" },
] as const;
export const DEFAULT_OPENAI_VOICE = "marin";

export const OPENAI_REALTIME_MODELS = [
  { id: "gpt-realtime-mini", label: "Realtime Mini · económico" },
  { id: "gpt-realtime-2.1", label: "Realtime 2.1 · completo" },
] as const;
export const DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-mini";
