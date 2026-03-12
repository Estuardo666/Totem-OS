"use server";

import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export interface UserWorkload {
  userId: string;
  userName: string;
  userRole: string;
  specialty: string | null;
  userImage: string | null;
  pendingTasksCount: number;
  allocatedMinutes: number;
  weeklyCapacityMinutes: number;
  saturationThresholdMinutes: number;
}

function getWeeklyCapacityMinutes(input: {
  role: string;
  specialty: string | null;
}): number {
  if (input.role === "ADMIN") {
    return 4 * 6 * 60;
  }

  if (input.specialty === "COMMUNITY") {
    return 2 * 5 * 60;
  }

  if (input.role === "EDITOR") {
    return 10 * 90;
  }

  return 5 * 60;
}

function getEstimatedTaskMinutes(input: {
  status: string;
  type: string;
}): number {
  if (input.status === "IDEA" || input.status === "CLIENT_APPROVED") {
    return 50;
  }

  if (["RECORDED", "EDITING", "REVIEW_INTERNAL", "REVIEW_CLIENT"].includes(input.status)) {
    return input.type === "REEL" ? 90 : 50;
  }

  return 0;
}

/**
 * Server Action para obtener la carga de trabajo por usuario
 * Retorna el conteo de tareas pendientes para cada usuario del equipo
 * 
 * REGLAS DE NEGOCIO CRÍTICAS:
 * - EDITOR: Es responsable SOLO si el estado es IDEA, RECORDED, EDITING, REVISION_CLIENTE
 *   Si pasa a CLIENT_APPROVED o PUBLISHED, se RESTA de su carga (count = 0)
 * - COMMUNITY: Es responsable SOLO si el estado es CLIENT_APPROVED
 *   Si está en estados previos, NO es su responsabilidad
 *   Si pasa a PUBLICADO, se considera finalizada y NO suma a nadie
 */
export async function getUserWorkloads(): Promise<ApiResponse<UserWorkload[]>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        roleLegacy: true,
        specialty: true,
        image: true,
      },
    });

    const workloads: UserWorkload[] = await Promise.all(
      users.map(async (user) => {
        const assignedTasks = await db.contentTask.findMany({
          where: {
            client: {
              status: { not: "INACTIVE" },
            },
            OR: [
              {
                status: "IDEA",
                assignedCommunityId: user.id,
              },
              {
                status: {
                  in: ["RECORDED", "EDITING", "REVIEW_INTERNAL", "REVIEW_CLIENT"],
                },
                assignedEditorId: user.id,
              },
              ...(user.roleLegacy === "ADMIN" && user.specialty === "COMMUNITY"
                ? [
                    {
                      status: "CLIENT_APPROVED",
                      assignedCommunityId: user.id,
                    },
                  ]
                : []),
            ],
          },
          select: {
            id: true,
            status: true,
            type: true,
          },
        });

        const pendingTasksCount = assignedTasks.length;
        const allocatedMinutes = assignedTasks.reduce((sum, task) => {
          return sum + getEstimatedTaskMinutes({
            status: task.status,
            type: task.type,
          });
        }, 0);
        const weeklyCapacityMinutes = getWeeklyCapacityMinutes({
          role: user.roleLegacy,
          specialty: user.specialty,
        });
        const saturationThresholdMinutes = Math.round(weeklyCapacityMinutes * 0.8);

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.roleLegacy,
          specialty: user.specialty,
          userImage: user.image,
          pendingTasksCount,
          allocatedMinutes,
          weeklyCapacityMinutes,
          saturationThresholdMinutes,
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


