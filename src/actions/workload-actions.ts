"use server";

import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export interface UserWorkload {
  userId: string;
  userName: string;
  userRole: string;
  pendingTasksCount: number;
  weeklyCapacity: number; // Capacidad semanal estimada (ej: 10 tareas)
}

/**
 * Server Action para obtener la carga de trabajo por usuario
 * Retorna el conteo de tareas pendientes para cada usuario del equipo
 */
export async function getUserWorkloads(): Promise<ApiResponse<UserWorkload[]>> {
  try {
    // Obtener todos los usuarios
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    // Estados válidos para tareas pendientes
    const validStatuses = [
      "IDEA",
      "RECORDED",
      "EDITING",
      "REVIEW_INTERNAL",
      "REVIEW_CLIENT",
      "CLIENT_APPROVED",
      "APPROVED",
    ];

    // Obtener conteo de tareas pendientes por usuario
    const workloads: UserWorkload[] = await Promise.all(
      users.map(async (user) => {
        const pendingTasksCount = await db.contentTask.count({
          where: {
            assignedToId: user.id,
            status: {
              in: validStatuses,
            },
          },
        });

        // Capacidad semanal estimada según el rol
        // ADMIN: 15, EDITOR: 10, VIEWER: 5
        let weeklyCapacity = 10; // Default
        if (user.role === "ADMIN") {
          weeklyCapacity = 15;
        } else if (user.role === "EDITOR") {
          weeklyCapacity = 10;
        } else if (user.role === "VIEWER") {
          weeklyCapacity = 5;
        }

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          pendingTasksCount,
          weeklyCapacity,
        };
      })
    );

    return { success: true, data: workloads };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener carga de trabajo",
    };
  }
}

