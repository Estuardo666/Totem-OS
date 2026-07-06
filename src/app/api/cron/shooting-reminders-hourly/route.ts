import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendShootingReminders } from "@/lib/shooting-notifications";

/**
 * Cron: Recordatorio 1 hora antes del rodaje
 * Schedule: every 15 minutes
 *
 * Busca rodajes que empiezan en los próximos 75 minutos.
 * Dedup via `reminderSent1h` flag.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get("x-vercel-cron-id");

    if (!vercelCronHeader && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
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

    return NextResponse.json({
      success: true,
      data: { shootsProcessed, notificationsSent, errors: errors.length },
    });
  } catch (error) {
    console.error("❌ Error en cron shooting-reminders-hourly:", error);
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
