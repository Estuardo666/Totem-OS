/**
 * Configuración de la sesión de voz (Gemini Live u OpenAI Realtime).
 *
 * La voz no consulta la base: tiene tres herramientas que ejecuta el
 * navegador. `asistente` delega en el modelo pensador (/api/assistant/agent);
 * `confirmar` y `cancelar` resuelven el borrador pendiente.
 *
 * El backend fija esta configuración dentro del token efímero, así que el
 * navegador no puede cambiar modelo, instrucciones ni herramientas. Ambos
 * proveedores usan las mismas instrucciones y herramientas.
 */

import { Modality, type LiveConnectConfig } from "@google/genai";
import { DEFAULT_LIVE_VOICE, DEFAULT_OPENAI_REALTIME_MODEL, DEFAULT_OPENAI_VOICE } from "./catalog";
import { buildVoiceInstructions, VOICE_TOOLS } from "./voice-guidance";

export { DEFAULT_LIVE_VOICE };
export { buildVoiceInstructions, VOICE_TOOLS } from "./voice-guidance";

export const DEFAULT_LIVE_MODEL = "gemini-3.8-live";
export { DEFAULT_OPENAI_REALTIME_MODEL };

export function buildLiveConfig(userName: string, voice = DEFAULT_LIVE_VOICE): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      languageCode: "es-US",
      voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    systemInstruction: buildVoiceInstructions(userName),
    tools: [
      {
        functionDeclarations: VOICE_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          parametersJsonSchema: t.parameters,
        })),
      },
    ],
  };
}

/** Sesión de OpenAI Realtime (GA) para /v1/realtime/client_secrets. */
export function buildOpenAIRealtimeSession(userName: string, voice = DEFAULT_OPENAI_VOICE, model = DEFAULT_OPENAI_REALTIME_MODEL) {
  return {
    type: "realtime",
    model,
    instructions: buildVoiceInstructions(userName),
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe", language: "es" },
        turn_detection: { type: "semantic_vad", eagerness: "low" },
        noise_reduction: { type: "far_field" },
      },
      output: { voice },
    },
    tools: VOICE_TOOLS.map((t) => ({ type: "function", ...t })),
  };
}
