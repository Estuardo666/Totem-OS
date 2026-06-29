// API Route: Descargar PDF (RIDE) de una factura
// GET /api/facturacion/[id]/pdf

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
        rideUrl: true,
        secuencial: true,
      },
    });

    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    if (!factura.rideUrl) {
      return NextResponse.json(
        { error: "RIDE no disponible. La factura aún no ha sido procesada." },
        { status: 404 }
      );
    }

    // Redirigir a la URL del RIDE (UploadThing o storage)
    return NextResponse.redirect(factura.rideUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
