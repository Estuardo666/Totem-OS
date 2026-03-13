"use server";

import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { startOfMonth, endOfMonth, addDays, isBefore } from "date-fns";
import type { ContentTask, Shoot, Client } from "@prisma/client";

export interface DashboardData {
  radar: {
    IDEA: number;
    SCRIPT: number;
    RECORDED: number;
    EDITING: number;
    REVIEW_CLIENT: number;
    CLIENT_APPROVED: number;
    PUBLISHED: number;
    shootsThisMonth: number;
  };
  semaphore: Array<{
    clientId: string;
    clientName: string;
    totalTasks: number;
    completedTasks: number;
    status: "GREEN" | "YELLOW" | "RED";
  }>;
  nextShoots: Array<Shoot & {
    client: Client;
    crew: Array<{ id: string; name: string; image: string | null }>;
  }>;
  warRoom: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    scheduledAt: Date | null;
    publishedAt: Date | null;
    client: {
      id: string;
      name: string;
    };
    assignedTo: { id: string; name: string } | null;
    metrics: { id: string } | null;
  }>;
  calendar: {
    shoots: Array<Shoot & { client: Client }>;
    tasks: Array<ContentTask & { client: Client }>;
  };
}

/**
 * Obtiene todos los datos del dashboard de Content Factory
 */
