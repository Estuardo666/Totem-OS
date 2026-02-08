import { NextRequest, NextResponse } from "next/server";
import { sendDailyTaskDigest } from "@/actions/notification-actions";

/**
 * API Route para ejecutar el digest diario de tareas
 * Debe ser llamado por un cron job externo (ej: cPanel Cron Jobs, Vercel Cron, GitHub Actions)
 * 
 * Configuración cron sugerida (8am Ecuador = UTC-5):
 * - cPanel: `0 8 * * * curl -X POST https://totem-os.com/api/cron/daily-digest`
 * - Vercel: agregar a vercel.json: { "crons": [{ "path": "/api/cron/daily-digest", "schedule": "0 13 * * *" }] }
 * - GitHub Actions: ejecutar a las 13:00 UTC (8am Ecuador)
 */
export async function POST(request: NextRequest) {
  try {
    // Seguridad: verificar que viene de Vercel Cron o con secret válido
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get("x-vercel-cron-id");

    // Permitir si: 1) Viene de Vercel Cron, O 2) Tiene Authorization válido
    if (!vercelCronHeader && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      console.warn("⚠️ Intento de acceso no autorizado a /api/cron/daily-digest");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    console.log("🕐 Ejecutando daily digest (8am)...");

    const result = await sendDailyTaskDigest();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Digest enviado a ${result.data?.sentCount} usuarios`,
        data: result.data,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Error en cron daily-digest:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// Permitir GET también para testing manual desde navegador (con autenticación)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Acceso denegado - usa POST con Authorization header" },
      { status: 403 }
    );
  }

  return POST(request);
}
