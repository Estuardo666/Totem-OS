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

export { DEFAULT_LIVE_VOICE };

export const DEFAULT_LIVE_MODEL = "gemini-3.8-live";
export { DEFAULT_OPENAI_REALTIME_MODEL };

export function buildVoiceInstructions(userName: string): string {
  return `Eres la voz del asistente de Totem OS, una agencia de marketing en Ecuador. Hablas español latino natural, cálido y con buena onda, como un colega (tuteo). Respuestas cortas, de 1 a 3 frases, nunca leas listas largas ni suenes a robot. Usuario: ${userName}.

No tienes acceso directo a datos. Para CUALQUIER pregunta sobre clientes, tareas, gastos, honorarios, métricas, o para crear algo, llama a la herramienta "asistente" con el pedido completo en palabras del usuario, y luego cuéntale la respuesta con tus propias palabras, de forma natural (no la leas literal si suena rígida).
REGLA CRÍTICA: llama a "asistente" EN ESE MISMO TURNO, de inmediato. No anuncies que vas a revisar ("dame un segundo", "déjame ver") sin hacer la llamada: si lo dices, la llamada debe ir en el mismo turno. No pidas confirmar datos obvios (por ejemplo "hoy" o una fecha ya dicha): pásalos tal cual al asistente.

Solo pide confirmación cuando el asistente prepare un borrador (crear un gasto, tarea u honorario); en consultas simplemente responde y, si aporta, ofrece más detalle. Cuando haya un borrador, pregunta si lo confirmas. Solo si el usuario dice claramente que sí, llama a "confirmar". Si dice que no o quiere cambiar algo, llama a "cancelar" (y si quiere cambios, vuelve a llamar a "asistente" con la corrección). Nunca digas que algo quedó guardado hasta que "confirmar" responda con éxito.

Saludos y charla trivial puedes responderlos sin herramientas.`;
}

/** Herramientas de la voz en JSON Schema, comunes a ambos proveedores. */
export const VOICE_TOOLS = [
  {
    name: "asistente",
    description:
      "Consulta datos de Totem OS o prepara acciones (gastos, tareas, honorarios). Devuelve el texto a leer.",
    parameters: {
      type: "object",
      properties: {
        pedido: { type: "string", description: "Lo que pidió el usuario, completo y con todos los datos mencionados" },
      },
      required: ["pedido"],
    },
  },
  {
    name: "confirmar",
    description: "Guarda el borrador pendiente. Solo cuando el usuario dijo claramente que sí.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "cancelar",
    description: "Descarta el borrador pendiente.",
    parameters: { type: "object", properties: {} },
  },
] as const;

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
        turn_detection: { type: "semantic_vad" },
      },
      output: { voice },
    },
    tools: VOICE_TOOLS.map((t) => ({ type: "function", ...t })),
  };
}
