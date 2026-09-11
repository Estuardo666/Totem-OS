import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { refreshAgencyMetaToken } from "@/lib/meta/token-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Renueva el token de larga duración de Meta antes de que venza.
 *
 * NO está programada: el plan Hobby solo admite dos cron jobs, así que la
 * renovación va integrada dentro de /api/cron/sync-social-metrics, que corre
 * a diario. Esta ruta queda como disparador manual, para forzar una renovación
 * o para verificar el flujo sin esperar a la corrida nocturna.
 */
function authorized(request: NextRequest, secretParam?: string | null): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    vercelCronHeader: request.headers.get("x-vercel-cron-id"),
    secretParam,
    cronSecret: process.env.CRON_SECRET,
  });
}

async function run() {
  const result = await refreshAgencyMetaToken();

  return NextResponse.json({
    success: true,
    refreshed: result.refreshed,
    mode: result.mode ?? null,
    expiresAt: result.expiresAt?.toISOString() ?? null,
    pageTokensRenewed: result.pageTokensRenewed ?? 0,
    unmatchedClients: result.unmatchedClients ?? [],
    reason: result.reason ?? null,
    executedAt: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    console.warn("⚠️ Acceso no autorizado a /api/cron/refresh-social-tokens");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return await run();
  } catch (error) {
    console.error("Error al renovar tokens sociales:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * Variante GET para prueba manual: /api/cron/refresh-social-tokens?secret=...
 * Acepta también el mismo header Bearer que el POST.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request, request.nextUrl.searchParams.get("secret"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return await run();
  } catch (error) {
    console.error("Error al renovar tokens sociales:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
