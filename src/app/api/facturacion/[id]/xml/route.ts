// API Route: Descargar XML de una factura
// GET /api/facturacion/[id]/xml

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";

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
      select: {
        xmlSriResponse: true,
        secuencial: true,
        estado: true,
      },
    });

    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    if (!factura.xmlSriResponse) {
      return NextResponse.json(
        { error: "XML no disponible. La factura aún no ha sido procesada." },
        { status: 404 }
      );
    }

    return new NextResponse(factura.xmlSriResponse, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${factura.secuencial}.xml"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
