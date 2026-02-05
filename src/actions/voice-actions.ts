"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ActionResponse } from "@/types";
import type { VoiceNote } from "@prisma/client";
import { voiceCommandInputSchema, voiceCommandResponseSchema } from "@/schemas/voice";
import { getActiveProvider } from "@/lib/ai/ai-provider-service";
import { callAIProvider } from "@/lib/ai/engine";

interface VoiceCommandResponse {
  type: "task" | "shoot";
  title: string;
  details: string;
  pieceType?: "REEL" | "FLYER" | "STORY";
}

/**
 * Crea una nota de voz para el usuario actual
 */
export async function createVoiceNote(
  audioUrl: string,
  title?: string
): Promise<ActionResponse<VoiceNote>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const voiceNote = await db.voiceNote.create({
      data: {
        userId: sessionUserId,
        audioUrl,
        title: title || "Nota de voz",
      },
    });

    // Revalidar el dashboard
    revalidatePath("/");

    return { success: true, data: voiceNote };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear nota de voz",
    };
  }
}

/**
 * Interpreta un comando de voz y devuelve una acción
 */
export async function interpretVoiceCommandAction(
  input: unknown
): Promise<ActionResponse<VoiceCommandResponse>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "No autenticado" };
    }

    if (session.user.roleLegacy !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const validatedInput = voiceCommandInputSchema.parse(input);
    const config = await getActiveProvider();

    if (!config) {
      return {
        success: false,
        error: "No hay proveedor de IA configurado. Configúralo en /admin/settings",
      };
    }

    const trimmedTranscript = validatedInput.transcript.slice(0, 500);
    const systemPrompt = "Eres asistente de Totem OS. Devuelve SOLO JSON válido para crear tarea o rodaje.";
    const userPrompt = [
      `Transcripción: "${trimmedTranscript}"`,
      "Detecta tipo: 'task' (Content Factory) o 'shoot'.",
      "Si dice 'rodaje <nombre>', usa ese texto como título del rodaje.",
      "Fechas: normaliza a dd/mm/aaaa (usa año actual si no se menciona).",
      "Horas: devuelve suggestedStartTime HH:mm 24h; si solo hay una hora, suggestedEndTime = start + 1h.",
      "Tarea: pieceType REEL|FLYER|STORY opcional, detalles breves.",
      "Cliente opcional: suggestedClient (texto).",
      "JSON: {type, title, details, pieceType?, suggestedDate?, suggestedClient?, suggestedStartTime?, suggestedEndTime?} sin texto adicional.",
    ].join("\n");

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const chatModel = config.model?.toLowerCase().includes("whisper")
      ? "llama-3.1-8b-instant"
      : config.model || "llama-3.1-8b-instant";

    const rawText = await callAIProvider(
      config.provider,
      config.apiKey,
      messages,
      {
        model: chatModel,
        baseUrl: config.baseUrl,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }
    );

    let parsed: VoiceCommandResponse;

    try {
      parsed = voiceCommandResponseSchema.parse(JSON.parse(rawText));
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? `Respuesta inválida del proveedor: ${error.message}`
            : "Respuesta inválida del proveedor",
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al interpretar el comando de voz",
    };
  }
}

/**
 * Obtiene las notas de voz del usuario actual
 * Ordenadas por fecha descendente (más recientes primero)
 */
export async function getUserVoiceNotes(): Promise<ActionResponse<VoiceNote[]>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const voiceNotes = await db.voiceNote.findMany({
      where: {
        userId: sessionUserId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // Limitar a las últimas 10 notas
    });

    return { success: true, data: voiceNotes };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener notas de voz",
    };
  }
}

/**
 * Elimina una nota de voz
 */
export async function deleteVoiceNote(
  noteId: string
): Promise<ActionResponse<void>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // Verificar que la nota pertenece al usuario
    const voiceNote = await db.voiceNote.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });

    if (!voiceNote) {
      return { success: false, error: "Nota de voz no encontrada" };
    }

    if (voiceNote.userId !== sessionUserId) {
      return {
        success: false,
        error: "No tienes permisos para eliminar esta nota",
      };
    }

    await db.voiceNote.delete({
      where: { id: noteId },
    });

    // Revalidar el dashboard
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al eliminar nota de voz",
    };
  }
}

