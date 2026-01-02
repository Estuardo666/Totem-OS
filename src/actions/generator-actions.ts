"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import type { ApiResponse } from "@/types";
import { startOfMonth, endOfMonth, addDays } from "date-fns";

// Planes de estrategia mensual de la agencia
const AGENCY_PLANS = {
  STANDARD: [
    { title: "Reel 1: (Tema por definir)", type: "REEL" as const },
    { title: "Reel 2: (Tema por definir)", type: "REEL" as const },
    { title: "Reel 3: (Tema por definir)", type: "REEL" as const },
    { title: "Flyer: (Tema por definir)", type: "FLYER" as const },
  ],
  PLAN_2: [
    { title: "Reel 1: (Tema por definir)", type: "REEL" as const },
    { title: "Reel 2: (Tema por definir)", type: "REEL" as const },
    { title: "Reel 3: (Tema por definir)", type: "REEL" as const },
    { title: "Reel 4: (Tema por definir)", type: "REEL" as const },
    { title: "Reel 5: (Tema por definir)", type: "REEL" as const },
    { title: "Reel 6: (Tema por definir)", type: "REEL" as const },
    { title: "Flyer: (Tema por definir)", type: "FLYER" as const },
  ],
} as const;

export type PlanType = keyof typeof AGENCY_PLANS;

/**
 * Genera un plan mensual de tareas para los clientes seleccionados
 * Crea todas las tareas del plan seleccionado para cada cliente
 */
export async function generateMonthlyPlan(
  clientIds: string[],
  monthDate: Date,
  planType: PlanType = "STANDARD"
): Promise<ApiResponse<{ tasksCreated: number; clientsProcessed: number }>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    if (clientIds.length === 0) {
      return { success: false, error: "Debes seleccionar al menos un cliente" };
    }

    // Obtener el plan seleccionado
    const selectedPlan = AGENCY_PLANS[planType];
    if (!selectedPlan) {
      return { success: false, error: "Tipo de plan inválido" };
    }

    // Calcular el inicio y fin del mes objetivo
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const daysInMonth = monthEnd.getDate();

    let totalTasksCreated = 0;
    const clientsProcessed: string[] = [];

    // Iterar sobre cada cliente
    for (const clientId of clientIds) {
      // Verificar que el cliente existe
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, editorId: true },
      });

      if (!client) {
        console.warn(`⚠️ Cliente ${clientId} no encontrado, saltando...`);
        continue;
      }

      // Verificar si ya existen tareas para este mes (opcional: prevenir duplicados)
      const existingTasksCount = await db.contentTask.count({
        where: {
          clientId: clientId,
          scheduledAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      if (existingTasksCount > 0) {
        console.log(
          `⚠️ Cliente ${client.name} ya tiene ${existingTasksCount} tareas en este mes, saltando...`
        );
        continue;
      }

      // Crear las tareas del plan seleccionado
      for (let i = 0; i < selectedPlan.length; i++) {
        const planItem = selectedPlan[i];
        
        // Distribuir las tareas equitativamente a lo largo del mes
        // Usar el mes seleccionado (monthDate) para calcular las fechas
        const dayOffset = Math.floor((i * daysInMonth) / selectedPlan.length);
        const scheduledDate = addDays(monthStart, dayOffset);
        // Establecer hora a las 9:00 AM
        scheduledDate.setHours(9, 0, 0, 0);

        // Calcular dueDate: 24 horas antes de scheduledAt
        const dueDate = new Date(scheduledDate);
        dueDate.setHours(dueDate.getHours() - 24);

        await db.contentTask.create({
          data: {
            title: planItem.title,
            type: planItem.type,
            status: "IDEA",
            clientId: clientId,
            assignedEditorId: client.editorId || null,
            assignedAt: client.editorId ? new Date() : null,
            scheduledAt: scheduledDate,
            dueDate: dueDate,
          },
        });

        totalTasksCreated++;
      }

      clientsProcessed.push(client.name);
    }

    // Disparar evento de Pusher para actualización en tiempo real
    try {
      await pusherServer.trigger("kanban-channel", "update-event", {
        message: "refresh",
        action: "bulk_created",
        tasksCreated: totalTasksCreated,
        timestamp: new Date().toISOString(),
      });
      console.log("✅ Evento Pusher enviado: bulk_created");
    } catch (error) {
      console.error("❌ Error al enviar evento de Pusher:", error);
      // No fallar la operación si Pusher falla
    }

    // Revalidar rutas
    revalidatePath("/content");
    revalidatePath("/");

    return {
      success: true,
      data: {
        tasksCreated: totalTasksCreated,
        clientsProcessed: clientsProcessed.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al generar plan mensual",
    };
  }
}

