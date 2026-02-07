"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { createContentTaskSchema, updateContentTaskSchema, updateTaskMetricsSchema, dynamicTaskMetricsSchema, batchCreateContentTasksSchema } from "@/schemas/content";
import type { ApiResponse } from "@/types";
import type { ContentTask, Client, TaskMetrics } from "@prisma/client";
import { sendNotification } from "./notification-actions";

/**
 * Obtiene el Community Manager para un cliente
 * Prioridad: 1) communityId del cliente, 2) Primer ADMIN encontrado, 3) null
 */
async function getCommunityManagerId(clientId: string): Promise<string | null> {
  try {
    // 1. Buscar el communityId del cliente
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { communityId: true },
    });

    if (client?.communityId) {
      return client.communityId;
    }

    // 2. Si no hay communityId, buscar el primer ADMIN como fallback
    const adminUser = await db.user.findFirst({
      where: { roleLegacy: "ADMIN" },
      select: { id: true },
    });

    if (adminUser) {
      return adminUser.id;
    }

    // 3. Si no hay ADMIN, retornar null
    return null;
  } catch (error) {
    console.error("❌ Error al obtener Community Manager:", error);
    return null;
  }
}

/**
 * Dispara evento de Pusher para actualizar el dashboard de usuarios afectados
 */
