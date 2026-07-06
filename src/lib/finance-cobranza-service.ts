/**
 * Servicio de Cobranza - Gestiona OVERDUE detection y alertas de cobro
 * Funciona con cron jobs para ejecutarse diariamente
 */

import { db } from "@/lib/db";
import { addDays } from "date-fns";

interface CobranzaResult {
  overdueCount: number;
  alertCount: number;
  alertsSent: number;
}

/**
 * Verifica y marca facturas vencidas automáticamente
 * Si dueDate < hoy y status no es PAID → OVERDUE
 * Notifica a admins cuando una factura se vuelve OVERDUE
 */
export async function checkAndMarkOverdueInvoices(): Promise<CobranzaResult> {
  const today = new Date();
  const result: CobranzaResult = {
    overdueCount: 0,
    alertCount: 0,
    alertsSent: 0,
  };

  try {
    // 1. Obtener facturas PENDING/SENT cuya dueDate ya pasó
    const overdueInvoices = await db.invoice.findMany({
      where: {
        status: { in: ["PENDING", "SENT"] },
        dueDate: {
          lt: today,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });

    result.overdueCount = overdueInvoices.length;

    // 2. Marcar como OVERDUE y notificar
    for (const invoice of overdueInvoices) {
      try {
        // Actualizar estado a OVERDUE
        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "OVERDUE",
            updatedAt: new Date(),
          },
        });

        // Enviar notificación a admins
        const daysOverdue = invoice.dueDate 
          ? Math.floor(
              (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;

        const { sendNotification } = await import("@/actions/notification-actions");
        const admins = await db.user.findMany({
          where: { roleLegacy: "ADMIN" },
          select: { id: true },
        });

        for (const admin of admins) {
          await sendNotification({
            userId: admin.id,
            message: `⚠️ FACTURA VENCIDA: ${invoice.client.name} - $${invoice.amount} (${daysOverdue} días atrasada)`,
            type: "COBRANZA_ALERT",
          });
        }

        // Notificación PUSH
        const { sendPushNotification } = await import("@/actions/push-actions");
        await sendPushNotification({
          title: "Factura Vencida",
          message: `${invoice.client.name} • $${invoice.amount} (${daysOverdue}d vencida)`,
          userIds: admins.map((a) => a.id),
          url: `/finance?invoiceId=${invoice.id}`,
          imageUrl: invoice.client.logo || undefined,
        });

        result.alertsSent++;
      } catch (error) {
        console.error(`Error procesando factura overdue ${invoice.id}:`, error);
      }
    }

    console.log(`✅ Cobranza: ${result.overdueCount} facturas marcadas OVERDUE, ${result.alertsSent} notificaciones enviadas`);
    return result;
  } catch (error) {
    console.error("❌ Error en checkAndMarkOverdueInvoices:", error);
    throw error;
  }
}

/**
 * Verifica pagos 72 horas después del vencimiento
 * Si una factura llevaba vencida más de 72 horas y sigue OVERDUE
 * → Alerta especial a admins para cobro inmediato
 */
export async function checkPaymentAlerts72Hours(): Promise<CobranzaResult> {
  const today = new Date();
  const threshold72h = addDays(today, -3); // -3 días = 72 horas

  const result: CobranzaResult = {
    overdueCount: 0,
    alertCount: 0,
    alertsSent: 0,
  };

  try {
    // 1. Obtener facturas OVERDUE que vencieron hace más de 72 horas
    const criticalInvoices = await db.invoice.findMany({
      where: {
        status: "OVERDUE",
        dueDate: {
          lt: threshold72h,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactEmails: true,
          },
        },
      },
    });

    result.alertCount = criticalInvoices.length;

    // 2. Enviar alertas críticas
    for (const invoice of criticalInvoices) {
      try {
        const daysOverdue = invoice.dueDate
          ? Math.floor(
              (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;

        const { sendNotification } = await import("@/actions/notification-actions");
        const { sendPushNotification } = await import("@/actions/push-actions");

        const admins = await db.user.findMany({
          where: { roleLegacy: "ADMIN" },
          select: { id: true },
        });

        // Notificación in-app (CRÍTICA)
        for (const admin of admins) {
          await sendNotification({
            userId: admin.id,
            message: `🚨 CRÍTICO: ${invoice.client.name} - $${invoice.amount} ESTÁ ${daysOverdue} DÍAS VENCIDA - COBRO INMEDIATO REQUERIDO`,
            type: "COBRANZA_CRITICAL",
          });
        }

        // Push notification (rojo, prioritario)
        await sendPushNotification({
          title: "🚨 ALERTA CRÍTICA DE COBRANZA",
          message: `${invoice.client.name} - $${invoice.amount} vencida ${daysOverdue} días`,
          userIds: admins.map((a) => a.id),
          url: `/finance?invoiceId=${invoice.id}`,
          data: {
            priority: "CRITICAL",
            daysOverdue: daysOverdue.toString(),
          },
        });

        result.alertsSent++;
      } catch (error) {
        console.error(`Error en alerta crítica ${invoice.id}:`, error);
      }
    }

    console.log(`✅ Alertas 72h: ${result.alertCount} facturas críticas detectadas, ${result.alertsSent} alertas enviadas`);
    return result;
  } catch (error) {
    console.error("❌ Error en checkPaymentAlerts72Hours:", error);
    throw error;
  }
}

/**
 * Obtiene resumen de cobranzas pendientes
 */
export async function getCobranzaSummary() {
  try {
    const today = new Date();
    const threshold72h = addDays(today, -3);

    // Resumen por estado
    const [pendingCount, sentCount, overdueCount, overdueSum, critical72hCount, critical72hSum] = await Promise.all([
      db.invoice.count({ where: { status: "PENDING" } }),
      db.invoice.count({ where: { status: "SENT" } }),
      db.invoice.count({ where: { status: "OVERDUE" } }),
      db.invoice.aggregate({
        where: { status: "OVERDUE" },
        _sum: { amount: true },
      }),
      db.invoice.count({
        where: {
          status: "OVERDUE",
          dueDate: { lt: threshold72h },
        },
      }),
      db.invoice.aggregate({
        where: {
          status: "OVERDUE",
          dueDate: { lt: threshold72h },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      pending: {
        count: pendingCount,
        pendingApproval: true,
      },
      sent: {
        count: sentCount,
        awaiting: true,
      },
      overdue: {
        count: overdueCount,
        amount: overdueSum._sum?.amount || 0,
      },
      critical72h: {
        count: critical72hCount,
        amount: critical72hSum._sum?.amount || 0,
        action: "COBRO_INMEDIATO",
      },
    };
  } catch (error) {
    console.error("❌ Error en getCobranzaSummary:", error);
    throw error;
  }
}
