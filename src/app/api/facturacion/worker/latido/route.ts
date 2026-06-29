// API Route: Latido del worker
// POST /api/facturacion/worker/latido - El worker envía su estado periódicamente
// GET /api/facturacion/worker/latido - La UI consulta el estado del worker

import { NextRequest, NextResponse } from "next/server";
import { registrarLatido, getWorkerStatus } from "@/services/facturacion/configuracion-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workerId, modo, hostname, version, sriAmbiente, sriAlcanzable } = body;

    if (!workerId || !modo || !hostname) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: workerId, modo, hostname" },
        { status: 400 }
      );
    }

    await registrarLatido({
      workerId,
      modo,
      hostname,
      version,
      sriAmbiente: sriAmbiente ?? "1",
      sriAlcanzable: sriAlcanzable ?? false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await getWorkerStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
