// API Route: Estado de una factura (SSE para polling en tiempo real)
// GET /api/facturacion/[id]/estado

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const factura = await prisma.electronicInvoice.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        secuencial: true,
        claveAcceso: true,
        numeroAutorizacion: true,
        fechaAutorizacion: true,
        ultimoErrorSri: true,
        codigoErrorSri: true,
        intentosSri: true,
        rideUrl: true,
        xmlUrl: true,
        updatedAt: true,
      },
    });

    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    return NextResponse.json(factura);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
