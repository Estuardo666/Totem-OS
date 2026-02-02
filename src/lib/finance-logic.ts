"use server";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import { sendNotification } from "@/actions/notification-actions";

/**
 * Cuenta las tareas completadas (PUBLISHED) de un tipo específico para un cliente en el mes actual
 * Filtra estrictamente por mes y año actual usando publishedAt
 */
export async function countPublishedTasksByType(
  clientId: string,
  type: "REEL" | "FLYER"
): Promise<number> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Asegurar que monthEnd incluya todo el día (23:59:59.999)
  const monthEndWithTime = new Date(monthEnd);
  monthEndWithTime.setHours(23, 59, 59, 999);

  const count = await db.contentTask.count({
    where: {
      clientId,
      type,
      status: "PUBLISHED",
      publishedAt: {
        gte: monthStart,
        lte: monthEndWithTime,
      },
    },
  });

  return count;
}

export async function createMonthlyPaymentTransactions(): Promise<{
  created: number;
  skipped: number;
  errors: Array<{ clientId: string; error: string }>;
}> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthEndWithTime = new Date(monthEnd);
  monthEndWithTime.setHours(23, 59, 59, 999);
  const lastDayOfMonth = monthEnd.getDate();

  const clients = await db.client.findMany({
    where: {
      paymentDay: { not: null },
    },
    select: {
      id: true,
      name: true,
      status: true,
      monthlyRate: true,
      paymentDay: true,
    },
  });

  let created = 0;
  let skipped = 0;
  const errors: Array<{ clientId: string; error: string }> = [];

  for (const client of clients) {
    try {
      const paymentDay = client.paymentDay ?? null;
      if (!paymentDay || client.monthlyRate <= 0) {
        skipped++;
        continue;
      }

      if (client.status === "PAUSED") {
        skipped++;
        continue;
      }

      const scheduledDay = Math.min(paymentDay, lastDayOfMonth);
      const scheduledDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        scheduledDay
      );

      const existingTransaction = await db.transaction.findFirst({
        where: {
          relatedClientId: client.id,
          type: "INCOME",
          description: {
            contains: "Cobro mensual programado",
          },
          createdAt: {
            gte: monthStart,
            lte: monthEndWithTime,
          },
        },
      });

      if (existingTransaction) {
        skipped++;
        continue;
      }

      await db.transaction.create({
        data: {
          amount: client.monthlyRate,
          type: "INCOME",
          status: "PENDING",
          description: `Cobro mensual programado - ${client.name} (día ${scheduledDay})`,
          relatedClientId: client.id,
          clientId: client.id,
          createdAt: scheduledDate,
        },
      });

      created++;
    } catch (error) {
      errors.push({
        clientId: client.id,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return { created, skipped, errors };
}

/**
 * Verifica si el cliente ha cumplido con su plan mensual y crea una transacción automática si es necesario
 * Retorna true si se creó una transacción, false en caso contrario
 */
export async function checkAndCreateAutomaticTransaction(
  clientId: string
): Promise<{ created: boolean; transactionId?: string; error?: string }> {
  try {
    // Obtener el cliente con sus datos de contrato
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        monthlyReels: true,
        monthlyFlyers: true,
        monthlyRate: true,
      },
    });

    if (!client) {
      return { created: false, error: "Cliente no encontrado" };
    }

    // Si no hay plan contratado, no crear transacción
    if (client.monthlyReels === 0 && client.monthlyFlyers === 0) {
      return { created: false };
    }

    // Si no hay tarifa mensual definida, no crear transacción
    if (client.monthlyRate === 0) {
      return { created: false };
    }

    // Contar tareas completadas en el mes actual
    const publishedReels = await countPublishedTasksByType(clientId, "REEL");
    const publishedFlyers = await countPublishedTasksByType(clientId, "FLYER");

    // Verificar si ya existe una transacción automática para este mes y año
    // Seguridad anti-duplicados: verifica por clientId, tipo INCOME y mes/año actual
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthEndWithTime = new Date(monthEnd);
    monthEndWithTime.setHours(23, 59, 59, 999);

    // Verificación anti-duplicados: buscar transacciones automáticas del mes actual
    // Busca por: clientId, tipo INCOME, descripción que contenga el texto clave, y mes/año actual
    const existingTransaction = await db.transaction.findFirst({
      where: {
        relatedClientId: clientId,
        type: "INCOME",
        description: {
          contains: "Cobro automático - Cumplimiento de plan mensual",
        },
        createdAt: {
          gte: monthStart,
          lte: monthEndWithTime,
        },
      },
    });

    // Si ya existe una transacción para este mes, no crear otra
    if (existingTransaction) {
      console.log(
        `⚠️ Ya existe una transacción automática para ${client.name} en el mes actual`
      );
      return { created: false };
    }

    // Verificar cumplimiento del plan
    const reelsFulfilled = client.monthlyReels > 0 && publishedReels >= client.monthlyReels;
    const flyersFulfilled = client.monthlyFlyers > 0 && publishedFlyers >= client.monthlyFlyers;

    // Si ambos tipos están contratados, ambos deben cumplirse
    // Si solo uno está contratado, solo ese debe cumplirse
    let shouldCreateTransaction = false;

    if (client.monthlyReels > 0 && client.monthlyFlyers > 0) {
      // Plan completo: ambos deben cumplirse
      shouldCreateTransaction = reelsFulfilled && flyersFulfilled;
    } else if (client.monthlyReels > 0) {
      // Solo Reels contratados
      shouldCreateTransaction = reelsFulfilled;
    } else if (client.monthlyFlyers > 0) {
      // Solo Flyers contratados
      shouldCreateTransaction = flyersFulfilled;
    }

    if (!shouldCreateTransaction) {
      return { created: false };
    }

    // Crear la transacción automática
    const transaction = await db.transaction.create({
      data: {
        amount: client.monthlyRate,
        type: "INCOME",
        status: "PENDING",
        description: `Cobro automático - Cumplimiento de plan mensual (${publishedReels}/${client.monthlyReels} Reels, ${publishedFlyers}/${client.monthlyFlyers} Flyers)`,
        relatedClientId: clientId,
      },
    });

    console.log(
      `✅ Transacción automática creada para cliente ${client.name}: $${client.monthlyRate}`
    );

    // Notificar a los admins sobre el cobro automático
    try {
      const admins = await db.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });

      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          message: `Se generó el cobro automático para ${client.name} por $${client.monthlyRate} (Meta cumplida: ${publishedReels}/${client.monthlyReels} Reels, ${publishedFlyers}/${client.monthlyFlyers} Flyers)`,
          type: "ADMIN_ALERT",
          createdBy: undefined, // Sistema
        });
      }
    } catch (error) {
      console.error("❌ Error al enviar notificaciones de cobro automático:", error);
      // No fallar la operación si las notificaciones fallan
    }

    // Notificar al Account Manager (editorId) si existe
    try {
      const clientWithEditor = await db.client.findUnique({
        where: { id: clientId },
        select: { editorId: true },
      });

      if (clientWithEditor?.editorId) {
        await sendNotification({
          userId: clientWithEditor.editorId,
          message: `¡Meta cumplida! El cliente ${client.name} completó su plan mensual (${publishedReels}/${client.monthlyReels} Reels, ${publishedFlyers}/${client.monthlyFlyers} Flyers). Se generó el cobro automático.`,
          type: "INFO",
          createdBy: undefined, // Sistema
        });
      }
    } catch (error) {
      console.error("❌ Error al enviar notificación al Account Manager:", error);
      // No fallar la operación si la notificación falla
    }

    return { created: true, transactionId: transaction.id };
  } catch (error) {
    console.error("❌ Error al verificar cumplimiento de contrato:", error);
    return {
      created: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