async function triggerDashboardUpdate(userIds: string[]): Promise<void> {
  try {
    const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
    
    if (uniqueUserIds.length === 0) return;

    for (const userId of uniqueUserIds) {
      try {
        await pusherServer.trigger(`user-${userId}`, "update-dashboard", {
          message: "Dashboard actualizado",
          timestamp: new Date().toISOString(),
        });
        console.log(`✅ Evento de actualización del dashboard enviado a usuario ${userId}`);
      } catch (error) {
        console.error(`❌ Error al enviar evento de actualización a usuario ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error("❌ Error al disparar eventos de actualización del dashboard:", error);
    // No fallar la operación si Pusher falla
  }
}

// Tipo para ContentTask con relación de cliente incluida
export type ContentTaskWithClient = ContentTask & {
  client: Client & {
    brandAssets: Array<{
      id: string;
      name: string;
      url: string;
      fileType: string;
    }>;
  };
};

async function persistTask(validatedData: ReturnType<typeof createContentTaskSchema.parse>) {
  const client = await db.client.findUnique({
    where: { id: validatedData.clientId },
    select: { editorId: true, communityId: true, name: true },
  });

  const assignedEditorId = validatedData.assignedEditorId ?? client?.editorId ?? null;
  const assignedCommunityId = validatedData.assignedCommunityId ?? client?.communityId ?? null;

  const task = await db.contentTask.create({
    data: {
      title: validatedData.title,
      type: validatedData.type,
      status: validatedData.status ?? "IDEA",
      dueDate: validatedData.dueDate ?? null,
      scheduledAt: validatedData.scheduledAt ?? null,
      clientId: validatedData.clientId,
      assignedEditorId,
      assignedCommunityId,
      assignedAt: (assignedEditorId || assignedCommunityId) ? new Date() : null,
      shootId: validatedData.shootId ?? null,
      reviewToken: validatedData.reviewToken ?? null,
      clientFeedback: validatedData.clientFeedback ?? null,
      publishedAt: validatedData.publishedAt ?? null,
      postCopy: validatedData.postCopy ?? null,
      coverImageUrl: validatedData.coverImageUrl ?? null,
      audioBriefUrl: validatedData.audioBriefUrl ?? null,
    },
  });

  return { task, clientName: client?.name ?? null, assignedEditorId, assignedCommunityId };
}

async function notifyAndRevalidate({
  task,
  clientName,
  assignedEditorId,
  assignedCommunityId,
}: {
  task: ContentTask;
  clientName: string | null;
  assignedEditorId: string | null;
  assignedCommunityId: string | null;
}) {
  const { auth } = await import("@/auth");
  const session = await auth();
  const sessionUserId = session?.user?.id;

  if (assignedEditorId && assignedEditorId !== sessionUserId) {
    try {
      await sendNotification({
        userId: assignedEditorId,
        message: `Se te ha asignado una nueva tarea como Editor: "${task.title}"${clientName ? ` para ${clientName}` : ""}`,
        type: "ASSIGNED",
        createdBy: sessionUserId || undefined,
      });
    } catch (error) {
      console.error("❌ Error al enviar notificación de asignación (Editor):", error);
    }
  }

  if (assignedCommunityId && assignedCommunityId !== sessionUserId) {
    try {
      await sendNotification({
        userId: assignedCommunityId,
        message: `Se te ha asignado una nueva tarea como Community: "${task.title}"${clientName ? ` para ${clientName}` : ""}`,
        type: "ASSIGNED",
        createdBy: sessionUserId || undefined,
      });
    } catch (error) {
      console.error("❌ Error al enviar notificación de asignación (Community):", error);
    }
  }

  revalidatePath("/content");
  revalidatePath("/content/dashboard");
  revalidatePath("/");

  try {
    await pusherServer.trigger("kanban-channel", "update-event", {
      message: "refresh",
      taskId: task.id,
      action: "created",
      timestamp: new Date().toISOString(),
    });
    console.log("✅ Evento Kanban enviado a Pusher correctamente");
  } catch (error) {
    console.error("❌ ERROR CRÍTICO AL ENVIAR A PUSHER (Kanban):", error);
  }

  const affectedUserIds: string[] = [];
  if (assignedEditorId) affectedUserIds.push(assignedEditorId);
  if (assignedCommunityId) affectedUserIds.push(assignedCommunityId);
  if (sessionUserId) affectedUserIds.push(sessionUserId);
  await triggerDashboardUpdate(affectedUserIds);

  // Notificar a los admins sobre la nueva tarea (Pusher + PUSH PWA)
  try {
    const { notifyAdminsWithPush } = await import("@/actions/notification-actions");
    const assignedTo = assignedEditorId || assignedCommunityId ? "asignada" : "sin asignar";
    const taskInfo = `${task.title}${clientName ? ` - ${clientName}` : ""}`;
    
    await notifyAdminsWithPush(
      "Nueva tarea creada",
      `Se creó una nueva tarea ${assignedTo}: ${taskInfo}`,
      "ADMIN_ALERT",
      "/content",
      sessionUserId || undefined
    );
  } catch (error) {
    console.error("❌ Error al enviar notificaciones PUSH a admins:", error);
    // No fallar la operación si las notificaciones fallan
  }
}

/**
 * Server Action para crear una tarea de contenido
 */
export async function createTask(
  input: unknown
): Promise<ApiResponse<ContentTask>> {
  try {
    const validatedData = createContentTaskSchema.parse(input);
    const { task, clientName, assignedEditorId, assignedCommunityId } = await persistTask(validatedData);
    await notifyAndRevalidate({
      task,
      clientName,
      assignedEditorId,
      assignedCommunityId,
    });
    return { success: true, data: task };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear tarea",
    };
  }
}

export async function createTasksBatch(
  input: unknown
): Promise<ApiResponse<{ created: ContentTask[]; errors: string[] }>> {
  try {
    const { tasks } = batchCreateContentTasksSchema.parse(input);
    const created: ContentTask[] = [];
    const errors: string[] = [];

    for (const taskInput of tasks) {
      try {
        const { task, clientName, assignedEditorId, assignedCommunityId } = await persistTask(taskInput);
        created.push(task);
        await notifyAndRevalidate({
          task,
          clientName,
          assignedEditorId,
          assignedCommunityId,
        });
      } catch (taskError) {
        errors.push(
          taskError instanceof Error
            ? `${taskInput.title}: ${taskError.message}`
            : `${taskInput.title}: Error desconocido`
        );
      }
    }

    return {
      success: errors.length === 0,
      data: { created, errors },
      error: errors.length ? "Algunas tareas no se pudieron crear" : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear tareas en lote",
    };
  }
}

/**
 * Server Action para obtener todas las tareas de contenido
 * Retorna las tareas ordenadas por fecha de entrega ascendente (más urgente primero)
 * Incluye la relación del cliente para mostrar su nombre
 * Filtra por rol: EDITOR solo ve sus tareas asignadas, ADMIN ve todas (a menos que showOnlyMine sea true)
 */
export async function getTasks(showOnlyMine?: boolean): Promise<ApiResponse<ContentTaskWithClient[]>> {
  try {
    // Obtener sesión para verificar rol
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const userRole = session?.user?.role;

    // Si es EDITOR, siempre filtrar solo sus tareas asignadas como editor
    // Si es ADMIN y showOnlyMine es true, filtrar solo sus tareas
    // Si es ADMIN y showOnlyMine es false o undefined, mostrar todas
    const whereClause = 
      (userRole === "EDITOR" && sessionUserId) || 
      (userRole === "ADMIN" && showOnlyMine && sessionUserId)
        ? { 
            client: {
              status: { not: "INACTIVE" },
            },
            OR: [
              { assignedEditorId: sessionUserId },
              { assignedCommunityId: sessionUserId }
            ]
          }
        : {
            client: {
              status: { not: "INACTIVE" },
            },
          };

    const tasks = await db.contentTask.findMany({
      where: whereClause,
      include: {
        client: {
          // Incluir brandAssets con select específico, pero todos los demás campos del cliente se incluyen automáticamente
          include: {
            brandAssets: {
              select: {
                id: true,
                name: true,
                url: true,
                fileType: true,
              },
            },
          },
          // Nota: brandDNA y todos los demás campos del modelo Client se incluyen automáticamente con include
        },
      },
      orderBy: {
        dueDate: "asc", // Ordena por fecha ascendente (nulls al final por defecto)
      },
    });

    // Debug: Verificar que brandDNA esté presente en las tareas
    if (tasks.length > 0) {
      console.log("[getTasks] Sample task client brandDNA:", {
        taskId: tasks[0].id,
        clientId: tasks[0].client.id,
        clientName: tasks[0].client.name,
        hasBrandDNA: !!tasks[0].client.brandDNA,
        brandDNAValue: tasks[0].client.brandDNA ? tasks[0].client.brandDNA.substring(0, 100) : null,
      });
    }

    return { success: true, data: tasks };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener tareas",
    };
  }
}

/**
 * Server Action para obtener tareas pendientes del usuario logueado
 * Retorna el conteo de tareas asignadas al usuario
 * 
 * REGLAS DE NEGOCIO CRÍTICAS:
 * - EDITOR: Solo cuenta tareas en estados IDEA, RECORDED, EDITING, REVIEW_CLIENT
 *   NO cuenta CLIENT_APPROVED, APPROVED, PUBLISHED
 * - COMMUNITY (specialty): Solo cuenta tareas en estado CLIENT_APPROVED
 *   NO cuenta estados previos ni PUBLICADO
 */
export async function getPendingTasksCount(): Promise<ApiResponse<number>> {
  try {
    // Obtener sesión directamente
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    // Si no hay userId en la sesión, retornar 0
    if (!sessionUserId) {
      return { success: true, data: 0 };
    }

    // Obtener specialty del usuario desde la base de datos
    const user = await db.user.findUnique({
      where: { id: sessionUserId },
      select: { specialty: true },
    });

    const userSpecialty = user?.specialty;

    // Si es COMMUNITY, solo contar tareas con estado CLIENT_APPROVED
    if (userSpecialty === "COMMUNITY") {
      const count = await db.contentTask.count({
        where: {
          assignedCommunityId: sessionUserId,
          status: "CLIENT_APPROVED",
          client: {
            status: { not: "INACTIVE" },
          },
        },
      });
      return { success: true, data: count };
    }

    // Para EDITOR o cualquier otro usuario, contar tareas asignadas como editor
    // Estados válidos: IDEA, RECORDED, EDITING, REVIEW_CLIENT
    // NO incluir: CLIENT_APPROVED, APPROVED, PUBLISHED
    const validStatuses = ["IDEA", "RECORDED", "EDITING", "REVIEW_CLIENT"];
    
    const count = await db.contentTask.count({
      where: {
        assignedEditorId: sessionUserId,
        status: {
          in: validStatuses,
        },
        client: {
          status: { not: "INACTIVE" },
        },
      },
    });

    return { success: true, data: count };
  } catch (error) {
    console.error("❌ Error en getPendingTasksCount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener conteo de tareas",
    };
  }
}

/**
 * Server Action para actualizar el estado de una tarea
 * Valida el nuevo estado y actualiza en Prisma
 * Si el estado cambia a PUBLISHED, verifica el cumplimiento del contrato y crea transacción automática
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: string
): Promise<ApiResponse<ContentTask>> {
  try {
    // Validar que el status sea válido
    const validStatuses = [
      "IDEA",
      "RECORDED",
      "EDITING",
      "REVIEW_INTERNAL",
      "REVIEW_CLIENT",
      "CLIENT_APPROVED",
      "APPROVED",
      "PUBLISHED",
    ];

    if (!validStatuses.includes(newStatus)) {
      return {
        success: false,
        error: "Estado inválido",
      };
    }

    // Obtener la tarea actual para verificar si cambia a PUBLISHED y obtener el cliente
    const currentTask = await db.contentTask.findUnique({
      where: { id: taskId },
      select: { 
        status: true, 
        clientId: true, 
        assignedEditorId: true,
        assignedCommunityId: true,
        title: true,
        clientFeedback: true,
        client: {
          select: { name: true },
        },
      },
    });

    if (!currentTask) {
      return {
        success: false,
        error: "Tarea no encontrada",
      };
    }

    // Obtener sesión para notificaciones
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    const isChangingToPublished = newStatus === "PUBLISHED" && currentTask.status !== "PUBLISHED";
    const isChangingToClientApproved = newStatus === "CLIENT_APPROVED" && currentTask.status !== "CLIENT_APPROVED";
    const isChangingToEditing = newStatus === "EDITING" && currentTask.status !== "EDITING";

    // Guardar IDs previos antes de reasignar (para notificaciones)
    const previousEditorId = currentTask.assignedEditorId;
    const previousCommunityId = currentTask.assignedCommunityId;

    // Obtener el cliente para verificar editorId y communityId
    let newAssignedCommunityId: string | null | undefined = undefined;
    let newAssignedEditorId: string | null | undefined = undefined;
    let shouldUpdateAssignedAt = false;

    if (isChangingToClientApproved) {
      // AUTOMATIZACIÓN: CLIENT_APPROVED -> asignar automáticamente al Community Manager
      const cmId = await getCommunityManagerId(currentTask.clientId);
      if (cmId) {
        newAssignedCommunityId = cmId;
        shouldUpdateAssignedAt = true;
        console.log(`✅ [AUTOMATIZACIÓN] Tarea "${currentTask.title}" reasignada automáticamente al CM (${cmId})`);
      } else {
        console.warn(`⚠️ [AUTOMATIZACIÓN] No se encontró Community Manager para cliente ${currentTask.clientId}`);
      }
    } else if (isChangingToEditing) {
      // Pase de estafeta: EDITING -> reasignar al editorId
      const client = await db.client.findUnique({
        where: { id: currentTask.clientId },
        select: { editorId: true },
      });
      if (client?.editorId) {
        newAssignedEditorId = client.editorId;
        shouldUpdateAssignedAt = true;
      }
    }

    // Actualizar la tarea
    const task = await db.contentTask.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        // Si cambia a PUBLISHED, actualizar publishedAt
        ...(isChangingToPublished && { publishedAt: new Date() }),
        // Pase de estafeta: actualizar assignedCommunityId/assignedEditorId y assignedAt
        ...(newAssignedCommunityId !== undefined && {
          assignedCommunityId: newAssignedCommunityId,
        }),
        ...(newAssignedEditorId !== undefined && {
          assignedEditorId: newAssignedEditorId,
        }),
        ...(shouldUpdateAssignedAt && { assignedAt: new Date() }),
        // Log de auditoría: agregar comentario automático si cambió a CLIENT_APPROVED
        ...(isChangingToClientApproved && newAssignedCommunityId && {
          clientFeedback: currentTask.clientFeedback 
            ? `${currentTask.clientFeedback}\n\n[Automático] Estado cambiado a Aprobado Cliente. Tarea reasignada automáticamente al CM.`
            : "[Automático] Estado cambiado a Aprobado Cliente. Tarea reasignada automáticamente al CM.",
        }),
      },
    });

    // Enviar notificaciones por cambio de estado
    try {
      const statusLabels: Record<string, string> = {
        IDEA: "Idea",
        RECORDED: "Grabado",
        EDITING: "Editando",
        REVIEW_INTERNAL: "Revisión Interna",
        REVIEW_CLIENT: "Revisión Cliente",
        CLIENT_APPROVED: "Aprobado por Cliente",
        APPROVED: "Aprobado",
        PUBLISHED: "Publicado",
      };

      const statusLabel = statusLabels[newStatus] || newStatus;
      const oldStatusLabel = statusLabels[currentTask.status] || currentTask.status;

      // AUTOMATIZACIÓN: Notificaciones específicas cuando cambia a CLIENT_APPROVED
      if (isChangingToClientApproved && newAssignedCommunityId) {
        // Notificar al Community Manager
        if (newAssignedCommunityId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedCommunityId,
            message: `✅ Tarea lista para publicar: "${currentTask.title}" ha sido aprobada por el cliente y se te ha asignado.`,
            type: "ASSIGNED",
            createdBy: sessionUserId || undefined,
          });
        }

        // Notificar al Editor previo (si existe y es diferente del CM)
        if (previousEditorId && previousEditorId !== newAssignedCommunityId && previousEditorId !== sessionUserId) {
          await sendNotification({
            userId: previousEditorId,
            message: `👍 ¡Buen trabajo! Tu tarea "${currentTask.title}" ha sido aprobada por el cliente.`,
            type: "STATUS_CHANGE",
            createdBy: sessionUserId || undefined,
          });
        }
      } else {
        // Notificaciones estándar para otros cambios de estado
        // Notificar al editor asignado
        const targetEditorId = newAssignedEditorId ?? currentTask.assignedEditorId;
        if (targetEditorId && targetEditorId !== sessionUserId && currentTask.status !== newStatus) {
          await sendNotification({
            userId: targetEditorId,
            message: `La tarea "${currentTask.title}" cambió de estado: ${oldStatusLabel} → ${statusLabel}${currentTask.client ? ` (${currentTask.client.name})` : ""}`,
            type: "STATUS_CHANGE",
            createdBy: sessionUserId || undefined,
          });
        }

        // Si se reasignó la tarea, notificar al nuevo asignado
        if (newAssignedEditorId && newAssignedEditorId !== currentTask.assignedEditorId && newAssignedEditorId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedEditorId,
            message: `Se te ha asignado la tarea "${currentTask.title}"${currentTask.client ? ` para ${currentTask.client.name}` : ""}`,
            type: "ASSIGNED",
            createdBy: sessionUserId || undefined,
          });
        }
      }
    } catch (error) {
      console.error("❌ Error al enviar notificaciones de cambio de estado:", error);
      // No fallar la operación si las notificaciones fallan
    }

    // --- BLOQUE PUSHER START ---
    // Disparar evento para el Kanban
    try {
      await pusherServer.trigger('kanban-channel', 'update-event', {
        message: `Tarea ${taskId} movida a ${newStatus}`
      });
      console.log("✅ [SERVER] Evento Kanban enviado a Pusher");
    } catch (error) {
      console.error("❌ [SERVER] Error disparando a Pusher (Kanban):", error);
    }

    // Disparar eventos de actualización del dashboard para usuarios afectados
    const affectedUserIds: string[] = [];
    if (previousEditorId) {
      affectedUserIds.push(previousEditorId);
    }
    if (previousCommunityId) {
      affectedUserIds.push(previousCommunityId);
    }
    if (newAssignedEditorId) {
      affectedUserIds.push(newAssignedEditorId);
    }
    if (newAssignedCommunityId) {
      affectedUserIds.push(newAssignedCommunityId);
    }
    if (sessionUserId && !affectedUserIds.includes(sessionUserId)) {
      affectedUserIds.push(sessionUserId);
    }
    
    await triggerDashboardUpdate(affectedUserIds);
    // --- BLOQUE PUSHER END ---

    // Si cambió a PUBLISHED, verificar cumplimiento del contrato
    if (isChangingToPublished && currentTask?.clientId) {
      const { checkAndCreateAutomaticTransaction } = await import("@/lib/finance-logic");
      const result = await checkAndCreateAutomaticTransaction(currentTask.clientId);
      
      if (result.created) {
        console.log(`✅ Cobro automático creado para cliente ${currentTask.clientId}`);
      }
    }

    // Revalidar la ruta de contenido y Dashboard (por si se creó una transacción)
    revalidatePath("/content");
    revalidatePath("/content/dashboard");
    revalidatePath("/");
    revalidatePath("/finance");

    return { success: true, data: task };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar el estado de la tarea",
    };
  }
}

/**
 * Server Action para actualizar una tarea de contenido
 * Permite actualizar título, fecha, tipo y otros campos
 * Si el estado cambia a PUBLISHED, verifica el cumplimiento del contrato y crea transacción automática
 */
export async function updateTask(
  id: string,
  input: unknown
): Promise<ApiResponse<ContentTask>> {
  try {
    // Validar con Zod
    const validatedData = updateContentTaskSchema.parse(input);

    // Obtener la tarea actual ANTES de actualizar para comparar cambios
    const taskBefore = await db.contentTask.findUnique({
      where: { id },
      select: { 
        status: true, 
        clientId: true, 
        assignedEditorId: true,
        assignedCommunityId: true,
        title: true,
        clientFeedback: true,
        client: {
          select: { name: true },
        },
      },
    });

    if (!taskBefore) {
      return {
        success: false,
        error: "Tarea no encontrada",
      };
    }

    // Obtener sesión para notificaciones
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    const isChangingToPublished = 
      validatedData.status === "PUBLISHED" && 
      taskBefore.status !== "PUBLISHED";
    
    const isChangingToClientApproved = 
      validatedData.status === "CLIENT_APPROVED" && 
      taskBefore.status !== "CLIENT_APPROVED";

    // Guardar los IDs previos antes de reasignar (para notificaciones)
    const previousEditorId = taskBefore.assignedEditorId;
    const previousCommunityId = taskBefore.assignedCommunityId;

    // AUTOMATIZACIÓN: Si cambia a CLIENT_APPROVED, asignar automáticamente al CM
    let newAssignedCommunityId: string | null | undefined = undefined;
    let newAssignedEditorId: string | null | undefined = undefined;
    let shouldUpdateAssignedAt = false;

    if (isChangingToClientApproved) {
      const cmId = await getCommunityManagerId(taskBefore.clientId);
      if (cmId) {
        newAssignedCommunityId = cmId;
        shouldUpdateAssignedAt = true;
        console.log(`✅ [AUTOMATIZACIÓN] Tarea "${taskBefore.title}" reasignada automáticamente al CM (${cmId})`);
      } else {
        console.warn(`⚠️ [AUTOMATIZACIÓN] No se encontró Community Manager para cliente ${taskBefore.clientId}`);
      }
    } else {
      // Detectar si cambió el responsable manualmente
      newAssignedEditorId = validatedData.assignedEditorId !== undefined 
        ? validatedData.assignedEditorId || null 
        : taskBefore.assignedEditorId;
      newAssignedCommunityId = validatedData.assignedCommunityId !== undefined 
        ? validatedData.assignedCommunityId || null 
        : taskBefore.assignedCommunityId;
    }

    const assignedEditorIdChanged = taskBefore.assignedEditorId !== newAssignedEditorId;
    const assignedCommunityIdChanged = taskBefore.assignedCommunityId !== newAssignedCommunityId;

    // Actualizar la tarea
    const task = await db.contentTask.update({
      where: { id },
      data: {
        ...(validatedData.title && { title: validatedData.title }),
        ...(validatedData.type && { type: validatedData.type }),
        ...(validatedData.priority && { priority: validatedData.priority }),
        ...(validatedData.dueDate !== undefined && {
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        }),
        ...(validatedData.scheduledAt !== undefined && {
          scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        }),
        ...(validatedData.status && { status: validatedData.status }),
        // AUTOMATIZACIÓN: Si cambió a CLIENT_APPROVED, usar el CM asignado automáticamente
        // Si no, usar los IDs del formulario (si se proporcionaron)
        ...(isChangingToClientApproved && newAssignedCommunityId !== undefined
          ? {
              assignedCommunityId: newAssignedCommunityId,
            }
          : {}),
        ...(validatedData.assignedEditorId !== undefined && {
          assignedEditorId: validatedData.assignedEditorId || null,
        }),
        ...(validatedData.assignedCommunityId !== undefined && {
          assignedCommunityId: validatedData.assignedCommunityId || null,
        }),
        // Actualizar assignedAt si se asignó algún usuario (nuevo o cambio)
        ...((shouldUpdateAssignedAt || 
             (validatedData.assignedEditorId !== undefined && validatedData.assignedEditorId && (!taskBefore.assignedEditorId || taskBefore.assignedEditorId !== validatedData.assignedEditorId)) ||
             (validatedData.assignedCommunityId !== undefined && validatedData.assignedCommunityId && (!taskBefore.assignedCommunityId || taskBefore.assignedCommunityId !== validatedData.assignedCommunityId)))
          ? { assignedAt: new Date() }
          : {}),
        // Log de auditoría y clientFeedback
        ...(isChangingToClientApproved && newAssignedCommunityId
          ? {
              // Si cambió a CLIENT_APPROVED, agregar log de auditoría
              clientFeedback: validatedData.clientFeedback !== undefined
                ? `${validatedData.clientFeedback}\n\n[Automático] Estado cambiado a Aprobado Cliente. Tarea reasignada automáticamente al CM.`
                : taskBefore.clientFeedback
                ? `${taskBefore.clientFeedback}\n\n[Automático] Estado cambiado a Aprobado Cliente. Tarea reasignada automáticamente al CM.`
                : "[Automático] Estado cambiado a Aprobado Cliente. Tarea reasignada automáticamente al CM.",
            }
          : validatedData.clientFeedback !== undefined
          ? { clientFeedback: validatedData.clientFeedback }
          : {}),
        ...(validatedData.postCopy !== undefined && {
          postCopy: validatedData.postCopy || null,
        }),
        ...(validatedData.coverImageUrl !== undefined && {
          coverImageUrl: validatedData.coverImageUrl || null,
        }),
        ...(validatedData.audioBriefUrl !== undefined && {
          audioBriefUrl: validatedData.audioBriefUrl || null,
        }),
        // Si cambia a PUBLISHED, actualizar publishedAt
        ...(isChangingToPublished && { publishedAt: new Date() }),
      },
    });

    // Notificaciones específicas para CLIENT_APPROVED o reasignación estándar
    try {
      if (isChangingToClientApproved && newAssignedCommunityId) {
        // AUTOMATIZACIÓN: Notificaciones específicas cuando cambia a CLIENT_APPROVED
        // Notificar al Community Manager
        if (newAssignedCommunityId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedCommunityId,
            message: `✅ Tarea lista para publicar: "${taskBefore.title}" ha sido aprobada por el cliente y se te ha asignado.`,
            type: "ASSIGNED",
            createdBy: sessionUserId || undefined,
          });
        }

        // Notificar al Editor previo (si existe y es diferente del CM)
        if (previousEditorId && previousEditorId !== newAssignedCommunityId && previousEditorId !== sessionUserId) {
          await sendNotification({
            userId: previousEditorId,
            message: `👍 ¡Buen trabajo! Tu tarea "${taskBefore.title}" ha sido aprobada por el cliente.`,
            type: "STATUS_CHANGE",
            createdBy: sessionUserId || undefined,
          });
        }
      } else {
        // Notificaciones estándar para otras reasignaciones
        if (assignedEditorIdChanged && newAssignedEditorId && newAssignedEditorId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedEditorId,
            message: `Se te ha asignado la tarea como Editor: "${taskBefore.title}"${taskBefore.client ? ` para ${taskBefore.client.name}` : ""}`,
            type: "ASSIGNED",
            createdBy: sessionUserId || undefined,
          });
        }
        if (assignedCommunityIdChanged && newAssignedCommunityId && newAssignedCommunityId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedCommunityId,
            message: `Se te ha asignado la tarea como Community: "${taskBefore.title}"${taskBefore.client ? ` para ${taskBefore.client.name}` : ""}`,
            type: "ASSIGNED",
            createdBy: sessionUserId || undefined,
          });
        }
      }
    } catch (error) {
      console.error("❌ Error al enviar notificaciones:", error);
      // No fallar la operación si las notificaciones fallan
    }

    // Si cambió a PUBLISHED, verificar cumplimiento del contrato
    if (isChangingToPublished && taskBefore.clientId) {
      const { checkAndCreateAutomaticTransaction } = await import("@/lib/finance-logic");
      const result = await checkAndCreateAutomaticTransaction(taskBefore.clientId);
      
      if (result.created) {
        console.log(`✅ Cobro automático creado para cliente ${taskBefore.clientId}`);
      }
    }

    // Revalidar la ruta de contenido, Dashboard y Finanzas (por si se creó una transacción)
    revalidatePath("/content");
    revalidatePath("/content/dashboard");
    revalidatePath("/");
    revalidatePath("/finance");

    // Disparar eventos de Pusher para actualización en tiempo real
    // Disparar evento para el Kanban
    try {
      await pusherServer.trigger("kanban-channel", "update-event", {
        message: "refresh",
        taskId: task.id,
        action: "task_updated",
        timestamp: new Date().toISOString(),
      });
      console.log("✅ Evento Kanban enviado correctamente");
    } catch (pusherError) {
      console.error("❌ Error al enviar evento de Pusher (Kanban):", pusherError);
      // No fallar la operación si Pusher falla
    }

    // Disparar eventos de actualización del dashboard para usuarios afectados
    const affectedUserIds: string[] = [];
    if (previousEditorId) {
      affectedUserIds.push(previousEditorId);
    }
    if (previousCommunityId) {
      affectedUserIds.push(previousCommunityId);
    }
    if (newAssignedEditorId) {
      affectedUserIds.push(newAssignedEditorId);
    }
    if (newAssignedCommunityId) {
      affectedUserIds.push(newAssignedCommunityId);
    }
    if (sessionUserId && !affectedUserIds.includes(sessionUserId)) {
      affectedUserIds.push(sessionUserId);
    }
    
    await triggerDashboardUpdate(affectedUserIds);

    return { success: true, data: task };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar tarea",
    };
  }
}

/**
 * Server Action para publicar una tarea rápidamente (Quick Publish)
 * Actualiza el estado a PUBLISHED y establece publishedAt
 * Retorna el resultado para manejo de UI (animaciones, confetti)
 */
export async function quickPublishTask(taskId: string): Promise<ApiResponse<ContentTask>> {
  try {
    // 1. Verificar que la tarea existe y obtener información previa
    const task = await db.contentTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        status: true,
        clientId: true,
        assignedEditorId: true,
        assignedCommunityId: true,
        client: {
          select: { name: true },
        },
      },
    });

    if (!task) {
      return {
        success: false,
        error: "Tarea no encontrada",
      };
    }

    // 2. Verificar si ya está publicada
    if (task.status === "PUBLISHED") {
      return {
        success: false,
        error: "Esta tarea ya está publicada",
      };
    }

    // 3. Obtener sesión para auditoría
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    // 4. Actualizar la tarea a PUBLISHED
    const updatedTask = await db.contentTask.update({
      where: { id: taskId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    // 5. Notificar al editor y community manager
    try {
      const affectedUserIds: string[] = [];
      
      if (task.assignedEditorId && task.assignedEditorId !== sessionUserId) {
        affectedUserIds.push(task.assignedEditorId);
        await sendNotification({
          userId: task.assignedEditorId,
          message: `🚀 ¡Publicado! La tarea "${task.title}" ha sido publicada exitosamente.`,
          type: "STATUS_CHANGE",
          createdBy: sessionUserId || undefined,
        });
      }

      if (task.assignedCommunityId && task.assignedCommunityId !== sessionUserId) {
        affectedUserIds.push(task.assignedCommunityId);
        await sendNotification({
          userId: task.assignedCommunityId,
          message: `🚀 ¡Publicado! La tarea "${task.title}" ha sido publicada exitosamente.`,
          type: "STATUS_CHANGE",
          createdBy: sessionUserId || undefined,
        });
      }

      // Disparar eventos de actualización del dashboard
      if (affectedUserIds.length > 0) {
        await triggerDashboardUpdate(affectedUserIds);
      }
    } catch (notificationError) {
      console.error("❌ Error al enviar notificaciones:", notificationError);
    }

    // 6. Verificar cumplimiento del contrato y crear transacción automática
    try {
      const { checkAndCreateAutomaticTransaction } = await import("@/lib/finance-logic");
      const result = await checkAndCreateAutomaticTransaction(task.clientId);
      
      if (result.created) {
        console.log(`✅ Cobro automático creado para cliente ${task.clientId}`);
      }
    } catch (financeError) {
      console.error("❌ Error en lógica financiera:", financeError);
    }

    // 7. Revalidar rutas
    revalidatePath("/content");
    revalidatePath("/content/dashboard");
    revalidatePath("/");
    revalidatePath("/finance");

    // 8. Disparar evento de Pusher para actualización en tiempo real
    try {
      await pusherServer.trigger("kanban-channel", "update-event", {
        message: `Tarea "${task.title}" publicada rápidamente`,
        taskId: taskId,
        action: "quick_published",
        timestamp: new Date().toISOString(),
      });
      console.log("✅ Evento Quick Publish enviado a Pusher");
    } catch (pusherError) {
      console.error("❌ Error al enviar evento Pusher:", pusherError);
    }

    return { success: true, data: updatedTask };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al publicar tarea",
    };
  }
}

/**
 * Server Action para eliminar una tarea de contenido
 */
export async function deleteTask(id: string): Promise<ApiResponse<void>> {
  try {
    await db.contentTask.delete({
      where: { id },
    });

    // Revalidar las rutas
    revalidatePath("/content");
    revalidatePath("/"); // Dashboard para actualizar contadores

    // Disparar evento de Pusher para actualización en tiempo real
    try {
      console.log("🚀 Enviando evento Pusher: deleteTask");
      await pusherServer.trigger("kanban-channel", "update-event", {
        message: "refresh",
        taskId: id,
        action: "task_deleted",
        timestamp: new Date().toISOString(),
      });
      console.log("✅ Evento Pusher enviado correctamente");
    } catch (pusherError) {
      console.error("❌ Error al enviar evento de Pusher:", pusherError);
      // No fallar la operación si Pusher falla
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al eliminar tarea",
    };
  }
}

/**
 * Obtiene la configuración de métricas habilitadas para un cliente
 * Retorna un array con los nombres de los campos de métricas que el cliente tiene configurados
 * Si no hay configuración, retorna todas las métricas por defecto
 */
export async function getEnabledMetricsForClient(clientId: string): Promise<string[]> {
  try {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { metricsConfig: true },
    });

    if (!client?.metricsConfig) {
      // Si no hay configuración, retornar todas las métricas por defecto
      return [
        "metaViews", "metaLikes", "metaShares", "metaComments", "metaSaves", "metaReach",
        "ttViews", "ttLikes", "ttShares", "ttComments", "ttSaves",
        "totalBudgetSpent", "notes",
        "conversions", "salesCount", "revenue", "conversionSource"
      ];
    }

    try {
      const config = JSON.parse(client.metricsConfig);
      return config.enabledMetrics || [];
    } catch {
      return [];
    }
  } catch (error) {
    console.error("❌ Error al obtener configuración de métricas:", error);
    return [];
  }
}

/**
 * Server Action para obtener las métricas de una tarea junto con la configuración del cliente
 */
export async function getTaskMetrics(
  taskId: string
): Promise<ApiResponse<{ metrics: TaskMetrics | null; enabledMetrics: string[]; clientId: string } | null>> {
  try {
    // Obtener la tarea para saber a qué cliente pertenece
    const task = await db.contentTask.findUnique({
      where: { id: taskId },
      select: { clientId: true },
    });

    if (!task) {
      return { success: true, data: null };
    }

    // Obtener las métricas de la tarea
    const metrics = await db.taskMetrics.findUnique({
      where: { taskId },
    });

    // Obtener las métricas habilitadas para el cliente
    const enabledMetrics = await getEnabledMetricsForClient(task.clientId);

    return { 
      success: true, 
      data: {
        metrics,
        enabledMetrics,
        clientId: task.clientId
      }
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener métricas",
    };
  }
}

/**
 * Server Action para actualizar o crear métricas de una tarea
 * Valida permisos: EDITOR solo puede editar métricas de sus tareas asignadas
 * Soporta tanto formato estático (campos fijos) como dinámico (basado en configuración del cliente)
 */
export async function updateTaskMetrics(
  input: unknown
): Promise<ApiResponse<TaskMetrics>> {
  try {
    // 1. Obtener sesión y verificar permisos primero
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const userRole = session?.user?.role;

    if (!sessionUserId) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    // 2. Intentar validar como formato dinámico primero
    let validatedData: any;
    let isDynamicFormat = false;
    
    try {
      const dynamicData = dynamicTaskMetricsSchema.parse(input);
      validatedData = dynamicData;
      isDynamicFormat = true;
    } catch (dynamicError) {
      // Si falla, intentar con el formato estático tradicional
      validatedData = updateTaskMetricsSchema.parse(input);
    }

    // 3. Verificar que la tarea existe y obtener información
    const task = await db.contentTask.findUnique({
      where: { id: validatedData.taskId },
      select: {
        id: true,
        assignedEditorId: true,
        assignedCommunityId: true,
        clientId: true,
      },
    });

    if (!task) {
      return {
        success: false,
        error: "Tarea no encontrada",
      };
    }

    // 4. Validar permisos: EDITOR solo puede editar métricas de sus tareas asignadas (como editor o community)
    if (userRole === "EDITOR") {
      const isAssignedAsEditor = task.assignedEditorId === sessionUserId;
      const isAssignedAsCommunity = task.assignedCommunityId === sessionUserId;
      if (!isAssignedAsEditor && !isAssignedAsCommunity) {
        return {
          success: false,
          error: "No tienes permisos para editar las métricas de esta tarea",
        };
      }
    }
    // ADMIN puede editar cualquier tarea

    // 5. Preparar datos para upsert
    let metricsData: any = { taskId: validatedData.taskId };

    if (isDynamicFormat) {
      // Formato dinámico: procesar el objeto de métricas
      const metrics = validatedData.metrics;
      
      // Mapear métricas dinámicas al formato del modelo TaskMetrics
      metricsData = {
        taskId: validatedData.taskId,
        metaViews: metrics.metaViews ?? 0,
        metaLikes: metrics.metaLikes ?? 0,
        metaShares: metrics.metaShares ?? 0,
        metaComments: metrics.metaComments ?? 0,
        metaSaves: metrics.metaSaves ?? 0,
        metaReach: metrics.metaReach ?? 0,
        ttViews: metrics.ttViews ?? 0,
        ttLikes: metrics.ttLikes ?? 0,
        ttShares: metrics.ttShares ?? 0,
        ttComments: metrics.ttComments ?? 0,
        ttSaves: metrics.ttSaves ?? 0,
        totalBudgetSpent: metrics.totalBudgetSpent ?? null,
        notes: metrics.notes ?? null,
        conversions: metrics.conversions ?? 0,
        salesCount: metrics.salesCount ?? 0,
        revenue: metrics.revenue ?? 0.0,
        conversionSource: metrics.conversionSource ?? null,
      };
    } else {
      // Formato estático tradicional
      metricsData = {
        taskId: validatedData.taskId,
        metaViews: validatedData.metaViews,
        metaLikes: validatedData.metaLikes,
        metaShares: validatedData.metaShares,
        metaComments: validatedData.metaComments,
        metaSaves: validatedData.metaSaves,
        metaReach: validatedData.metaReach,
        ttViews: validatedData.ttViews,
        ttLikes: validatedData.ttLikes,
        ttShares: validatedData.ttShares,
        ttComments: validatedData.ttComments,
        ttSaves: validatedData.ttSaves,
        totalBudgetSpent: validatedData.totalBudgetSpent,
        notes: validatedData.notes,
        conversions: validatedData.conversions,
        salesCount: validatedData.salesCount,
        revenue: validatedData.revenue,
        conversionSource: validatedData.conversionSource,
      };
    }

    // 6. Calcular todos los KPIs avanzados
    // ER Meta: ((Likes + Comments + Shares + Saves) / Reach) * 100
    const metaTotalEngagement = metricsData.metaLikes + metricsData.metaComments + metricsData.metaShares + metricsData.metaSaves;
    const erMeta = metricsData.metaReach > 0 ? (metaTotalEngagement / metricsData.metaReach) * 100 : 0;

    // ER TikTok: ((Likes + Comments + Shares + Saves) / Views) * 100
    const ttTotalEngagement = metricsData.ttLikes + metricsData.ttComments + metricsData.ttShares + metricsData.ttSaves;
    const erTikTok = metricsData.ttViews > 0 ? (ttTotalEngagement / metricsData.ttViews) * 100 : 0;

    // Total Brand Awareness: Reach Meta + Views TikTok
    const totalBrandAwareness = metricsData.metaReach + metricsData.ttViews;

    // Global Social Proof: Suma total de Likes y Comentarios
    const globalSocialProof = metricsData.metaLikes + metricsData.metaComments + metricsData.ttLikes + metricsData.ttComments;

    // Virality Index: (Total Shares / Total Views) * 100
    const totalShares = metricsData.metaShares + metricsData.ttShares;
    const totalViews = metricsData.metaViews + metricsData.ttViews;
    const viralityIndex = totalViews > 0 ? (totalShares / totalViews) * 100 : 0;

    // Efficiency Score: Promedio ponderado (60% Meta, 40% TikTok)
    const efficiencyScore = erMeta > 0 && erTikTok > 0
      ? erMeta * 0.6 + erTikTok * 0.4
      : erMeta > 0 ? erMeta : erTikTok;

    // 7. Actualizar o crear métricas (upsert)
    const metrics = await db.taskMetrics.upsert({
      where: { taskId: metricsData.taskId },
      update: {
        ...metricsData,
        erMeta,
        erTikTok,
        totalBrandAwareness,
        globalSocialProof,
        viralityIndex,
        efficiencyScore,
        cpa: metricsData.totalBudgetSpent && metricsData.salesCount > 0
          ? metricsData.totalBudgetSpent / metricsData.salesCount
          : 0,
        roas: metricsData.totalBudgetSpent && metricsData.totalBudgetSpent > 0
          ? metricsData.revenue / metricsData.totalBudgetSpent
          : 0,
        conversionRate: (metricsData.metaReach + metricsData.ttViews) > 0
          ? (metricsData.conversions / (metricsData.metaReach + metricsData.ttViews)) * 100
          : 0,
      },
      create: {
        ...metricsData,
        erMeta,
        erTikTok,
        totalBrandAwareness,
        globalSocialProof,
        viralityIndex,
        efficiencyScore,
        cpa: metricsData.totalBudgetSpent && metricsData.salesCount > 0
          ? metricsData.totalBudgetSpent / metricsData.salesCount
          : 0,
        roas: metricsData.totalBudgetSpent && metricsData.totalBudgetSpent > 0
          ? metricsData.revenue / metricsData.totalBudgetSpent
          : 0,
        conversionRate: (metricsData.metaReach + metricsData.ttViews) > 0
          ? (metricsData.conversions / (metricsData.metaReach + metricsData.ttViews)) * 100
          : 0,
      },
    });

    // 8. Revalidar rutas
    revalidatePath("/content");
    revalidatePath("/content/dashboard");
    revalidatePath(`/clients/${task.clientId}`);

    return { success: true, data: metrics };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar métricas",
    };
  }
}

