"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import type { TimeEntry } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getActiveProvider } from "@/lib/ai/ai-provider-service";

/**
 * Obtiene la tarifa por hora del usuario desde la BD
 * Si no tiene hourlyRate configurado, calcula desde baseSalary como fallback
 */
async function getUserHourlyRate(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { hourlyRate: true, baseSalary: true },
  });

  if (!user) return 0;

  // Si tiene hourlyRate configurado, usarlo
  if (user.hourlyRate > 0) {
    return user.hourlyRate;
  }

  // Si no, calcular desde baseSalary como fallback
  if (user.baseSalary && user.baseSalary > 0) {
    const HOURS_PER_MONTH = 160;
    return user.baseSalary / HOURS_PER_MONTH;
  }

  return 0;
}

/**
 * Genera un resumen con IA para una sesión de trabajo
 */
async function generateTimeEntrySummary(
  durationMinutes: number,
  taskTitle?: string | null,
  clientName?: string | null
): Promise<string> {
  try {
    const config = await getActiveProvider();
    if (!config) {
      return ""; // Si no hay IA configurada, retornar vacío
    }

    const prompt = `El usuario ha trabajado ${durationMinutes} minutos${taskTitle ? ` en la tarea "${taskTitle}"` : ""}${clientName ? ` para el cliente "${clientName}"` : ""}. Genera una línea de factura profesional describiendo este trabajo para el cliente. Tono: Formal. Máximo 2 frases.`;

    // Usar OpenAI directamente para texto simple
    if (config.provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un asistente que genera descripciones profesionales de trabajo para facturas.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || "";
      }
    }

    // Para otros proveedores, usar fetch genérico
    const endpoint =
      config.provider === "grok"
        ? "https://api.x.ai/v1/chat/completions"
        : config.provider === "deepseek"
        ? "https://api.deepseek.com/v1/chat/completions"
        : "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

    const model =
      config.provider === "grok"
        ? "grok-3"
        : config.provider === "deepseek"
        ? "deepseek-chat"
        : "gemini-1.5-flash";

    const body =
      config.provider === "google"
        ? {
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }
        : {
            model,
            messages: [
              {
                role: "system",
                content: "Eres un asistente que genera descripciones profesionales de trabajo para facturas.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 150,
          };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.provider === "google") {
      headers["x-goog-api-key"] = config.apiKey;
    } else {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      if (config.provider === "google") {
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
      return data.choices[0]?.message?.content?.trim() || "";
    }
  } catch (error) {
    console.error("Error al generar resumen con IA:", error);
  }

  return "";
}

/**
 * Inicia una nueva entrada de tiempo
 */
export async function startTimeEntry(
  taskId?: string,
  clientId?: string
): Promise<ApiResponse<TimeEntry>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "No autorizado. Debes iniciar sesión.",
      };
    }

    const userId = session.user.id;

    // Verificar que no haya otra entrada corriendo
    const runningEntry = await db.timeEntry.findFirst({
      where: {
        userId,
        status: "RUNNING",
      },
    });

    if (runningEntry) {
      return {
        success: false,
        error: "Ya tienes una sesión de trabajo activa. Detén la sesión actual antes de iniciar una nueva.",
      };
    }

    // Obtener la tarifa por hora del usuario
    const hourlyRate = await getUserHourlyRate(userId);

    if (hourlyRate <= 0) {
      return {
        success: false,
        error: "La tarifa por hora no está configurada. Contacta a un administrador.",
      };
    }

    // Obtener información de la tarea si está vinculada
    let taskClientId: string | null = null;

    if (taskId) {
      const task = await db.contentTask.findUnique({
        where: { id: taskId },
        select: { clientId: true },
      });
      if (task) {
        taskClientId = task.clientId || null;
      }
    }

    // Crear la entrada
    const entry = await db.timeEntry.create({
      data: {
        userId,
        taskId: taskId || null,
        clientId: clientId || taskClientId || null,
        hourlyRate,
        status: "RUNNING",
      },
    });

    revalidatePath("/chronos");
    return { success: true, data: entry };
  } catch (error) {
    console.error("Error al iniciar entrada de tiempo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al iniciar sesión de trabajo",
    };
  }
}

/**
 * Detiene una entrada de tiempo y calcula ganancias
 */
export async function stopTimeEntry(
  entryId: string
): Promise<ApiResponse<TimeEntry>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "No autorizado. Debes iniciar sesión.",
      };
    }

    const userId = session.user.id;

    // Verificar que la entrada pertenezca al usuario
    const entry = await db.timeEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      return {
        success: false,
        error: "Entrada de tiempo no encontrada.",
      };
    }

    if (entry.userId !== userId) {
      return {
        success: false,
        error: "No tienes permiso para detener esta sesión.",
      };
    }

    if (entry.status !== "RUNNING") {
      return {
        success: false,
        error: "Esta sesión ya está cerrada.",
      };
    }

    // Obtener la tarifa por hora ACTUAL del usuario desde la BD
    const currentHourlyRate = await getUserHourlyRate(userId);

    if (currentHourlyRate <= 0) {
      return {
        success: false,
        error: "La tarifa por hora no está configurada. Contacta a un administrador.",
      };
    }

    // Calcular duración y ganancias usando la tarifa actual
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - entry.startTime.getTime()) / 1000);
    const durationHours = durationSeconds / 3600;
    const earnings = durationHours * currentHourlyRate;

    // Obtener información para el resumen de IA
    let taskTitle: string | null = null;
    let clientName: string | null = null;

    if (entry.taskId) {
      const task = await db.contentTask.findUnique({
        where: { id: entry.taskId },
        include: {
          client: {
            select: { name: true },
          },
        },
      });
      if (task) {
        taskTitle = task.title;
        clientName = task.client?.name || null;
      }
    } else if (entry.clientId) {
      const client = await db.client.findUnique({
        where: { id: entry.clientId },
        select: { name: true },
      });
      if (client) {
        clientName = client.name;
      }
    }

    const durationMinutes = Math.round(durationSeconds / 60);

    // Generar resumen con IA
    const aiSummary = await generateTimeEntrySummary(durationMinutes, taskTitle, clientName);

    // Actualizar la entrada (actualizar también hourlyRate por si cambió desde que inició la sesión)
    const updatedEntry = await db.timeEntry.update({
      where: { id: entryId },
      data: {
        endTime,
        duration: durationSeconds,
        hourlyRate: currentHourlyRate, // Actualizar con la tarifa actual
        earnings,
        status: "COMPLETED",
        aiSummary: aiSummary || null,
      },
    });

    revalidatePath("/chronos");
    return { success: true, data: updatedEntry };
  } catch (error) {
    console.error("Error al detener entrada de tiempo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al detener sesión de trabajo",
    };
  }
}

