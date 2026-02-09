import { NextRequest, NextResponse } from "next/server";
import { checkAndMarkOverdueInvoices, checkPaymentAlerts72Hours } from "@/lib/finance-cobranza-service";

/**
 * API Route para ejecutar cobranza checks diariamente
 * - Marca facturas como OVERDUE cuando dueDate < hoy
 * - Alerta 72h después del vencimiento para cobro inmediato
 * 
 * Schedule: Diariamente a las 9am Ecuador (14:00 UTC)
 * O ejecutar manualmente con: POST /api/cron/cobranza-check
 */
export async function POST(request: NextRequest) {
  try {
    // Seguridad: verificar Vercel Cron o secret válido
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get("x-vercel-cron-id");

    if (!vercelCronHeader && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      console.warn("⚠️ Acceso no autorizado a /api/cron/cobranza-check");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    console.log("🕐 Ejecutando cobranza checks (9am)...");

    // 1. Marcar facturas OVERDUE
    const overdueResult = await checkAndMarkOverdueInvoices();

    // 2. Alertas críticas 72h
    const alertsResult = await checkPaymentAlerts72Hours();

    return NextResponse.json({
      success: true,
      message: "Cobranza checks completados",
      data: {
        overdue: overdueResult,
        alerts72h: alertsResult,
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error en cron cobranza-check:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// Permitir GET para testing manual
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
