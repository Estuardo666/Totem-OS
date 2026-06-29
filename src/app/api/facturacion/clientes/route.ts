// API Route: Clientes para facturación (búsqueda)
// GET /api/facturacion/clientes

import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";

export async function GET() {
  try {
    const clientes = await prisma.client.findMany({
      where: { status: { not: "INACTIVE" } },
      select: {
        id: true,
        name: true,
        email: true,
        numeroIdentificacion: true,
        razonSocial: true,
        direccionFiscal: true,
        emailFacturacion: true,
        tipoIdentificacion: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
