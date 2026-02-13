"use server";

/**
 * Shooting Actions
 * Server Actions para operaciones de rodajes
 * 
 * @fileoverview Orquestación de servicios para rodajes.
 * Delegando lógica a:
 * - shooting-validation.ts (validaciones)
 * - shooting-service.ts (CRUD)
 * - shooting-calendar.ts (Google Calendar)
 * - shooting-notifications.ts (notificaciones)
 */

import { revalidatePath } from "next/cache";
import type { ApiResponse } from "@/types";

// Servicios
import {
  validateCreateShooting,
  validateUpdateShooting,
  validateShootingExists,
} from "@/lib/shooting-validation";
import {
  createShootingInDb,
  updateShootingInDb,
  getShootingByIdFromDb,
  getShootingsFromDb,
  cancelShootingInDb,
  deleteShootingFromDb,
  getUpcomingShootingsFromDb,
  type ShootWithRelations,
  type CreateShootingData,
  type UpdateShootingData,
} from "@/lib/shooting-service";
import {
  syncShootingToCalendar,
  deleteCalendarEvent,
} from "@/lib/shooting-calendar";
import {
  notifyCrewNewShooting,
  notifyAdminsNewShooting,
  sendShootingReminders,
} from "@/lib/shooting-notifications";

// NOTE: Import ShootWithRelations directly from "@/lib/shooting-service" in consumers
// Types cannot be re-exported from "use server" files in Next.js 15

export interface CreateShootingInput {
  title: string;
  startTime: Date;
  endTime: Date;
  address?: string;
  mapLink?: string;
  scriptUrl?: string;
  audioBriefUrl?: string;
  notes?: string;
  clientId: string;
  crewIds: string[];
  taskIds: string[];
  createCalendarEvent?: boolean;
}

export interface UpdateShootingInput {
  id: string;
  title?: string;
  startTime?: Date;
  endTime?: Date;
  address?: string;
  mapLink?: string;
  scriptUrl?: string;
  audioBriefUrl?: string;
  notes?: string;
  clientId?: string;
  crewIds?: string[];
  taskIds?: string[];
  status?: "SCHEDULED" | "COMPLETED" | "CANCELED";
  createCalendarEvent?: boolean;
}

// ==================== HELPERS ====================

async function getAuthenticatedUserId(): Promise<string | null> {
  const { auth } = await import("@/auth");
  const session = await auth();
  return session?.user?.id ?? null;
}

function revalidateShootingPaths() {
  revalidatePath("/content/shoots");
  revalidatePath("/content");
  revalidatePath("/content/dashboard");
}

// ==================== ACTIONS ====================

/**
 * Crea un nuevo rodaje
 */
export async function createShooting(
  input: CreateShootingInput
): Promise<ApiResponse<ShootWithRelations>> {
  try {
    const sessionUserId = await getAuthenticatedUserId();
    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // 1. Validar
    const validation = await validateCreateShooting({
      startTime: input.startTime,
      endTime: input.endTime,
      clientId: input.clientId,
    });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 2. Crear en BD
    const createData: CreateShootingData = {
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      address: input.address ?? null,
      mapLink: input.mapLink ?? null,
      scriptUrl: input.scriptUrl ?? null,
      audioBriefUrl: input.audioBriefUrl ?? null,
      notes: input.notes ?? null,
      clientId: input.clientId,
      crewIds: input.crewIds,
      taskIds: input.taskIds,
    };
    let shooting = await createShootingInDb(createData);

    // 3. Sincronizar con Google Calendar (opcional)
    let calendarError: string | null = null;
    if (input.createCalendarEvent !== false) {
      const calResult = await syncShootingToCalendar(sessionUserId, {
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        address: input.address,
        mapLink: input.mapLink,
        notes: input.notes,
        clientId: input.clientId,
        crewIds: input.crewIds,
      });

      if (calResult.success && calResult.eventId) {
        shooting = await updateShootingInDb(shooting.id, {
          googleEventId: calResult.eventId,
          googleEventLink: calResult.eventLink,
        });
      } else if (calResult.error) {
        calendarError = calResult.error;
      }
    }

    // 4. Notificar
    await notifyCrewNewShooting({
      shootingTitle: input.title,
      crewIds: input.crewIds,
      startTime: input.startTime,
      createdBy: sessionUserId,
    });

    await notifyAdminsNewShooting({
      shootingTitle: input.title,
      clientName: validation.client!.name,
      startTime: input.startTime,
      createdBy: sessionUserId,
    });

    // 5. Revalidar rutas
    revalidateShootingPaths();

    return { 
      success: true, 
      data: shooting, 
      calendarError 
    } as ApiResponse<ShootWithRelations> & { calendarError: string | null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear el rodaje",
    };
  }
}

/**
 * Actualiza un rodaje existente
 */
