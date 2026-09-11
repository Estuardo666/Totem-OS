// API Route: Tareas de contenido de un cliente (para información adicional de la factura)
// GET /api/facturacion/tareas?clientId=...&desde=...&hasta=...

import { NextResponse, type NextRequest } from "next/server";
import { db as prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.roleLegacy !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!clientId) {
    return NextResponse.json({ error: "clientId es requerido" }, { status: 400 });
  }

  try {
    const rangoFecha =
      desde || hasta
        ? {
            ...(desde ? { gte: new Date(desde) } : {}),
            ...(hasta ? { lte: new Date(hasta) } : {}),
          }
        : undefined;

    const tareas = await prisma.contentTask.findMany({
      where: {
        clientId,
        ...(rangoFecha ? { createdAt: rangoFecha } : {}),
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        publishedAt: true,
        scheduledAt: true,
        createdAt: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json(tareas);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
