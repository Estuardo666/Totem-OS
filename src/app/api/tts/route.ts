import { NextRequest, NextResponse } from "next/server";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

let ttsClient: TextToSpeechClient | null = null;

/**
 * Initialize TTS client with credentials
 */
function getTTSClient(): TextToSpeechClient {
  if (ttsClient) return ttsClient;

  try {
    // Option 1: Service Account JSON file path
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      ttsClient = new TextToSpeechClient();
      return ttsClient;
    }

    // Option 2: Base64 encoded credentials (for cPanel deployment)
    if (process.env.GOOGLE_CLOUD_TTS_KEY_BASE64) {
      const credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CLOUD_TTS_KEY_BASE64, "base64").toString()
      );
      ttsClient = new TextToSpeechClient({ credentials });
      return ttsClient;
    }

    // Option 3: API Key (less secure, but simpler)
    if (process.env.GOOGLE_TTS_API_KEY) {
      ttsClient = new TextToSpeechClient({
        apiKey: process.env.GOOGLE_TTS_API_KEY,
      });
      return ttsClient;
    }

    throw new Error(
      "Google Cloud TTS credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_TTS_KEY_BASE64, or GOOGLE_TTS_API_KEY"
    );
  } catch (error) {
    console.error("TTS Client initialization error:", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 10 requests per minute per IP
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP, "tts", 10, 60 * 1000);

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

    const body = await req.json();
    const { text, voice = "es-US-Neural2-B", speed = 1.0 } = body;

    // Validation
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: "Text too long (max 5000 chars)" },
        { status: 400 }
      );
    }

    const client = getTTSClient();

    // Extract language code from voice name (e.g., "es-US-Neural2-B" -> "es-US")
    const languageCode = voice.split("-").slice(0, 2).join("-");

    // Prepare text for SSML: escape special characters and improve pronunciation
    const prepareForSSML = (input: string): string => {
      return input
        // Escape XML special characters
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Remove quotes and exclamation marks that cause pronunciation issues
        .replace(/["'«»""''¡!]/g, '')
        // Add natural pauses after sentences
        .replace(/\.\s/g, '. <break time="200ms"/> ')
        .replace(/\?\s/g, '? <break time="250ms"/> ');
    };

    // Use SSML for better pronunciation
    const ssmlText = `<speak>${prepareForSSML(text)}</speak>`;

    // Call Google TTS with SSML for better intonation
    const [response] = await client.synthesizeSpeech({
      input: { ssml: ssmlText },
      voice: {
        languageCode,
        name: voice,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Math.max(0.5, Math.min(2.0, speed)),
        pitch: -1.5, // Slightly lower pitch for more natural Spanish intonation
        volumeGainDb: 1.0,
        // Optimize audio for small speakers/headphones
        effectsProfileId: ["small-bluetooth-speaker-class-device"],
      },
    });

    if (!response.audioContent) {
      throw new Error("No audio generated from Google TTS");
    }

    // Convert audio content to Buffer for Response
    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

    // Return audio as MP3
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
        "X-Voice-Used": voice,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "TTS generation failed";
    console.warn("[TTS API] Error:", errorMsg);

    // Return user-friendly error for client to trigger fallback
    return NextResponse.json(
      {
        error: errorMsg,
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}