export async function updateShooting(
  input: UpdateShootingInput
): Promise<ApiResponse<ShootWithRelations>> {
  try {
    const sessionUserId = await getAuthenticatedUserId();
    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // 1. Verificar que existe
    const existing = await getShootingByIdFromDb(input.id);
    if (!existing) {
      return { success: false, error: "Rodaje no encontrado" };
    }

    // 2. Validar cambios de horario
    if (input.startTime !== undefined || input.endTime !== undefined) {
      const validation = await validateUpdateShooting({
        shootingId: input.id,
        startTime: input.startTime,
        endTime: input.endTime,
        clientId: input.clientId,
        existingStartTime: existing.startTime,
        existingEndTime: existing.endTime,
      });
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    // 3. Actualizar en BD
    const updateData: UpdateShootingData = {
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      address: input.address !== undefined ? (input.address || null) : undefined,
      mapLink: input.mapLink !== undefined ? (input.mapLink || null) : undefined,
      scriptUrl: input.scriptUrl !== undefined ? (input.scriptUrl || null) : undefined,
      audioBriefUrl: input.audioBriefUrl !== undefined ? (input.audioBriefUrl || null) : undefined,
      notes: input.notes !== undefined ? (input.notes || null) : undefined,
      clientId: input.clientId,
      status: input.status,
      crewIds: input.crewIds,
      taskIds: input.taskIds,
    };
    let shooting = await updateShootingInDb(input.id, updateData);

    // 4. Sincronizar con Google Calendar
    let calendarError: string | null = null;
    const existingEventId = (existing as any)?.googleEventId as string | undefined;
    if (input.createCalendarEvent !== false || existingEventId) {
      const calResult = await syncShootingToCalendar(
        sessionUserId,
        {
          title: shooting.title,
          startTime: shooting.startTime,
          endTime: shooting.endTime,
          address: shooting.address ?? undefined,
          mapLink: shooting.mapLink ?? undefined,
          notes: shooting.notes ?? undefined,
          clientId: shooting.clientId,
          crewIds: input.crewIds ?? shooting.crew.map((c) => c.id),
        },
        existingEventId
      );

      if (calResult.success && calResult.eventId) {
        shooting = await updateShootingInDb(shooting.id, {
          googleEventId: calResult.eventId,
          googleEventLink: calResult.eventLink,
        });
      } else if (calResult.error) {
        calendarError = calResult.error;
      }
    }

    // 5. Revalidar rutas
    revalidateShootingPaths();

    return { 
      success: true, 
      data: shooting, 
      calendarError 
    } as ApiResponse<ShootWithRelations> & { calendarError: string | null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar el rodaje",
    };
  }
}

/**
 * Obtiene rodajes filtrados por mes y cliente
 */
export async function getShootings(
  month?: Date,
  clientId?: string
): Promise<ApiResponse<ShootWithRelations[]>> {
  try {
    const sessionUserId = await getAuthenticatedUserId();
    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const shootings = await getShootingsFromDb({ month, clientId });
    return { success: true, data: shootings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener los rodajes",
    };
  }
}

/**
 * Obtiene un rodaje por ID
 */
export async function getShootingById(
  id: string
): Promise<ApiResponse<ShootWithRelations>> {
  try {
    const sessionUserId = await getAuthenticatedUserId();
    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const shooting = await getShootingByIdFromDb(id);
    if (!shooting) {
      return { success: false, error: "Rodaje no encontrado" };
    }

    return { success: true, data: shooting };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener el rodaje",
    };
  }
}

/**
 * Cancela un rodaje (cambia estado a CANCELED)
 */
export async function cancelShooting(
  id: string
): Promise<ApiResponse<ShootWithRelations>> {
  try {
    const sessionUserId = await getAuthenticatedUserId();
    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // 1. Verificar que existe
    const existingResult = await validateShootingExists(id);
    if (!existingResult.valid) {
      return { success: false, error: existingResult.error };
    }

    // 2. Cancelar
    const shooting = await cancelShootingInDb(id);

    // 3. Revalidar
    revalidatePath("/content/shoots");
    revalidatePath("/content");

    return { success: true, data: shooting };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cancelar el rodaje",
    };
  }
}

/**
 * Elimina un rodaje
 */
export async function deleteShooting(
  id: string
): Promise<ApiResponse<void>> {
  try {
    const sessionUserId = await getAuthenticatedUserId();
    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // Validar permisos: solo ADMIN puede eliminar
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Solo los administradores pueden eliminar rodajes" };
    }

    // 1. Verificar que existe
    const existingResult = await validateShootingExists(id);
    if (!existingResult.valid) {
      return { success: false, error: existingResult.error };
    }

    // 2. Eliminar evento de Google Calendar si existe
    const googleEventId = existingResult.shooting?.googleEventId;
    if (googleEventId) {
      await deleteCalendarEvent(sessionUserId, googleEventId);
      // No fallar si Calendar falla
    }

    // 3. Eliminar de BD
    await deleteShootingFromDb(id);

    // 4. Revalidar
    revalidateShootingPaths();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar el rodaje",
    };
  }
}

/**
 * Verifica rodajes próximos (dentro de 12 horas) y envía notificaciones
 */
export async function checkUpcomingShoots(): Promise<
  ApiResponse<{ checked: number; notified: number }>
> {
  try {
    const upcomingShoots = await getUpcomingShootingsFromDb(12);
    let totalNotified = 0;

    for (const shoot of upcomingShoots) {
      const result = await sendShootingReminders({
        shootingId: shoot.id,
        shootingTitle: shoot.title,
        startTime: shoot.startTime,
        crewIds: shoot.crew.map((c) => c.id),
      });
      totalNotified += result.notifiedCount;
    }

    return {
      success: true,
      data: {
        checked: upcomingShoots.length,
        notified: totalNotified,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al verificar rodajes próximos",
    };
  }
}
