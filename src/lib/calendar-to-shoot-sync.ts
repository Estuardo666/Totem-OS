/**
 * Calendar → Shoot Sync Service
 * Syncs Google Calendar events into Totem OS as Shoots
 *
 * @fileoverview Handles bidirectional sync: Calendar events → Shoots in DB.
 * Uses syncToken for incremental sync. Anti-loop via syncedFromCalendar flag.
 */

import { db } from "@/lib/db";
import { GoogleCalendarService } from "@/lib/google-calendar";
import { matchClientFromCalendarEvent } from "@/lib/client-matcher";
import { notifyAdminsWithPush } from "@/actions/notification-actions";

type CalendarEvent = Awaited<
  ReturnType<typeof GoogleCalendarService.listEvents>
>["events"][number];

export interface SyncResult {
  created: number;
  updated: number;
  cancelled: number;
  errors: string[];
}

/**
 * Parsea un dateTime string de Google Calendar a Date.
 * Google puede enviar dateTime (para eventos con hora) o date (para all-day events).
 */
function parseEventDateTime(event: CalendarEvent): {
  startTime: Date;
  endTime: Date;
} {
  if (event.start.dateTime) {
    return {
      startTime: new Date(event.start.dateTime),
      endTime: new Date(event.end.dateTime || event.start.dateTime),
    };
  }

  // All-day event: use date field
  if (event.start.date) {
    const start = new Date(event.start.date + "T00:00:00");
    const end = event.end.date
      ? new Date(event.end.date + "T00:00:00")
      : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { startTime: start, endTime: end };
  }

  // Fallback
  return {
    startTime: new Date(),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
  };
}

/**
 * Crea un shoot desde un evento de Google Calendar
 */
async function createShootFromCalendarEvent(
  event: CalendarEvent
): Promise<void> {
  const { startTime, endTime } = parseEventDateTime(event);

  // Match client
  const attendeeEmails =
    event.attendees?.map((a) => a.email).filter(Boolean) ?? [];
  const clientMatch = await matchClientFromCalendarEvent(
    event.summary,
    event.description,
    attendeeEmails
  );

  // Extract location/mapLink from event
  const address = event.location || undefined;
  const mapLink = undefined; // Google Calendar doesn't have a separate mapLink field

  await db.shoot.create({
    data: {
      title: event.summary || "(Sin título)",
      startTime,
      endTime,
      address,
      mapLink,
      googleEventId: event.id,
      googleEventLink: event.htmlLink,
      notes: event.description || null,
      status: "SCHEDULED",
      syncedFromCalendar: true,
      clientId: clientMatch.clientId,
      crew: { connect: [] }, // No crew assignment from Calendar
    },
  });
}

/**
 * Actualiza un shoot existente desde un evento de Google Calendar
 */
async function updateShootFromCalendarEvent(
  shootId: string,
  event: CalendarEvent
): Promise<void> {
  const { startTime, endTime } = parseEventDateTime(event);

  await db.shoot.update({
    where: { id: shootId },
    data: {
      title: event.summary || "(Sin título)",
      startTime,
      endTime,
      address: event.location || null,
      notes: event.description || null,
      googleEventLink: event.htmlLink,
    },
  });
}

/**
 * Cancela/elimina un shoot cuando el evento de Calendar es cancelado
 */
async function cancelShootFromCalendarEvent(shootId: string): Promise<void> {
  const shoot = await db.shoot.findUnique({
    where: { id: shootId },
    select: { status: true },
  });

  if (!shoot) return;

  // If already completed or cancelled, don't change
  if (shoot.status === "COMPLETED" || shoot.status === "CANCELED") return;

  await db.shoot.update({
    where: { id: shootId },
    data: { status: "CANCELED" },
  });
}

/**
 * Sincroniza todos los eventos de Google Calendar a Shoots.
 * Usa syncToken para sync incremental (solo cambios desde última sync).
 *
 * @param userId - ID del usuario dueño del Google Calendar
 * @returns SyncResult con conteo de created/updated/cancelled y errores
 */
export async function syncCalendarEventsToShoots(
  userId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    cancelled: 0,
    errors: [],
  };

  try {
    // Get last syncToken from DB
    const token = await (db as any).googleCalendarToken.findUnique({
      where: { userId },
      select: { lastSyncToken: true },
    });

    const syncToken = token?.lastSyncToken ?? null;

    // Fetch events (handles pagination internally)
    let nextPageToken: string | undefined;
    let lastSyncToken: string | undefined;

    do {
      const response = await GoogleCalendarService.listEvents(
        userId,
        syncToken,
        nextPageToken
      );

      for (const event of response.events) {
        try {
          if (event.status === "cancelled") {
            // Event deleted/cancelled in Calendar
            const shoot = await db.shoot.findFirst({
              where: { googleEventId: event.id },
              select: { id: true },
            });

            if (shoot) {
              await cancelShootFromCalendarEvent(shoot.id);
              result.cancelled++;
            }
          } else {
            // Event exists — create or update
            const existingShoot = await db.shoot.findFirst({
              where: { googleEventId: event.id },
              select: { id: true },
            });

            if (existingShoot) {
              await updateShootFromCalendarEvent(existingShoot.id, event);
              result.updated++;
            } else {
              await createShootFromCalendarEvent(event);
              result.created++;
            }
          }
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : "Error desconocido";
          result.errors.push(
            `Error procesando evento "${event.summary}": ${msg}`
          );
        }
      }

      lastSyncToken = response.nextSyncToken;
      nextPageToken = response.nextPageToken;
    } while (nextPageToken);

    // Save syncToken for next incremental sync
    if (lastSyncToken) {
      await (db as any).googleCalendarToken.update({
        where: { userId },
        data: {
          lastSyncToken: lastSyncToken,
          lastSyncAt: new Date(),
        },
      });
    }

    // Notify admins if new shoots were created
    if (result.created > 0) {
      try {
        await notifyAdminsWithPush(
          "Rodajes importados de Google Calendar",
          `Se importaron ${result.created} rodaje(s) desde Google Calendar.`,
          "ADMIN_ALERT",
          "/content/shoots"
        );
      } catch {
        // Don't fail sync if notification fails
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    result.errors.push(`Error general en sync: ${msg}`);
  }

  return result;
}

/**
 * Sync completo (sin syncToken) — re-importa todos los eventos visibles.
 * Usado como fallback si el syncToken se pierde o el webhook falla.
 */
export async function fullCalendarSync(userId: string): Promise<SyncResult> {
  // Clear syncToken to force full sync
  await (db as any).googleCalendarToken.update({
    where: { userId },
    data: { lastSyncToken: null },
  });

  return syncCalendarEventsToShoots(userId);
}