export async function getContentDashboardData(): Promise<ApiResponse<DashboardData>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "No autenticado" };
    }

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const twoDaysFromNow = addDays(now, 2);

    // Ejecutar todas las consultas en paralelo
    const [
      radarData,
      clientsData,
      tasksData,
      nextShootsData,
      shootsThisMonthCount,
      warRoomTasks,
      calendarShoots,
      calendarTasks,
    ] = await Promise.all([
      // Radar: Conteo de tareas por estado
      db.contentTask.groupBy({
        by: ["status"],
        _count: {
          id: true,
        },
      }),

      // Clientes activos
      db.client.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
        },
      }),

      // Todas las tareas para calcular semáforo
      db.contentTask.findMany({
        where: {
          dueDate: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
        select: {
          id: true,
          clientId: true,
          status: true,
        },
      }),

      // Próximos 5 rodajes (ordenados por fecha ascendente)
      db.shoot.findMany({
        where: {
          status: "SCHEDULED",
          startTime: {
            gte: now,
          },
        },
        take: 5,
        include: {
          client: true,
          crew: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          startTime: "asc",
        },
      }),

      // Conteo de rodajes del mes actual
      db.shoot.count({
        where: {
          startTime: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
      }),

      // Sala de Guerra: Tareas atrasadas o urgentes (< 2 días) O tareas publicadas sin métricas (> 7 días)
      // Estado NO debe ser PUBLISHED o CLIENT_APPROVED (excepto para tareas sin métricas)
      db.contentTask.findMany({
        where: {
          OR: [
            // Tareas urgentes/atrasadas
            {
              status: {
                notIn: ["PUBLISHED", "CLIENT_APPROVED"],
              },
              scheduledAt: {
                lte: twoDaysFromNow,
                not: null,
              },
            },
            // Tareas publicadas sin métricas (más de 7 días)
            {
              status: "PUBLISHED",
              publishedAt: {
                lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 días atrás
              },
              metrics: null,
            },
          ],
        },
        include: {
          client: true,
          assignedEditor: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          assignedCommunity: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          metrics: {
            select: {
              id: true,
            },
          },
        },
        // Ordenar por prioridad primero, luego por scheduledAt
        orderBy: [
          {
            priority: "asc", // Esto ordenará alfabéticamente: HIGH, LOW, MEDIUM, URGENT
          },
          {
            scheduledAt: "asc",
          },
        ],
      }),

      // Calendario: Rodajes del mes actual
      db.shoot.findMany({
        where: {
          startTime: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
        include: {
          client: true,
        },
        orderBy: {
          startTime: "asc",
        },
      }),

      // Calendario: Tareas del mes actual con scheduledAt
      db.contentTask.findMany({
        where: {
          scheduledAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
        include: {
          client: true,
        },
        orderBy: {
          scheduledAt: "asc",
        },
      }),
    ]);

    // Procesar Radar - Mapear estados según requerimientos
    const radar = {
      IDEA: 0,
      SCRIPT: 0,
      RECORDED: 0,
      EDITING: 0,
      REVIEW_CLIENT: 0,
      CLIENT_APPROVED: 0,
      PUBLISHED: 0,
      shootsThisMonth: shootsThisMonthCount,
    };

    radarData.forEach((item) => {
      const status = item.status;
      // Mapear estados: IDEA, RECORDED, EDITING, REVIEW_CLIENT, CLIENT_APPROVED, PUBLISHED
      if (status === "IDEA") {
        radar.IDEA = item._count.id;
      } else if (status === "SCRIPT") {
        radar.SCRIPT = item._count.id;
      } else if (status === "RECORDED") {
        radar.RECORDED = item._count.id;
      } else if (status === "EDITING") {
        radar.EDITING = item._count.id;
      } else if (status === "REVIEW_CLIENT") {
        radar.REVIEW_CLIENT = item._count.id;
      } else if (status === "CLIENT_APPROVED") {
        radar.CLIENT_APPROVED = item._count.id;
      } else if (status === "PUBLISHED") {
        radar.PUBLISHED = item._count.id;
      }
    });

    // Procesar Semáforo
    const semaphore = clientsData.map((client) => {
      const clientTasks = tasksData.filter((task) => task.clientId === client.id);
      const totalTasks = clientTasks.length;
      const completedTasks = clientTasks.filter(
        (task) => task.status === "PUBLISHED" || task.status === "APPROVED"
      ).length;

      // Determinar estado del semáforo
      let status: "GREEN" | "YELLOW" | "RED";
      if (totalTasks === 0) {
        status = "GREEN";
      } else {
        const completionRate = completedTasks / totalTasks;
        if (completionRate >= 0.8) {
          status = "GREEN";
        } else if (completionRate >= 0.5) {
          status = "YELLOW";
        } else {
          status = "RED";
        }
      }

      return {
        clientId: client.id,
        clientName: client.name,
        totalTasks,
        completedTasks,
        status,
      };
    });

    // Asegurar que warRoomTasks sea siempre un array
    const warRoomTasksArray = Array.isArray(warRoomTasks) ? warRoomTasks : [];

    // Filtrar Sala de Guerra: solo tareas cuya fecha ya pasó o es en < 2 días
    const filteredTasks = warRoomTasksArray.filter((task) => {
      if (!task.scheduledAt) return false;
      return isBefore(task.scheduledAt, twoDaysFromNow) || isBefore(task.scheduledAt, now);
    });

    // Ordenar por prioridad: URGENT -> HIGH -> MEDIUM -> LOW
    // Dentro de cada prioridad, ordenar por scheduledAt ascendente
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const warRoom = filteredTasks
      .map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type,
        status: task.status,
        priority: task.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        scheduledAt: task.scheduledAt,
        publishedAt: task.publishedAt,
        client: {
          id: task.client.id,
          name: task.client.name,
        },
        assignedTo: task.assignedEditor 
          ? { id: task.assignedEditor.id, name: task.assignedEditor.name }
          : task.assignedCommunity 
            ? { id: task.assignedCommunity.id, name: task.assignedCommunity.name }
            : null,
        metrics: task.metrics,
      }))
      .sort((a, b) => {
        const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
        const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // Si tienen la misma prioridad, ordenar por scheduledAt
        if (!a.scheduledAt || !b.scheduledAt) return 0;
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });

    return {
      success: true,
      data: {
        radar,
        semaphore,
        nextShoots: nextShootsData,
        warRoom,
        calendar: {
          shoots: calendarShoots,
          tasks: calendarTasks,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener datos del dashboard",
    };
  }
}

