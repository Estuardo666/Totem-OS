"use server";

import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export interface UserWorkload {
  userId: string;
  userName: string;
  userRole: string;
  userSpecialty: string | null;
  userImage: string | null;
  pendingTasksCount: number;
  weeklyCapacity: number; // Capacidad semanal estimada (ej: 10 tareas)
  allocatedMinutes: number;
  weeklyCapacityMinutes: number;
  saturationThresholdMinutes: number;
}

const ESTIMATED_MINUTES_PER_TASK = 60;
const EDITOR_RESPONSIBLE_STATUSES = ["RECORDED", "EDITING", "REVIEW_CLIENT"] as const;
const COMMUNITY_RESPONSIBLE_STATUSES = ["IDEA", "SCRIPT", "CLIENT_APPROVED"] as const;

/**
 * Server Action para obtener la carga de trabajo por usuario
 * Retorna el conteo de tareas pendientes para cada usuario del equipo
 * 
 * REGLAS DE NEGOCIO CRÍTICAS:
 * - EDITOR: Es responsable SOLO si el estado es RECORDED, EDITING, REVISION_CLIENTE
 *   Si pasa a CLIENT_APPROVED o PUBLISHED, se RESTA de su carga (count = 0)
 * - COMMUNITY: Es responsable SOLO si el estado es CLIENT_APPROVED
 *   Si está en estados previos, NO es su responsabilidad
 *   Si pasa a PUBLICADO, se considera finalizada y NO suma a nadie
 */
export async function getUserWorkloads(): Promise<ApiResponse<UserWorkload[]>> {
  try {
    // 0. Verificar autenticación
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
    }

    // Obtener todos los usuarios con su specialty
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        roleLegacy: true,
        specialty: true,
        image: true,
      },
    });

    // Obtener conteo de tareas pendientes por usuario
    const workloads: UserWorkload[] = await Promise.all(
      users.map(async (user) => {
        let pendingTasksCount = 0;
        const userRole = user.roleLegacy;
        const normalizedSpecialty = user.specialty?.toUpperCase() ?? null;
        const actsAsCommunity = normalizedSpecialty?.includes("COMMUNITY") ?? false;

        // LÓGICA PARA EDITORES (role: EDITOR o ADMIN)
        // Solo cuentan tareas en estados: RECORDED, EDITING, REVIEW_CLIENT
        // NO cuentan: CLIENT_APPROVED, APPROVED, PUBLISHED
        const editorCount = await db.contentTask.count({
          where: {
            assignedEditorId: user.id,
            status: {
              in: [...EDITOR_RESPONSIBLE_STATUSES],
            },
          },
        });

        // LÓGICA PARA COMMUNITY
        // Cuentan tareas en estados: IDEA, SCRIPT, CLIENT_APPROVED
        let communityCount = 0;
        if (actsAsCommunity) {
          communityCount = await db.contentTask.count({
            where: {
              assignedCommunityId: user.id,
              status: {
                in: [...COMMUNITY_RESPONSIBLE_STATUSES],
              },
            },
          });
        }

        // Sumar ambos contadores (un usuario puede tener ambos roles)
        pendingTasksCount = editorCount + communityCount;

        // Capacidad semanal estimada según el rol
        // ADMIN: 15, EDITOR: 10, VIEWER: 5
        let weeklyCapacity = 10; // Default
        if (userRole === "ADMIN") {
          weeklyCapacity = 15;
        } else if (userRole === "EDITOR") {
          weeklyCapacity = 10;
        } else if (userRole === "VIEWER") {
          weeklyCapacity = 5;
        }

        const allocatedMinutes = pendingTasksCount * ESTIMATED_MINUTES_PER_TASK;
        const weeklyCapacityMinutes = weeklyCapacity * ESTIMATED_MINUTES_PER_TASK;
        const saturationThresholdMinutes = Math.round(weeklyCapacityMinutes * 0.8);

        return {
          userId: user.id,
          userName: user.name,
          userRole,
          userSpecialty: user.specialty,
          userImage: user.image,
          pendingTasksCount,
          weeklyCapacity,
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


