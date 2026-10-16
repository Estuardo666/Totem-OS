import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getProviderApiKey, getVoiceSettings } from "@/lib/assistant/config";
import {
  DEFAULT_LIVE_MODEL,
  DEFAULT_OPENAI_REALTIME_MODEL,
  buildLiveConfig,
  buildOpenAIRealtimeSession,
} from "@/lib/assistant/live-config";

export const runtime = "nodejs";

/**
 * Emite un token efímero para la voz en vivo del proveedor configurado
 * (Gemini Live u OpenAI Realtime). La API key nunca sale del servidor y el
 * modelo, las instrucciones y las herramientas quedan fijados en el token.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !resolveRoleCode(session.user)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const limit = checkRateLimit(session.user.id, "assistant-live-token", 10, 60_000);
  if (!limit.allowed) {
    return Response.json({ error: "Demasiados intentos; espera un momento." }, { status: 429 });
  }

  const userName = session.user.name ?? "usuario";
  const voice = await getVoiceSettings();

  try {
    if (voice.voiceProvider === "openai") {
      const key = await getProviderApiKey("openai");
      if (!key) {
        return Response.json({ error: "Falta la API key de OpenAI (OPENAI_API_KEY)." }, { status: 400 });
      }
      const model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_OPENAI_REALTIME_MODEL;
      const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: { Authorization: `Bearer ${key.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 60 },
          session: buildOpenAIRealtimeSession(userName, voice.openaiVoice, model),
        }),
      });
      const data = (await res.json()) as { value?: string; error?: { message?: string } };
      if (!res.ok || !data.value) {
        return Response.json(
          { error: data.error?.message ?? "No se pudo crear la sesión de voz de OpenAI" },
          { status: 502 }
        );
      }
      return Response.json({ provider: "openai", token: data.value, model });
    }

    const key = await getProviderApiKey("google");
    if (!key) {
      return Response.json({ error: "Falta la API key de Gemini (GEMINI_API_KEY)." }, { status: 400 });
    }
    const now = Date.now();
    const ai = new GoogleGenAI({ apiKey: key.key, httpOptions: { apiVersion: "v1alpha" } });
    const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: { model, config: buildLiveConfig(userName, voice.voice) },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    return Response.json({ provider: "gemini", token: token.name, model });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la sesión de voz" },
      { status: 500 }
    );
  }
}
