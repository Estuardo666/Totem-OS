"use server";

import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export interface UserWorkload {
  userId: string;
  userName: string;
  userRole: string;
  userImage: string | null;
  pendingTasksCount: number;
  weeklyCapacity: number; // Capacidad semanal estimada (ej: 10 tareas)
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
        const pendingTasksCount = await db.contentTask.count({
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
        });

        // Capacidad semanal estimada según el rol
        // ADMIN: 15, EDITOR: 10, VIEWER: 5
        let weeklyCapacity = 10; // Default
        if (user.roleLegacy === "ADMIN") {
          weeklyCapacity = 15;
        } else if (user.roleLegacy === "EDITOR") {
          weeklyCapacity = 10;
        }

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.roleLegacy,
          userImage: user.image,
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


