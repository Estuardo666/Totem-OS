"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { startOfMonth, endOfMonth } from "date-fns";

/**
 * Server Action para verificar el cumplimiento del contrato mensual de un cliente
 * Si se cumple la cantidad contratada, crea automáticamente una Transaction de tipo INCOME en estado PENDING
 */
export async function checkContractFulfillment(
  clientId: string
): Promise<ApiResponse<{ fulfilled: boolean; transactionCreated: boolean }>> {
  try {
    // Obtener el cliente con su contrato
    const client = await db.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    // Si no tiene contrato mensual, no hay nada que verificar
    if (client.monthlyReels === 0 && client.monthlyFlyers === 0) {
      return {
        success: true,
        data: { fulfilled: false, transactionCreated: false },
      };
    }

    // Obtener el rango del mes actual
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);

    // Contar tareas completadas del mes actual
    const completedTasks = await db.contentTask.findMany({
      where: {
        clientId: clientId,
        status: "PUBLISHED",
        publishedAt: {
          gte: startOfCurrentMonth,
          lte: endOfCurrentMonth,
        },
      },
    });

    // Contar Reels y Flyers completados
    const completedReels = completedTasks.filter(
      (task) => task.type === "REEL"
    ).length;
    const completedFlyers = completedTasks.filter(
      (task) => task.type === "FLYER"
    ).length;

    // Verificar si se cumplió el contrato
    const reelsFulfilled = completedReels >= client.monthlyReels;
    const flyersFulfilled = completedFlyers >= client.monthlyFlyers;
    const contractFulfilled = reelsFulfilled && flyersFulfilled;

    // Si el contrato se cumplió, verificar si ya existe una transacción para este mes
    if (contractFulfilled) {
      const existingTransaction = await db.transaction.findFirst({
        where: {
          relatedClientId: clientId,
          type: "INCOME",
          status: "PENDING",
          createdAt: {
            gte: startOfCurrentMonth,
            lte: endOfCurrentMonth,
          },
        },
      });

      // Si ya existe una transacción pendiente, no crear otra
      if (existingTransaction) {
        return {
          success: true,
          data: { fulfilled: true, transactionCreated: false },
        };
      }

      // Calcular el monto basado en el contrato (puedes ajustar esta lógica)
      // Por ahora, usaremos un monto fijo o basado en el planConfig
      const amount = 1000; // Monto base, puedes hacerlo dinámico

      // Crear la transacción automáticamente
      await db.transaction.create({
        data: {
          amount: amount,
          type: "INCOME",
          status: "PENDING",
          description: `Cumplimiento de contrato mensual - ${completedReels} Reels, ${completedFlyers} Flyers`,
          relatedClientId: clientId,
        },
      });

      // Revalidar Dashboard y página de finanzas
      revalidatePath("/");
      revalidatePath("/finance");

      return {
        success: true,
        data: { fulfilled: true, transactionCreated: true },
      };
    }

    return {
      success: true,
      data: { fulfilled: false, transactionCreated: false },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al verificar cumplimiento del contrato",
    };
  }
}
