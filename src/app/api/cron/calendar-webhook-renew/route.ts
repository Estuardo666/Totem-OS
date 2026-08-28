import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GoogleCalendarService } from "@/lib/google-calendar";
import { syncCalendarEventsToShoots } from "@/lib/calendar-to-shoot-sync";

/**
 * Cron: Renueva webhook channels de Google Calendar + fallback sync
 * Schedule: every 12 hours
 *
 * - Renueva channels que expiran en < 24h
 * - Registra channels para usuarios conectados sin channel activo
 * - Hace sync incremental como fallback (por si webhook se perdió)
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get("x-vercel-cron-id");

    if (!vercelCronHeader && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const webhookBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://totem-os.vercel.app";
    const webhookUrl = `${webhookBaseUrl}/api/google-calendar/webhook`;
    const secretToken = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;

    // Sin secreto no se registra ningun canal: un webhook sin token no se puede
    // verificar y aceptaria notificaciones de cualquier origen. Se falla de
    // forma explicita para que el problema de configuracion sea visible.
    if (!secretToken) {
      return NextResponse.json(
        { error: "GOOGLE_CALENDAR_WEBHOOK_SECRET no esta configurado; no se registran webhooks." },
        { status: 500 }
      );
    }

    // Get all users with Google Calendar connected
    const tokens = await (db as any).googleCalendarToken.findMany({
      select: {
        userId: true,
        channelId: true,
        channelExpiration: true,
      },
    });

    let renewed = 0;
    let registered = 0;
    let synced = 0;
    const errors: string[] = [];

    for (const token of tokens) {
      try {
        const needsRenewal =
          !token.channelId ||
          !token.channelExpiration ||
          new Date(token.channelExpiration).getTime() < Date.now() + 24 * 60 * 60 * 1000;

        if (needsRenewal) {
          if (token.channelId) {
            // Renew existing channel
            await GoogleCalendarService.renewWebhookChannel(
              token.userId,
              webhookUrl,
              secretToken
            );
            renewed++;
          } else {
            // Register new channel
            await GoogleCalendarService.registerWebhookChannel(
              token.userId,
              webhookUrl,
              secretToken
            );
            registered++;
          }
        }

        // Fallback sync — in case webhook was missed
        const result = await syncCalendarEventsToShoots(token.userId);
        if (result.created + result.updated + result.cancelled > 0) {
          synced++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        errors.push(`User ${token.userId}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: tokens.length,
        renewed,
        registered,
        synced,
        errors: errors.length,
      },
    });
  } catch (error) {
    console.error("❌ Error en cron calendar-webhook-renew:", error);
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
