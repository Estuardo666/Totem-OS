import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { runClientSync } from "@/lib/meta/sync-orchestrator";
import { refreshAgencyMetaToken } from "@/lib/meta/token-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Renueva el token de Meta y sincroniza las métricas de todos los clientes.
 *
 * Vercel: { "path": "/api/cron/sync-social-metrics", "schedule": "0 9 * * *" }
 * (04:00 en Ecuador, UTC-5)
 *
 * Renovación y sincronización van juntas en una sola ruta a propósito: el plan
 * Hobby de Vercel permite solo dos cron jobs y con granularidad diaria, así que
 * gastar dos ranuras en esto no es viable. Además el orden importa —el token
 * debe renovarse antes de usarse— y tenerlos en la misma función lo garantiza
 * sin depender de que dos horarios no se solapen.
 *
 * Recorre los clientes en línea, sin cola: unos 9s por cliente entran holgados
 * en los 300s de la función. Si el catálogo crece más allá de ~25 clientes,
 * conviene mover esto a un modelo de trabajos en segundo plano.
 */

/** Margen antes del límite de la función para cortar de forma ordenada. */
const TIME_BUDGET_MS = 240_000;

function authorized(request: NextRequest, secretParam?: string | null): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    vercelCronHeader: request.headers.get("x-vercel-cron-id"),
    secretParam,
    cronSecret: process.env.CRON_SECRET,
  });
}

async function run(offset: number, days: number) {
  const startedAt = Date.now();

  // 1. Renovar el token antes de usarlo. Un fallo aquí no aborta la corrida:
  //    el token vigente probablemente siga siendo válido varias semanas más.
  let tokenRefresh;
  try {
    const refreshed = await refreshAgencyMetaToken();
    tokenRefresh = {
      refreshed: refreshed.refreshed,
      mode: refreshed.mode ?? null,
      expiresAt: refreshed.expiresAt?.toISOString() ?? null,
      pageTokensRenewed: refreshed.pageTokensRenewed ?? 0,
      // Clientes cuya página no apareció entre las gestionadas. Con un usuario
      // del sistema significa que falta asignar ese activo en Business Manager.
      unmatchedClients: refreshed.unmatchedClients ?? [],
      reason: refreshed.reason ?? null,
    };
  } catch (error) {
    tokenRefresh = {
      refreshed: false,
      reason: error instanceof Error ? error.message : "Error al renovar el token",
    };
  }

  // 2. Solo clientes con alguna credencial social: el resto no tiene nada que traer.
  const clients = await db.client.findMany({
    where: {
      status: { not: "INACTIVE" },
      OR: [
        { facebookPageId: { not: null } },
        { instagramBusinessId: { not: null } },
        { tiktokOpenId: { not: null } },
        { adAccounts: { some: { isActive: true } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    skip: offset,
  });

  const results: Array<{
    clientId: string;
    name: string;
    total: number;
    platforms: unknown;
    error?: string;
  }> = [];

  let partial = false;
  const remaining: string[] = [];

  for (const [index, client] of clients.entries()) {
    // Corta antes de que la plataforma mate la función a mitad de escritura.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      partial = true;
      remaining.push(...clients.slice(index).map((c) => c.id));
      break;
    }

    const outcome = await runClientSync(client.id, { days });

    results.push({
      clientId: client.id,
      name: client.name,
      total: outcome.data?.total ?? 0,
      platforms: outcome.data?.results ?? [],
      ...(outcome.success ? {} : { error: outcome.error }),
    });
  }

  return NextResponse.json({
    success: true,
    tokenRefresh,
    clientsProcessed: results.length,
    partial,
    // Con ?offset=N se puede terminar a mano una corrida cortada.
    nextOffset: partial ? offset + results.length : null,
    remaining,
    results,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  });
}

function readParams(request: NextRequest) {
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const days = Number(request.nextUrl.searchParams.get("days") ?? 28);

  return {
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
    days: Number.isInteger(days) && days >= 1 && days <= 90 ? days : 28,
  };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    console.warn("⚠️ Acceso no autorizado a /api/cron/sync-social-metrics");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { offset, days } = readParams(request);
    return await run(offset, days);
  } catch (error) {
    console.error("Error al sincronizar métricas sociales:", error);
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
 * Variante GET para prueba y diagnóstico manual:
 * /api/cron/sync-social-metrics?secret=...&offset=0&days=28
 */
export async function GET(request: NextRequest) {
  if (!authorized(request, request.nextUrl.searchParams.get("secret"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { offset, days } = readParams(request);
    return await run(offset, days);
  } catch (error) {
    console.error("Error al sincronizar métricas sociales:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
