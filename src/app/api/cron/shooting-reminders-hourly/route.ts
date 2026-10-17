import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { enqueueDueShoot24h, sendShootingReminders } from "@/lib/shooting-notifications";

/**
 * Cron: recordatorio de 24 horas y recordatorio legacy de 1 hora antes
 * Schedule: every 15 minutes
 *
 * Busca rodajes que empiezan en los próximos 75 minutos.
 * Dedup via `reminderSent1h` flag.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 75 * 60 * 1000); // 75 min buffer

    // Find shoots starting within the next 75 minutes that haven't received 1h reminder
    const shoots = await db.shoot.findMany({
      where: {
        status: "SCHEDULED",
        startTime: {
          gte: now,
          lte: windowEnd,
        },
        reminderSent1h: false,
      },
      include: {
        crew: true,
        client: true,
      },
    });

    let shootsProcessed = 0;
    let notificationsSent = 0;
    const errors: string[] = [];

    for (const shoot of shoots) {
      try {
        const crewIds = shoot.crew.map((c) => c.id);
        if (crewIds.length === 0) {
          await db.shoot.update({
            where: { id: shoot.id },
            data: { reminderSent1h: true },
          });
          shootsProcessed++;
          continue;
        }

        const result = await sendShootingReminders({
          shootingId: shoot.id,
          shootingTitle: shoot.title,
          startTime: shoot.startTime,
          crewIds,
          clientId: shoot.clientId,
          stage: "HOUR",
        });

        notificationsSent += result.notifiedCount;

        await db.shoot.update({
          where: { id: shoot.id },
          data: { reminderSent1h: true },
        });

        shootsProcessed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        errors.push(`Shoot ${shoot.id}: ${msg}`);
      }
    }

    let whatsapp24h: { shootsChecked: number; destinations: number; enqueued: number } | { error: string };
    try {
      whatsapp24h = await enqueueDueShoot24h(now);
    } catch {
      whatsapp24h = { error: "No se pudieron preparar recordatorios de 24 horas" };
      errors.push("Error en recordatorios de 24 horas");
    }

    return NextResponse.json({
      success: true,
      data: { shootsProcessed, notificationsSent, whatsapp24h, errors: errors.length },
    });
  } catch {
    console.error("❌ Error en cron shooting-reminders-hourly");
    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron completar los recordatorios de rodaje",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
