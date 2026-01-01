"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import type { VoiceNote } from "@prisma/client";

/**
 * Crea una nota de voz para el usuario actual
 */
export async function createVoiceNote(
  audioUrl: string,
  title?: string
): Promise<ApiResponse<VoiceNote>> {
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
 * Obtiene las notas de voz del usuario actual
 * Ordenadas por fecha descendente (más recientes primero)
 */
export async function getUserVoiceNotes(): Promise<ApiResponse<VoiceNote[]>> {
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
): Promise<ApiResponse<void>> {
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

