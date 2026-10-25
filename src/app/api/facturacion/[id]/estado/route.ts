// API Route: Estado de una factura (SSE para polling en tiempo real)
// GET /api/facturacion/[id]/estado

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/sri/database";

import { auth } from "@/auth";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.roleLegacy !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const factura = await prisma.electronicInvoice.findUnique({
      where: { id },
      include: {
        items: true,
        client: { select: { name: true } },
        notasCredito: { select: { id: true, secuencial: true, estado: true, motivo: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    const { notasCredito, ...detail } = factura;
    return NextResponse.json({ ...detail, creditNote: notasCredito[0] ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
