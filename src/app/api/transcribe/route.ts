import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/ai/ai-provider-service";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  try {
    // Rate limiting: 10 requests per minute per IP
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, "transcribe", 10, 60 * 1000);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Demasiados intentos. Inténtalo más tarde.",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": (rateLimitResult.retryAfter ?? 60).toString(),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Se requiere un archivo de audio" }, { status: 400 });
    }

    const config = await getActiveProvider();
    if (!config) {
      return NextResponse.json({ error: "Configura un proveedor en /admin/settings" }, { status: 400 });
    }

    const baseUrl = (config.baseUrl?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
    const apiKey = config.apiKey;
    const model = config.model || "whisper-large-v3-turbo";

    const audioBuffer = Buffer.from(await file.arrayBuffer());
    const form = new FormData();
    form.append("file", new Blob([audioBuffer]), (file as File).name || "audio.webm");
    form.append("model", model);
    form.append("language", "es");
    form.append("response_format", "json");

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err || "Error al transcribir" }, { status: 500 });
    }

    const data = (await response.json()) as { text?: string };
    return NextResponse.json({ text: data.text ?? "" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al transcribir" }, { status: 500 });
  }
}