/**
 * Obtiene la entrada de tiempo activa del usuario
 */
export async function getRunningTimeEntry(): Promise<ApiResponse<TimeEntry | null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "No autorizado. Debes iniciar sesión.",
      };
    }

    const entry = await db.timeEntry.findFirst({
      where: {
        userId: session.user.id,
        status: "RUNNING",
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    return { success: true, data: entry };
  } catch (error) {
    console.error("Error al obtener entrada activa:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener sesión activa",
    };
  }
}

/**
 * Obtiene estadísticas semanales del usuario
 */
export async function getWeeklyStats(
  userId?: string
): Promise<
  ApiResponse<{
    dailyStats: Array<{
      day: string;
      date: string;
      hours: number;
      earnings: number;
    }>;
    totalHours: number;
    totalEarnings: number;
  }>
> {
  try {
    const session = await auth();
    const targetUserId = userId || session?.user?.id;

    if (!targetUserId) {
      return {
        success: false,
        error: "No autorizado. Debes iniciar sesión.",
      };
    }

    // Calcular inicio y fin de la semana (lunes a domingo)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Obtener todas las entradas completadas de la semana
    const entries = await db.timeEntry.findMany({
      where: {
        userId: targetUserId,
        status: "COMPLETED",
        startTime: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        startTime: true,
        duration: true,
        earnings: true,
      },
    });

    // Agrupar por día
    const dailyMap = new Map<string, { hours: number; earnings: number }>();

    // Inicializar todos los días de la semana con 0
    const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      dailyMap.set(dateKey, { hours: 0, earnings: 0 });
    }

    // Sumar las entradas por día
    entries.forEach((entry) => {
      if (!entry.duration || !entry.earnings) return;

      const dateKey = entry.startTime.toISOString().split("T")[0];
      const existing = dailyMap.get(dateKey) || { hours: 0, earnings: 0 };
      dailyMap.set(dateKey, {
        hours: existing.hours + entry.duration / 3600,
        earnings: existing.earnings + entry.earnings,
      });
    });

    // Convertir a array ordenado
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => {
        const dateObj = new Date(date);
        const dayIndex = dateObj.getDay();
        const dayName = dayNames[dayIndex === 0 ? 6 : dayIndex - 1]; // Ajustar para que lunes = 0
        return {
          day: dayName,
          date,
          hours: Math.round(stats.hours * 100) / 100,
          earnings: Math.round(stats.earnings * 100) / 100,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalHours = dailyStats.reduce((sum, day) => sum + day.hours, 0);
    const totalEarnings = dailyStats.reduce((sum, day) => sum + day.earnings, 0);

    return {
      success: true,
      data: {
        dailyStats,
        totalHours: Math.round(totalHours * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
      },
    };
  } catch (error) {
    console.error("Error al obtener estadísticas semanales:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener estadísticas semanales",
    };
  }
}

/**
 * Obtiene el salario acumulado del mes actual
 */
export async function getMonthlySalary(
  userId?: string
): Promise<
  ApiResponse<{
    monthlyEarnings: number;
    monthlyHours: number;
    averageHourlyRate: number;
    entryCount: number;
  }>
> {
  try {
    const session = await auth();
    const targetUserId = userId || session?.user?.id;

    if (!targetUserId) {
      return {
        success: false,
        error: "No autorizado. Debes iniciar sesión.",
      };
    }

    // Calcular inicio y fin del mes actual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Obtener todas las entradas completadas del mes
    const entries = await db.timeEntry.findMany({
      where: {
        userId: targetUserId,
        status: "COMPLETED",
        startTime: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        duration: true,
        earnings: true,
        hourlyRate: true,
      },
    });

    const monthlyEarnings = entries.reduce((sum, entry) => sum + (entry.earnings || 0), 0);
    const monthlyHours = entries.reduce((sum, entry) => sum + (entry.duration || 0) / 3600, 0);
    const entryCount = entries.length;

    const averageHourlyRate =
      monthlyHours > 0 ? monthlyEarnings / monthlyHours : 0;

    return {
      success: true,
      data: {
        monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
        monthlyHours: Math.round(monthlyHours * 100) / 100,
        averageHourlyRate: Math.round(averageHourlyRate * 100) / 100,
        entryCount,
      },
    };
  } catch (error) {
    console.error("Error al obtener salario mensual:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener salario mensual",
    };
  }
}
