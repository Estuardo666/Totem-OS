import { NextRequest, NextResponse } from "next/server";
import { createMonthlyPaymentTransactions } from "@/lib/finance-logic";
import { autoContributeFromClose } from "@/lib/finance-emergency-fund-service";
import { isAuthorizedCron, isAuthorizedCronSecretHeader } from "@/lib/cron-auth";

/**
 * Acepta el Bearer estándar o el header legacy `x-cron-secret`. Antes, sin
 * CRON_SECRET la ruta quedaba abierta a cualquiera; ahora falla cerrado.
 */
function isAuthorized(request: NextRequest) {
  return isAuthorizedCron(request) || isAuthorizedCronSecretHeader(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await createMonthlyPaymentTransactions();

    // Auto-contribute to emergency fund if enabled
    let fundResult = null;
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const { getProfitPreview } = await import("@/lib/finance-profit-service");
      const preview = await getProfitPreview(currentYear, currentMonth);

      if (preview.success && preview.data && preview.data.netProfit > 0) {
        fundResult = await autoContributeFromClose(
          currentYear,
          currentMonth,
          preview.data.netProfit
        );
      }
    } catch (fundError) {
      console.error("Error en auto-contribution al fondo:", fundError);
    }

    return NextResponse.json({
      success: true,
      ...result,
      emergencyFund: fundResult?.success ? fundResult.data : null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
