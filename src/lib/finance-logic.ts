"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { startOfMonth, endOfMonth } from "date-fns";
import { sendNotification } from "@/actions/notification-actions";
import { getClientMonthlyClosureRows } from "@/lib/finance-monthly-close-service";

type MonthlyBillingExceptionRow = {
  clientId: string;
  type: string;
  overrideAmount: number | null;
};

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function getCurrentMonthBillingExceptions(clientIds: string[], year: number, month: number): Promise<MonthlyBillingExceptionRow[]> {
  if (clientIds.length === 0) {
    return [];
  }

  try {
    const rows = await db.$queryRaw<Array<MonthlyBillingExceptionRow>>`
      SELECT
        "clientId",
        "type",
        "overrideAmount"
      FROM "ClientBillingException"
      WHERE "clientId" IN (${Prisma.join(clientIds)})
        AND "year" = ${year}
        AND "month" = ${month}
    `;

    return rows;
  } catch {
    return [];
  }
}

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

async function hasPlanCompletionNotificationInMonth(input: {
  userId: string;
  clientName: string;
  type: string;
  monthStart: Date;
  monthEndWithTime: Date;
}): Promise<boolean> {
  const notification = await db.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      clientName: input.clientName,
      message: {
        contains: "completó su plan mensual",
      },
      createdAt: {
        gte: input.monthStart,
        lte: input.monthEndWithTime,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(notification);
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
      billingStartDate: true,
      createdAt: true,
    },
  });

  const clientIds = clients.map((client) => client.id);
  const billingExceptions = await getCurrentMonthBillingExceptions(
    clientIds,
    now.getFullYear(),
    now.getMonth() + 1
  );
  const closureRows = await getClientMonthlyClosureRows(clientIds, {
    maxYear: now.getFullYear(),
    maxMonth: now.getMonth() + 1,
  });

  const exceptionByClient = new Map(
    billingExceptions.map((exception: MonthlyBillingExceptionRow) => [exception.clientId, exception])
  );
  const closureByClient = new Map(
    closureRows
      .filter((row) => row.year === now.getFullYear() && row.month === now.getMonth() + 1)
      .map((row) => [row.clientId, row])
  );

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

      const billingException = exceptionByClient.get(client.id);
      const closure = closureByClient.get(client.id);

      if (!closure && (billingException?.type === "SKIP" || billingException?.type === "MARK_AS_PAID")) {
        skipped++;
        continue;
      }

      const billingReferenceDate = new Date(client.billingStartDate ?? client.createdAt);
      const billingStartMonth = getMonthStart(billingReferenceDate);

      if (billingStartMonth.getTime() > monthStart.getTime()) {
        skipped++;
        continue;
      }

      if (client.status === "PAUSED") {
        skipped++;
        continue;
      }

      const amountToCharge = closure
        ? closure.accrualStatus === "NONE"
          ? 0
          : closure.accruedAmount
        : billingException?.type === "OVERRIDE_AMOUNT"
          ? billingException.overrideAmount ?? client.monthlyRate
          : client.monthlyRate;

      if (amountToCharge <= 0) {
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
          amount: amountToCharge,
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
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        monthlyReels: true,
        monthlyFlyers: true,
        monthlyRate: true,
        editorId: true,
        logo: true,
      },
    });

    if (!client) {
      return { created: false, error: "Cliente no encontrado" };
    }

    if (client.monthlyReels === 0 && client.monthlyFlyers === 0) {
      return { created: false };
    }

    if (client.monthlyRate === 0) {
      return { created: false };
    }

    const publishedReels = await countPublishedTasksByType(clientId, "REEL");
    const publishedFlyers = await countPublishedTasksByType(clientId, "FLYER");
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthEndWithTime = new Date(monthEnd);
    monthEndWithTime.setHours(23, 59, 59, 999);
    const reelsFulfilled = client.monthlyReels > 0 && publishedReels >= client.monthlyReels;
    const flyersFulfilled = client.monthlyFlyers > 0 && publishedFlyers >= client.monthlyFlyers;
    let shouldCreateTransaction = false;

    if (client.monthlyReels > 0 && client.monthlyFlyers > 0) {
      shouldCreateTransaction = reelsFulfilled && flyersFulfilled;
    } else if (client.monthlyReels > 0) {
      shouldCreateTransaction = reelsFulfilled;
    } else if (client.monthlyFlyers > 0) {
      shouldCreateTransaction = flyersFulfilled;
    }

    if (!shouldCreateTransaction) {
      return { created: false };
    }

    try {
      const admins = await db.user.findMany({
        where: { roleCode: "ADMIN" },
        select: { id: true },
      });

      for (const admin of admins) {
        const alreadyNotified = await hasPlanCompletionNotificationInMonth({
          userId: admin.id,
          clientName: client.name,
          type: "ADMIN_ALERT",
          monthStart,
          monthEndWithTime,
        });

        if (alreadyNotified) {
          continue;
        }

        await sendNotification({
          userId: admin.id,
          message: `El cliente ${client.name} completó su plan mensual (${publishedReels}/${client.monthlyReels} Reels, ${publishedFlyers}/${client.monthlyFlyers} Flyers). Revisa la cobranza manual del fee por $${client.monthlyRate}.`,
          type: "ADMIN_ALERT",
          createdBy: undefined,
          clientLogo: client.logo ?? undefined,
          clientName: client.name,
        });
      }
    } catch (error) {
      console.error("❌ Error al enviar notificaciones de cobro automático:", error);
    }

    try {
      if (client.editorId) {
        const alreadyNotified = await hasPlanCompletionNotificationInMonth({
          userId: client.editorId,
          clientName: client.name,
          type: "INFO",
          monthStart,
          monthEndWithTime,
        });

        if (!alreadyNotified) {
          await sendNotification({
            userId: client.editorId,
            message: `¡Meta cumplida! El cliente ${client.name} completó su plan mensual (${publishedReels}/${client.monthlyReels} Reels, ${publishedFlyers}/${client.monthlyFlyers} Flyers). Se enviará solo un aviso para revisión de cobranza manual.`,
            type: "INFO",
            createdBy: undefined,
            clientLogo: client.logo ?? undefined,
            clientName: client.name,
          });
        }
      }
    } catch (error) {
      console.error("❌ Error al enviar notificación al Account Manager:", error);
    }

    return { created: false };
  } catch (error) {
    console.error("❌ Error al verificar cumplimiento de contrato:", error);
    return {
      created: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

