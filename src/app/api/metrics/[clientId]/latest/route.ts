import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * API Route para obtener las últimas métricas de un cliente
 * GET /api/metrics/[clientId]/latest?limit=5
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // 1. Validar sesión
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 2. Obtener parámetros
    const { clientId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    // 3. Obtener últimas métricas
    const metrics = await db.clientMetric.findMany({
      where: {
        clientId,
      },
      orderBy: {
        fetchedAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        platform: true,
        metricName: true,
        value: true,
        date: true,
        fetchedAt: true,
      },
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error al obtener métricas:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al obtener métricas" },
      { status: 500 }
    );
  }
}

