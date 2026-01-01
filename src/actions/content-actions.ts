"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { createContentTaskSchema, updateContentTaskSchema, updateTaskMetricsSchema } from "@/schemas/content";
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
      where: { role: "ADMIN" },
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

/**
 * Server Action para crear una tarea de contenido
 * Valida con Zod, guarda en Prisma y revalida la ruta
 */
export async function createTask(
  input: unknown
): Promise<ApiResponse<ContentTask>> {
  try {
    // 1. Validar con Zod
    const validatedData = createContentTaskSchema.parse(input);

    // 2. Obtener el cliente para verificar si tiene editorId asignado
    const client = await db.client.findUnique({
      where: { id: validatedData.clientId },
      select: { editorId: true },
    });

    // 3. Si no se especifica assignedToId pero el cliente tiene editorId, asignar automáticamente
    const assignedToId = validatedData.assignedToId ?? client?.editorId ?? null;

    // 4. Operación de DB
    const task = await db.contentTask.create({
      data: {
        title: validatedData.title,
        type: validatedData.type,
        status: validatedData.status ?? "IDEA", // Default a IDEA si no se proporciona
        dueDate: validatedData.dueDate ?? null,
        scheduledAt: validatedData.scheduledAt ?? null,
        clientId: validatedData.clientId,
        assignedToId: assignedToId,
        assignedAt: assignedToId ? new Date() : null, // Marcar fecha de asignación si se asigna al crear
        shootId: validatedData.shootId ?? null,
        // Campos opcionales que no se incluyen en el formulario inicial
        reviewToken: validatedData.reviewToken ?? null,
        clientFeedback: validatedData.clientFeedback ?? null,
        publishedAt: validatedData.publishedAt ?? null,
        // Recursos creativos
        postCopy: validatedData.postCopy ?? null,
        coverImageUrl: validatedData.coverImageUrl ?? null,
        audioBriefUrl: validatedData.audioBriefUrl ?? null,
      },
    });

    // 3. Obtener sesión para notificaciones
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    // 4. Enviar notificación si se asignó a alguien
    if (assignedToId && assignedToId !== sessionUserId) {
      try {
        // Obtener información del cliente para el mensaje
        const clientInfo = await db.client.findUnique({
          where: { id: validatedData.clientId },
          select: { name: true },
        });

        await sendNotification({
          userId: assignedToId,
          message: `Se te ha asignado una nueva tarea: "${task.title}"${clientInfo ? ` para ${clientInfo.name}` : ""}`,
          type: "ASSIGNED",
          createdBy: sessionUserId || undefined,
        });
      } catch (error) {
        console.error("❌ Error al enviar notificación de asignación:", error);
        // No fallar la operación si la notificación falla
      }
    }

    // 5. Revalidar las rutas
    revalidatePath("/content");
    revalidatePath("/content/dashboard");
    revalidatePath("/"); // Dashboard para actualizar contadores

    // 6. Disparar eventos de Pusher para actualización en tiempo real
    // Disparar evento para el Kanban
    try {
      await pusherServer.trigger('kanban-channel', 'update-event', {
        message: 'refresh',
        taskId: task.id,
        action: 'created',
        timestamp: new Date().toISOString(),
      });
      console.log("✅ Evento Kanban enviado a Pusher correctamente");
    } catch (error) {
      console.error("❌ ERROR CRÍTICO AL ENVIAR A PUSHER (Kanban):", error);
      // No fallar la operación si Pusher falla
    }

    // Disparar evento para actualizar dashboards de usuarios afectados
    // Incluir al usuario asignado (si existe) y siempre al usuario que creó la tarea
    const affectedUserIds: string[] = [];
    if (assignedToId) {
      affectedUserIds.push(assignedToId);
    }
    // Siempre incluir al usuario que creó la tarea para actualizar su contador de tareas pendientes
    if (sessionUserId) {
      affectedUserIds.push(sessionUserId);
    }

    await triggerDashboardUpdate(affectedUserIds);

    // 7. Retornar éxito
    return { success: true, data: task };
  } catch (error) {
    // 5. Manejar errores
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear tarea",
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

    // Si es EDITOR, siempre filtrar solo sus tareas asignadas
    // Si es ADMIN y showOnlyMine es true, filtrar solo sus tareas
    // Si es ADMIN y showOnlyMine es false o undefined, mostrar todas
    const whereClause = 
      (userRole === "EDITOR" && sessionUserId) || 
      (userRole === "ADMIN" && showOnlyMine && sessionUserId)
        ? { assignedToId: sessionUserId }
        : {};

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
 * Retorna el conteo de tareas asignadas al usuario (assignedToId === session.user.id)
 * Solo cuenta tareas con estado operativo (no PUBLISHED)
 */
export async function getPendingTasksCount(): Promise<ApiResponse<number>> {
  try {
    // Obtener sesión directamente
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    // Log crítico de depuración
    console.log("🔍 ID SESION:", sessionUserId);
    console.log("🔍 Session completa:", JSON.stringify(session?.user, null, 2));

    // Si no hay userId en la sesión, retornar 0
    if (!sessionUserId) {
      console.log("📊 No hay userId en la sesión, retornando 0");
      return { success: true, data: 0 };
    }

    // Obtener todas las tareas del usuario para depuración
    const allUserTasks = await db.contentTask.findMany({
      where: {
        assignedToId: sessionUserId,
      },
      select: {
        id: true,
        title: true,
        assignedToId: true,
        status: true,
      },
    });

    console.log("📊 TODAS las tareas asignadas al usuario:", allUserTasks);
    console.log("📊 Total de tareas asignadas:", allUserTasks.length);

    // Filtrar tareas por estados válidos
    const validStatuses = ["IDEA", "RECORDED", "EDITING", "REVIEW_INTERNAL", "REVIEW_CLIENT", "CLIENT_APPROVED", "APPROVED"];
    const pendingTasks = allUserTasks.filter(task => validStatuses.includes(task.status));
    
    console.log("📊 Tareas con estados válidos:", pendingTasks);
    console.log("📊 Estados de las tareas:", allUserTasks.map(t => ({ title: t.title, status: t.status })));

    // Contar solo tareas asignadas al usuario actual con estados válidos
    const count = await db.contentTask.count({
      where: {
        assignedToId: sessionUserId,
        status: {
          in: validStatuses,
        },
      },
    });

    console.log("📊 Conteo final de tareas pendientes:", count);
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
        assignedToId: true,
        title: true,
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

    // Guardar el editor previo antes de reasignar (para notificaciones)
    const previousEditorId = currentTask.assignedToId;

    // Obtener el cliente para verificar editorId y communityId
    let newAssignedToId: string | null | undefined = undefined;
    let shouldUpdateAssignedAt = false;

    if (isChangingToClientApproved) {
      // AUTOMATIZACIÓN: CLIENT_APPROVED -> asignar automáticamente al Community Manager
      const cmId = await getCommunityManagerId(currentTask.clientId);
      if (cmId) {
        newAssignedToId = cmId;
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
        newAssignedToId = client.editorId;
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
        // Pase de estafeta: actualizar assignedToId y assignedAt
        ...(newAssignedToId !== undefined && {
          assignedToId: newAssignedToId,
          assignedAt: shouldUpdateAssignedAt ? new Date() : undefined,
        }),
        // Log de auditoría: agregar comentario automático si cambió a CLIENT_APPROVED
        ...(isChangingToClientApproved && newAssignedToId && {
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
      if (isChangingToClientApproved && newAssignedToId) {
        // Notificar al Community Manager
        if (newAssignedToId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedToId,
            message: `✅ Tarea lista para publicar: "${currentTask.title}" ha sido aprobada por el cliente y se te ha asignado.`,
            type: "ASSIGNED",
            createdBy: sessionUserId || undefined,
          });
        }

        // Notificar al Editor previo (si existe y es diferente del CM)
        if (previousEditorId && previousEditorId !== newAssignedToId && previousEditorId !== sessionUserId) {
          await sendNotification({
            userId: previousEditorId,
            message: `👍 ¡Buen trabajo! Tu tarea "${currentTask.title}" ha sido aprobada por el cliente.`,
            type: "STATUS_CHANGE",
            createdBy: sessionUserId || undefined,
          });
        }
      } else {
        // Notificaciones estándar para otros cambios de estado
        const targetUserId = newAssignedToId || currentTask.assignedToId;
        
        if (targetUserId && targetUserId !== sessionUserId && currentTask.status !== newStatus) {
          await sendNotification({
            userId: targetUserId,
            message: `La tarea "${currentTask.title}" cambió de estado: ${oldStatusLabel} → ${statusLabel}${currentTask.client ? ` (${currentTask.client.name})` : ""}`,
            type: "STATUS_CHANGE",
            createdBy: sessionUserId || undefined,
          });
        }

        // Si se reasignó la tarea, notificar al nuevo asignado
        if (newAssignedToId && newAssignedToId !== currentTask.assignedToId && newAssignedToId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedToId,
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
    if (newAssignedToId) {
      affectedUserIds.push(newAssignedToId);
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
        assignedToId: true,
        title: true,
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

    // Guardar el editor previo antes de reasignar (para notificaciones)
    const previousEditorId = taskBefore.assignedToId;

    // AUTOMATIZACIÓN: Si cambia a CLIENT_APPROVED, asignar automáticamente al CM
    let newAssignedToId: string | null | undefined = undefined;
    let shouldUpdateAssignedAt = false;

    if (isChangingToClientApproved) {
      const cmId = await getCommunityManagerId(taskBefore.clientId);
      if (cmId) {
        newAssignedToId = cmId;
        shouldUpdateAssignedAt = true;
        console.log(`✅ [AUTOMATIZACIÓN] Tarea "${taskBefore.title}" reasignada automáticamente al CM (${cmId})`);
      } else {
        console.warn(`⚠️ [AUTOMATIZACIÓN] No se encontró Community Manager para cliente ${taskBefore.clientId}`);
      }
    } else {
      // Detectar si cambió el responsable manualmente (assignedToId)
      newAssignedToId = validatedData.assignedToId !== undefined 
        ? validatedData.assignedToId || null 
        : taskBefore.assignedToId;
    }

    const assignedToIdChanged = taskBefore.assignedToId !== newAssignedToId;

    // Actualizar la tarea
    const task = await db.contentTask.update({
      where: { id },
      data: {
        ...(validatedData.title && { title: validatedData.title }),
        ...(validatedData.type && { type: validatedData.type }),
        ...(validatedData.dueDate !== undefined && {
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        }),
        ...(validatedData.scheduledAt !== undefined && {
          scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        }),
        ...(validatedData.status && { status: validatedData.status }),
        // AUTOMATIZACIÓN: Si cambió a CLIENT_APPROVED, usar el CM asignado automáticamente
        // Si no, usar el assignedToId del formulario (si se proporcionó)
        ...(isChangingToClientApproved && newAssignedToId !== undefined
          ? {
              assignedToId: newAssignedToId,
              assignedAt: shouldUpdateAssignedAt ? new Date() : undefined,
            }
          : validatedData.assignedToId !== undefined
          ? {
              assignedToId: validatedData.assignedToId || null,
              // Si se asigna una tarea (antes no tenía assignedToId o cambió), marcar assignedAt
              assignedAt: 
                validatedData.assignedToId && 
                (!taskBefore.assignedToId || taskBefore.assignedToId !== validatedData.assignedToId)
                  ? new Date()
                  : validatedData.assignedToId === null 
                    ? null 
                    : undefined, // Mantener el valor actual si no cambia
            }
          : {}),
        // Log de auditoría y clientFeedback
        ...(isChangingToClientApproved && newAssignedToId
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
      if (isChangingToClientApproved && newAssignedToId) {
        // AUTOMATIZACIÓN: Notificaciones específicas cuando cambia a CLIENT_APPROVED
        // Notificar al Community Manager
        if (newAssignedToId !== sessionUserId) {
          await sendNotification({
            userId: newAssignedToId,
            message: `✅ Tarea lista para publicar: "${taskBefore.title}" ha sido aprobada por el cliente y se te ha asignado.`,
            type: "ASSIGNED",
            createdBy: sessionUserId || undefined,
          });
        }

        // Notificar al Editor previo (si existe y es diferente del CM)
        if (previousEditorId && previousEditorId !== newAssignedToId && previousEditorId !== sessionUserId) {
          await sendNotification({
            userId: previousEditorId,
            message: `👍 ¡Buen trabajo! Tu tarea "${taskBefore.title}" ha sido aprobada por el cliente.`,
            type: "STATUS_CHANGE",
            createdBy: sessionUserId || undefined,
          });
        }
      } else if (assignedToIdChanged && newAssignedToId && newAssignedToId !== sessionUserId) {
        // Notificación estándar para otras reasignaciones
        await sendNotification({
          userId: newAssignedToId,
          message: `Se te ha reasignado la tarea: "${taskBefore.title}"${taskBefore.client ? ` para ${taskBefore.client.name}` : ""}`,
          type: "ASSIGNED",
          createdBy: sessionUserId || undefined,
        });
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
    if (newAssignedToId) {
      affectedUserIds.push(newAssignedToId);
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
 * Server Action para obtener las métricas de una tarea
 */
export async function getTaskMetrics(
  taskId: string
): Promise<ApiResponse<TaskMetrics | null>> {
  try {
    const metrics = await db.taskMetrics.findUnique({
      where: { taskId },
    });

    return { success: true, data: metrics };
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
 */
export async function updateTaskMetrics(
  input: unknown
): Promise<ApiResponse<TaskMetrics>> {
  try {
    // 1. Validar con Zod
    const validatedData = updateTaskMetricsSchema.parse(input);

    // 2. Obtener sesión y verificar permisos
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

    // 3. Verificar que la tarea existe y obtener información
    const task = await db.contentTask.findUnique({
      where: { id: validatedData.taskId },
      select: {
        id: true,
        assignedToId: true,
      },
    });

    if (!task) {
      return {
        success: false,
        error: "Tarea no encontrada",
      };
    }

    // 4. Validar permisos: EDITOR solo puede editar métricas de sus tareas asignadas
    if (userRole === "EDITOR") {
      if (task.assignedToId !== sessionUserId) {
        return {
          success: false,
          error: "No tienes permisos para editar las métricas de esta tarea",
        };
      }
    }
    // ADMIN puede editar cualquier tarea

    // 5. Calcular todos los KPIs avanzados
    // ER Meta: ((Likes + Comments + Shares + Saves) / Reach) * 100
    const metaTotalEngagement = validatedData.metaLikes + validatedData.metaComments + validatedData.metaShares + validatedData.metaSaves;
    const erMeta = validatedData.metaReach > 0 ? (metaTotalEngagement / validatedData.metaReach) * 100 : 0;

    // ER TikTok: ((Likes + Comments + Shares + Saves) / Views) * 100
    const ttTotalEngagement = validatedData.ttLikes + validatedData.ttComments + validatedData.ttShares + validatedData.ttSaves;
    const erTikTok = validatedData.ttViews > 0 ? (ttTotalEngagement / validatedData.ttViews) * 100 : 0;

    // Total Brand Awareness: Reach Meta + Views TikTok
    const totalBrandAwareness = validatedData.metaReach + validatedData.ttViews;

    // Global Social Proof: Suma total de Likes y Comentarios
    const globalSocialProof = validatedData.metaLikes + validatedData.metaComments + validatedData.ttLikes + validatedData.ttComments;

    // Virality Index: (Total Shares / Total Views) * 100
    const totalShares = validatedData.metaShares + validatedData.ttShares;
    const totalViews = validatedData.metaViews + validatedData.ttViews;
    const viralityIndex = totalViews > 0 ? (totalShares / totalViews) * 100 : 0;

    // Efficiency Score: Promedio ponderado (60% Meta, 40% TikTok)
    const efficiencyScore = erMeta > 0 && erTikTok > 0
      ? erMeta * 0.6 + erTikTok * 0.4
      : erMeta > 0 ? erMeta : erTikTok;

    // 6. Actualizar o crear métricas (upsert)
    const metrics = await db.taskMetrics.upsert({
      where: { taskId: validatedData.taskId },
      update: {
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
        erMeta,
        erTikTok,
        totalBrandAwareness,
        globalSocialProof,
        viralityIndex,
        efficiencyScore,
        cpa: validatedData.totalBudgetSpent && validatedData.salesCount > 0
          ? validatedData.totalBudgetSpent / validatedData.salesCount
          : 0,
        roas: validatedData.totalBudgetSpent && validatedData.totalBudgetSpent > 0
          ? validatedData.revenue / validatedData.totalBudgetSpent
          : 0,
        conversionRate: (validatedData.metaReach + validatedData.ttViews) > 0
          ? (validatedData.conversions / (validatedData.metaReach + validatedData.ttViews)) * 100
          : 0,
      },
      create: {
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
        erMeta,
        erTikTok,
        totalBrandAwareness,
        globalSocialProof,
        viralityIndex,
        efficiencyScore,
        cpa: validatedData.totalBudgetSpent && validatedData.salesCount > 0
          ? validatedData.totalBudgetSpent / validatedData.salesCount
          : 0,
        roas: validatedData.totalBudgetSpent && validatedData.totalBudgetSpent > 0
          ? validatedData.revenue / validatedData.totalBudgetSpent
          : 0,
        conversionRate: (validatedData.metaReach + validatedData.ttViews) > 0
          ? (validatedData.conversions / (validatedData.metaReach + validatedData.ttViews)) * 100
          : 0,
      },
    });

    // 7. Revalidar rutas
    revalidatePath("/content");
    revalidatePath("/content/dashboard");
    revalidatePath(`/clients/${task.id}`);

    return { success: true, data: metrics };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar métricas",
    };
  }
}

