// API Route: Descargar PDF (RIDE) de una factura
// GET /api/facturacion/[id]/pdf

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/sri/database";

import { auth } from "@/auth";
import { generarRideFactura } from "@/lib/sri/invoice-ride";
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
      include: { items: true },
    });

    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    if (!factura.rideUrl) {
      if (!["AUTORIZADA", "ANULADA"].includes(factura.estado)) return NextResponse.json({ error: "La factura todavía no está autorizada." }, { status: 409 });
      const config = await prisma.companyConfig.findFirst();
      if (!config) return NextResponse.json({ error: "Emisor no configurado" }, { status: 409 });
      const pdf = await generarRideFactura(factura, config);
      return new NextResponse(new Uint8Array(pdf), { headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${factura.secuencial}.pdf"`,
        "Cache-Control": "private, no-store",
      } });
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
