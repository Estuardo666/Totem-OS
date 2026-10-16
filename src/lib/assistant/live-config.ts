/**
 * Configuración de la sesión de voz (Gemini Live).
 *
 * La voz no consulta la base: tiene tres herramientas que ejecuta el
 * navegador. `asistente` delega en el modelo pensador (/api/assistant/agent);
 * `confirmar` y `cancelar` resuelven el borrador pendiente.
 *
 * El backend fija esta configuración dentro del token efímero, así que el
 * navegador no puede cambiar modelo, instrucciones ni herramientas.
 */

import { Modality, type LiveConnectConfig } from "@google/genai";
import { DEFAULT_LIVE_VOICE } from "./catalog";

export { DEFAULT_LIVE_VOICE };

export const DEFAULT_LIVE_MODEL = "gemini-3.8-live";

export function buildLiveConfig(userName: string, voice = DEFAULT_LIVE_VOICE): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      languageCode: "es-US",
      voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    systemInstruction: `Eres la voz del asistente de Totem OS, una agencia de marketing en Ecuador. Hablas español latino natural, cálido y con buena onda, como un colega (tuteo). Respuestas cortas, de 1 a 3 frases, nunca leas listas largas ni suenes a robot. Usuario: ${userName}.

No tienes acceso directo a datos. Para CUALQUIER pregunta sobre clientes, tareas, gastos, honorarios, métricas, o para crear algo, llama a la herramienta "asistente" con el pedido completo en palabras del usuario, y luego cuéntale la respuesta con tus propias palabras, de forma natural (no la leas literal si suena rígida).
REGLA CRÍTICA: llama a "asistente" EN ESE MISMO TURNO, de inmediato. No anuncies que vas a revisar ("dame un segundo", "déjame ver") sin hacer la llamada: si lo dices, la llamada debe ir en el mismo turno. No pidas confirmar datos obvios (por ejemplo "hoy" o una fecha ya dicha): pásalos tal cual al asistente.

Cuando el asistente prepare un borrador, pregunta si lo confirmas. Solo si el usuario dice claramente que sí, llama a "confirmar". Si dice que no o quiere cambiar algo, llama a "cancelar" (y si quiere cambios, vuelve a llamar a "asistente" con la corrección). Nunca digas que algo quedó guardado hasta que "confirmar" responda con éxito.

Saludos y charla trivial puedes responderlos sin herramientas.`,
    tools: [
      {
        functionDeclarations: [
          {
            name: "asistente",
            description:
              "Consulta datos de Totem OS o prepara acciones (gastos, tareas, honorarios). Devuelve el texto a leer.",
            parametersJsonSchema: {
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
            parametersJsonSchema: { type: "object", properties: {} },
          },
          {
            name: "cancelar",
            description: "Descarta el borrador pendiente.",
            parametersJsonSchema: { type: "object", properties: {} },
          },
        ],
      },
    ],
  };
}
