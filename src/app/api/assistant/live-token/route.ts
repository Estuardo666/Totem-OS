import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getLiveVoice, getProviderApiKey } from "@/lib/assistant/config";
import { DEFAULT_LIVE_MODEL, buildLiveConfig } from "@/lib/assistant/live-config";

export const runtime = "nodejs";

/**
 * Emite un token efímero de Gemini Live (un uso, 1 min para conectar, 30 min
 * de sesión). La API key nunca sale del servidor y la configuración queda
 * fijada dentro del token.
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

  const key = await getProviderApiKey("google");
  if (!key) {
    return Response.json({ error: "Falta la API key de Gemini (GEMINI_API_KEY)." }, { status: 400 });
  }

  try {
    const now = Date.now();
    const ai = new GoogleGenAI({ apiKey: key.key, httpOptions: { apiVersion: "v1alpha" } });
    const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: {
          model,
          config: buildLiveConfig(session.user.name ?? "usuario", await getLiveVoice()),
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    return Response.json({ token: token.name, model });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la sesión de voz" },
      { status: 500 }
    );
  }
}
