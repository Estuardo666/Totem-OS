/**
 * Shooting Calendar Service
 * Integración con Google Calendar para rodajes
 * 
 * @fileoverview Lógica de sincronización con Calendar extraída de shooting-actions.ts
 */

import { GoogleCalendarService } from "@/lib/google-calendar";
import { getCrewWithEmails } from "./shooting-service";
import { db } from "@/lib/db";

export interface CalendarEventData {
  title: string;
  startTime: Date;
  endTime: Date;
  address?: string;
  mapLink?: string;
  notes?: string;
  clientId: string;
  crewIds: string[];
}

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  eventLink?: string;
  error?: string;
}

/**
 * Extrae emails de Gmail de los contactos del cliente
 */
export function extractGmailEmails(contactEmails?: string | null): string[] {
  if (!contactEmails) return [];
  try {
    const parsed = JSON.parse(contactEmails) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((email) => email.toLowerCase().endsWith("@gmail.com"));
  } catch {
    return [];
  }
}

/**
 * Crea un evento en Google Calendar para un rodaje
 */
export async function createCalendarEvent(
  userId: string,
  data: CalendarEventData
): Promise<CalendarSyncResult> {
  try {
    // Obtener crew con emails
    const crewWithEmails = await getCrewWithEmails(data.crewIds);

    // Obtener cliente para emails
    const client = await db.client.findUnique({
      where: { id: data.clientId },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado" };
    }

    const clientEmails = extractGmailEmails((client as any)?.contactEmails);

    const event = await GoogleCalendarService.createEvent(userId, {
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      address: data.address,
      mapLink: data.mapLink,
      notes: data.notes,
      client: { name: client.name, emails: clientEmails },
      crew: crewWithEmails
        .filter((c) => !!c.email)
        .map((c) => ({ name: c.name, email: c.email as string })),
    });

    return {
      success: true,
      eventId: event.id,
      eventLink: event.htmlLink,
    };
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : "Error al crear evento de Calendar";
    console.error("Error creando evento de Calendar:", error);
    return { success: false, error: message };
  }
}

/**
 * Actualiza un evento existente en Google Calendar
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  data: CalendarEventData
): Promise<CalendarSyncResult> {
  try {
    // Obtener crew con emails
    const crewWithEmails = await getCrewWithEmails(data.crewIds);

    // Obtener cliente para emails
    const client = await db.client.findUnique({
      where: { id: data.clientId },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado" };
    }

    const clientEmails = extractGmailEmails((client as any)?.contactEmails);

    const event = await GoogleCalendarService.updateEvent(userId, eventId, {
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      address: data.address,
      mapLink: data.mapLink,
      notes: data.notes,
      client: { name: client.name, emails: clientEmails },
      crew: crewWithEmails
        .filter((c) => !!c.email)
        .map((c) => ({ name: c.name, email: c.email as string })),
    });

    return {
      success: true,
      eventId: event.id,
      eventLink: event.htmlLink,
    };
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : "Error al actualizar evento de Calendar";
    console.error("Error actualizando evento de Calendar:", error);
    return { success: false, error: message };
  }
}

/**
 * Elimina un evento de Google Calendar
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<CalendarSyncResult> {
  try {
    await GoogleCalendarService.deleteEvent(userId, eventId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : "Error al eliminar evento de Calendar";
    console.error("Error eliminando evento de Calendar:", error);
    return { success: false, error: message };
  }
}

/**
 * Sincroniza un rodaje con Google Calendar (crea o actualiza según corresponda)
 * @param skipIfSyncedFromCalendar - Si es true, no sincroniza si el shoot fue importado de Calendar (anti-loop)
 */
export async function syncShootingToCalendar(
  userId: string,
  data: CalendarEventData,
  existingEventId?: string | null,
  skipIfSyncedFromCalendar?: boolean
): Promise<CalendarSyncResult> {
  // Anti-loop: don't re-sync events that were imported from Calendar
  if (skipIfSyncedFromCalendar) {
    return { success: true }; // Skip silently
  }

  if (existingEventId) {
    return updateCalendarEvent(userId, existingEventId, data);
  }
  return createCalendarEvent(userId, data);
}

/**
 * Actualiza el status de un evento en Google Calendar según el status del shoot.
 * - COMPLETED → prefix "✅ COMPLETADO: " en el summary
 * - CANCELED → elimina el evento
 */
export async function markCalendarEventStatus(
  userId: string,
  eventId: string,
  status: "SCHEDULED" | "COMPLETED" | "CANCELED",
  currentTitle?: string
): Promise<CalendarSyncResult> {
  if (status === "CANCELED") {
    return deleteCalendarEvent(userId, eventId);
  }

  if (status === "COMPLETED") {
    try {
      const auth = await (await import("@/lib/google-calendar")).GoogleCalendarService.getAuthenticatedClient(userId);
      const { google } = await import("googleapis");
      const calendar = google.calendar({ version: "v3", auth });

      const titlePrefix = "✅ ";
      const summary = currentTitle
        ? `${titlePrefix}${currentTitle}`
        : titlePrefix;

      await calendar.events.patch({
        calendarId: "primary",
        eventId,
        requestBody: { summary },
      });

      return { success: true, eventId };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al marcar evento como completado";
      return { success: false, error: message };
    }
  }

  // SCHEDULED — no-op (could strip prefix if needed)
  return { success: true };
}
