"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { hashDraftToken, verifyDraftToken } from "@/lib/assistant/drafts";
import { createExpense, createTransaction } from "@/actions/finance-actions";
import { createTask } from "@/actions/content-actions";

/**
 * Ejecuta un borrador del asistente que el usuario confirmó.
 *
 * Idempotente: el hash del borrador es único en AiActionLog, así que un doble
 * clic o un reintento no crea dos registros. La escritura pasa por las mismas
 * server actions que usa la app, con sus validaciones y permisos.
 */
export async function confirmAssistantDraft(
  token: string
): Promise<ApiResponse<{ resultId: string | null; alreadyDone?: boolean }>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "No autorizado" };

  const verified = verifyDraftToken(token, userId);
  if (!verified.ok) return { success: false, error: verified.error };
  const { action, input } = verified.payload;

  const draftHash = hashDraftToken(token);
  let logId: string;
  try {
    const log = await db.aiActionLog.create({
      data: { draftHash, action, payload: JSON.stringify(input), userId },
    });
    logId = log.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.aiActionLog.findUnique({ where: { draftHash } });
      if (existing?.status === "DONE") {
        return { success: true, data: { resultId: existing.resultId, alreadyDone: true } };
      }
      return { success: false, error: "Esta acción ya se está procesando" };
    }
    throw error;
  }

  const result =
    action === "crearGasto"
      ? await createExpense(input)
      : action === "crearTarea"
        ? await createTask(input)
        : await createTransaction(input);

  const resultId =
    result.success && result.data && typeof result.data === "object" && "id" in result.data
      ? String((result.data as { id: unknown }).id)
      : null;

  await db.aiActionLog.update({
    where: { id: logId },
    data: result.success
      ? { status: "DONE", resultId }
      : { status: "FAILED", error: result.error ?? "Error desconocido" },
  });

  if (!result.success) {
    // Libera el hash para que el usuario pueda reintentar el mismo borrador.
    await db.aiActionLog.update({ where: { id: logId }, data: { draftHash: `${draftHash}:failed:${logId}` } });
    return { success: false, error: result.error ?? "No se pudo ejecutar la acción" };
  }

  return { success: true, data: { resultId } };
}
