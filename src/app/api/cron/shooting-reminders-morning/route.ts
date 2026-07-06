import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendShootingReminders } from "@/lib/shooting-notifications";

/**
 * Cron: Recordatorio matutino de rodajes (7am Ecuador = 12:00 UTC)
 * Schedule: 0 12 * * *
 *
 * Envía push notification a todo el crew de rodajes programados para hoy.
 * Dedup via `reminderSentMorning` flag.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get("x-vercel-cron-id");

    if (!vercelCronHeader && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Calculate today's range in Ecuador timezone (UTC-5)
    const now = new Date();
    const ecuadorOffsetMs = 5 * 60 * 60 * 1000; // UTC-5
    const ecuadorNow = new Date(now.getTime() - ecuadorOffsetMs);

    const dayStart = new Date(ecuadorNow);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(ecuadorNow);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Convert back to UTC for DB query
    const utcDayStart = new Date(dayStart.getTime() + ecuadorOffsetMs);
    const utcDayEnd = new Date(dayEnd.getTime() + ecuadorOffsetMs);

    // Find shoots scheduled for today that haven't received morning reminder
    const shoots = await db.shoot.findMany({
      where: {
        status: "SCHEDULED",
        startTime: {
          gte: utcDayStart,
          lte: utcDayEnd,
        },
        reminderSentMorning: false,
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
          // Mark as sent even if no crew
          await db.shoot.update({
            where: { id: shoot.id },
            data: { reminderSentMorning: true },
          });
          shootsProcessed++;
          continue;
        }

        const result = await sendShootingReminders({
          shootingId: shoot.id,
          shootingTitle: shoot.title,
          startTime: shoot.startTime,
          crewIds,
        });

        notificationsSent += result.notifiedCount;

        // Mark as sent
        await db.shoot.update({
          where: { id: shoot.id },
          data: { reminderSentMorning: true },
        });

        shootsProcessed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        errors.push(`Shoot ${shoot.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: { shootsProcessed, notificationsSent, errors: errors.length },
    });
  } catch (error) {
    console.error("❌ Error en cron shooting-reminders-morning:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  return POST(request);
}
