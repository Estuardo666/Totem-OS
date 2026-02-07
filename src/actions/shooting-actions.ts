"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Shoot, User, ContentTask, Client } from "@prisma/client";
import { GoogleCalendarService } from "@/lib/google-calendar";
import { sendNotification } from "./notification-actions";

export type ShootWithRelations = (Shoot & {
  googleEventId?: string | null;
  googleEventLink?: string | null;
}) & {
  client: Client;
  crew: User[];
  tasks: (ContentTask & { client: Client })[];
};

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

const extractGmailEmails = (contactEmails?: string | null): string[] => {
  if (!contactEmails) return [];
  try {
    const parsed = JSON.parse(contactEmails) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((email) => email.toLowerCase().endsWith("@gmail.com"));
  } catch {
    return [];
  }
};

/**
 * Crea un nuevo rodaje con validaciones de horario y solapamiento
 */
export async function createShooting(
  input: CreateShootingInput
): Promise<ApiResponse<ShootWithRelations>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // Validar que el cliente existe
    const client = await db.client.findUnique({
      where: { id: input.clientId },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado" };
    }

    // Validación de horario: endTime debe ser posterior a startTime
    if (input.endTime <= input.startTime) {
      return {
        success: false,
        error: "La hora de finalización debe ser posterior a la hora de inicio",
      };
    }

    // Validación de solapamiento: verificar si existe otro rodaje que choque
    // Lógica: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
    const conflictingShoot = await db.shoot.findFirst({
      where: {
        status: { not: "CANCELED" }, // Excluir rodajes cancelados
        AND: [
          { startTime: { lt: input.endTime } },
          { endTime: { gt: input.startTime } },
        ],
      },
    });

    if (conflictingShoot) {
      const startTimeStr = format(input.startTime, "HH:mm", { locale: es });
      const endTimeStr = format(input.endTime, "HH:mm", { locale: es });
      return {
        success: false,
        error: `Conflicto de horario: Ya existe un rodaje entre las ${startTimeStr} y ${endTimeStr}.`,
      };
    }

    // Crear el rodaje
    let shooting = (await db.shoot.create({
      data: {
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        address: input.address || null,
        mapLink: input.mapLink || null,
        scriptUrl: input.scriptUrl || null,
        audioBriefUrl: input.audioBriefUrl || null,
        notes: input.notes || null,
        clientId: input.clientId,
        status: "SCHEDULED",
        crew: {
          connect: input.crewIds.map((id) => ({ id })),
        },
        tasks: {
          connect: input.taskIds.map((id) => ({ id })),
        },
      },
      include: {
        client: true,
        crew: true,
        tasks: {
          include: {
            client: true,
          },
        },
      },
    })) as ShootWithRelations;

    // Crear evento en Google Calendar (opcional)
    let calendarError: string | null = null;
    if (input.createCalendarEvent !== false || shooting.googleEventId) {
      try {
        const crewWithEmails = await db.user.findMany({
          where: { id: { in: input.crewIds } },
          select: { id: true, name: true, email: true },
        });

        const clientEmails = extractGmailEmails((client as any)?.contactEmails);
        const event = await GoogleCalendarService.createEvent(sessionUserId, {
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          address: input.address || undefined,
          mapLink: input.mapLink || undefined,
          notes: input.notes || undefined,
          client: { name: client.name, emails: clientEmails },
          crew: crewWithEmails
            .filter((c) => !!c.email)
            .map((c) => ({ name: c.name, email: c.email as string })),
        });

        const shootingWithEvent = (await db.shoot.update({
          where: { id: shooting.id },
          data: {
            googleEventId: event.id,
            googleEventLink: event.htmlLink,
          } as any,
          include: {
            client: true,
            crew: true,
            tasks: {
              include: { client: true },
            },
          },
        })) as ShootWithRelations;

        shooting = shootingWithEvent;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al crear evento de Calendar";
        calendarError = message;
        console.error("Error creando evento de Calendar:", error);
      }
    }

    // Enviar notificaciones a los miembros del crew
    const startTimeStr = format(input.startTime, "dd/MM/yyyy HH:mm", { locale: es });
    for (const crewMemberId of input.crewIds) {
      await sendNotification({
        userId: crewMemberId,
        message: `Nuevo rodaje programado: ${input.title} (${startTimeStr})`,
        type: "SHOOT_NEW",
        createdBy: sessionUserId,
      });
    }

    // Notificar a los admins sobre el nuevo rodaje (Pusher + PUSH PWA)
    try {
      const { notifyAdminsWithPush } = await import("@/actions/notification-actions");
      const startTimeStr = format(input.startTime, "dd/MM/yyyy HH:mm", { locale: es });
      
      await notifyAdminsWithPush(
        "Nuevo rodaje creado",
        `Se creó un nuevo rodaje: ${input.title} - ${client.name} (${startTimeStr})`,
        "ADMIN_ALERT",
        "/content/shoots",
        sessionUserId
      );
    } catch (error) {
      console.error("❌ Error al enviar notificaciones PUSH a admins:", error);
      // No fallar la operación si las notificaciones fallan
    }

    // Revalidar rutas
    revalidatePath("/content/shoots");
    revalidatePath("/content");
    revalidatePath("/content/dashboard");

    return { success: true, data: shooting, calendarError } as ApiResponse<ShootWithRelations> & {
      calendarError: string | null;
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al crear el rodaje",
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
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // Verificar que el rodaje existe
    const existingShoot = await db.shoot.findUnique({
      where: { id: input.id },
    });

    if (!existingShoot) {
      return { success: false, error: "Rodaje no encontrado" };
    }

    // Validación de horario si se actualizan las fechas
    if (input.startTime !== undefined || input.endTime !== undefined) {
      const newStartTime = input.startTime ?? existingShoot.startTime;
      const newEndTime = input.endTime ?? existingShoot.endTime;

      if (newEndTime <= newStartTime) {
        return {
          success: false,
          error: "La hora de finalización debe ser posterior a la hora de inicio",
        };
      }

      // Validación de solapamiento (excluyendo el rodaje actual)
      const conflictingShoot = await db.shoot.findFirst({
        where: {
          id: { not: input.id },
          status: { not: "CANCELED" },
          AND: [
            { startTime: { lt: newEndTime } },
            { endTime: { gt: newStartTime } },
          ],
        },
      });

      if (conflictingShoot) {
        const startTimeStr = format(newStartTime, "HH:mm", { locale: es });
        const endTimeStr = format(newEndTime, "HH:mm", { locale: es });
        return {
          success: false,
          error: `Conflicto de horario: Ya existe un rodaje entre las ${startTimeStr} y ${endTimeStr}.`,
        };
      }
    }

    // Preparar datos de actualización
    const updateData: {
      title?: string;
      startTime?: Date;
      endTime?: Date;
      address?: string | null;
      mapLink?: string | null;
      scriptUrl?: string | null;
      audioBriefUrl?: string | null;
      notes?: string | null;
      clientId?: string;
      status?: string;
      crew?: { set: { id: string }[] };
      tasks?: { set: { id: string }[] };
    } = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.startTime !== undefined) updateData.startTime = input.startTime;
    if (input.endTime !== undefined) updateData.endTime = input.endTime;
    if (input.address !== undefined) updateData.address = input.address || null;
    if (input.mapLink !== undefined) updateData.mapLink = input.mapLink || null;
    if (input.scriptUrl !== undefined) updateData.scriptUrl = input.scriptUrl || null;
    if (input.audioBriefUrl !== undefined) updateData.audioBriefUrl = input.audioBriefUrl || null;
    if (input.notes !== undefined) updateData.notes = input.notes || null;
    if (input.clientId !== undefined) updateData.clientId = input.clientId;
    if (input.status !== undefined) updateData.status = input.status;

    // Actualizar crew si se proporciona
    if (input.crewIds !== undefined) {
      updateData.crew = {
        set: input.crewIds.map((id) => ({ id })),
      };
    }

    // Actualizar tareas si se proporciona
    if (input.taskIds !== undefined) {
      updateData.tasks = {
        set: input.taskIds.map((id) => ({ id })),
      };
    }

    // Actualizar el rodaje
    let shooting = (await db.shoot.update({
      where: { id: input.id },
      data: updateData,
      include: {
        client: true,
        crew: true,
        tasks: {
          include: {
            client: true,
          },
        },
      },
    })) as ShootWithRelations;

    // Sincronizar con Google Calendar si corresponde
    let calendarError: string | null = null;
    if (input.createCalendarEvent !== false || shooting.googleEventId) {
      try {
        const crewWithEmails = await db.user.findMany({
          where: { id: { in: input.crewIds ?? shooting.crew.map((c) => c.id) } },
          select: { id: true, name: true, email: true },
        });

        const shootingClientEmails = extractGmailEmails(
          (shooting.client as any)?.contactEmails
        );
        const shootingEventId = (shooting as any)?.googleEventId as string | undefined;
        if (shootingEventId) {
          const event = await GoogleCalendarService.updateEvent(sessionUserId, shootingEventId, {
            title: shooting.title,
            startTime: shooting.startTime,
            endTime: shooting.endTime,
            address: shooting.address || undefined,
            mapLink: shooting.mapLink || undefined,
            notes: shooting.notes || undefined,
            client: { name: shooting.client.name, emails: shootingClientEmails },
            crew: crewWithEmails
              .filter((c) => !!c.email)
              .map((c) => ({ name: c.name, email: c.email as string })),
          });

          shooting = (await db.shoot.update({
            where: { id: shooting.id },
            data: {
              googleEventId: event.id,
              googleEventLink: event.htmlLink,
            } as any,
            include: {
              client: true,
              crew: true,
              tasks: { include: { client: true } },
            },
          })) as ShootWithRelations;
        } else {
          const event = await GoogleCalendarService.createEvent(sessionUserId, {
            title: shooting.title,
            startTime: shooting.startTime,
            endTime: shooting.endTime,
            address: shooting.address || undefined,
            mapLink: shooting.mapLink || undefined,
            notes: shooting.notes || undefined,
            client: { name: shooting.client.name, emails: shootingClientEmails },
            crew: crewWithEmails
              .filter((c) => !!c.email)
              .map((c) => ({ name: c.name, email: c.email as string })),
          });

          shooting = (await db.shoot.update({
            where: { id: shooting.id },
            data: {
              googleEventId: event.id,
              googleEventLink: event.htmlLink,
            } as any,
            include: {
              client: true,
              crew: true,
              tasks: { include: { client: true } },
            },
          })) as ShootWithRelations;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al actualizar evento de Calendar";
        calendarError = message;
        console.error("Error sincronizando evento de Calendar:", error);
      }
    }

    // Revalidar rutas
    revalidatePath("/content/shoots");
    revalidatePath("/content");
    revalidatePath("/content/dashboard");

    return { success: true, data: shooting, calendarError } as ApiResponse<ShootWithRelations> & {
      calendarError: string | null;
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar el rodaje",
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
    const { auth } = await import("@/auth");
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "No autenticado" };
    }

    const where: {
      clientId?: string;
      startTime?: {
        gte: Date;
        lte: Date;
      };
    } = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (month) {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      where.startTime = {
        gte: monthStart,
        lte: monthEnd,
      };
    }

    const shootings = await db.shoot.findMany({
      where,
      include: {
        client: true,
        crew: true,
        tasks: {
          include: {
            client: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return { success: true, data: shootings };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener los rodajes",
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
    const { auth } = await import("@/auth");
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "No autenticado" };
    }

    const shooting = await db.shoot.findUnique({
      where: { id },
      include: {
        client: true,
        crew: true,
        tasks: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!shooting) {
      return { success: false, error: "Rodaje no encontrado" };
    }

    return { success: true, data: shooting };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener el rodaje",
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
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // Verificar que el rodaje existe
    const existingShoot = await db.shoot.findUnique({
      where: { id },
    });

    if (!existingShoot) {
      return { success: false, error: "Rodaje no encontrado" };
    }

    // Actualizar estado
    const shooting = await db.shoot.update({
      where: { id },
      data: { status: "CANCELED" },
      include: {
        client: true,
        crew: true,
        tasks: {
          include: {
            client: true,
          },
        },
      },
    });

    // Revalidar rutas
    revalidatePath("/content/shoots");
    revalidatePath("/content");

    return { success: true, data: shooting };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al cancelar el rodaje",
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
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    // Verificar que el rodaje existe
    const existingShoot = await db.shoot.findUnique({
      where: { id },
    });

    if (!existingShoot) {
      return { success: false, error: "Rodaje no encontrado" };
    }

    // Eliminar el rodaje
    await db.shoot.delete({
      where: { id },
    });

    // Revalidar rutas
    revalidatePath("/content/shoots");
    revalidatePath("/content");
    revalidatePath("/content/dashboard");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al eliminar el rodaje",
    };
  }
}

/**
 * Verifica rodajes próximos (dentro de 12 horas) y envía notificaciones
 * Esta función debe ejecutarse periódicamente (cron job o similar)
 */
export async function checkUpcomingShoots(): Promise<
  ApiResponse<{ checked: number; notified: number }>
> {
  try {
    const now = new Date();
    const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // Buscar rodajes programados en las próximas 12 horas
    const upcomingShoots = await db.shoot.findMany({
      where: {
        status: "SCHEDULED",
        startTime: {
          gte: now,
          lte: twelveHoursFromNow,
        },
      },
      include: {
        crew: true,
      },
    });

    let notifiedCount = 0;

    // Verificar si ya se notificó (usando un campo de notificación o simplemente notificar siempre)
    // Por simplicidad, notificamos siempre que se ejecute esta función
    for (const shoot of upcomingShoots) {
      const startTimeStr = format(shoot.startTime, "dd/MM/yyyy HH:mm", { locale: es });
      for (const crewMember of shoot.crew) {
        try {
          await sendNotification({
            userId: crewMember.id,
            message: `Recordatorio: Rodaje "${shoot.title}" en ${startTimeStr}`,
            type: "SHOOT_REMINDER",
            createdBy: undefined, // Sistema
          });
          notifiedCount++;
        } catch (error) {
          console.error(`❌ Error al notificar sobre rodaje ${shoot.id}:`, error);
        }
      }
    }

    return {
      success: true,
      data: {
        checked: upcomingShoots.length,
        notified: notifiedCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al verificar rodajes próximos",
    };
  }
}

