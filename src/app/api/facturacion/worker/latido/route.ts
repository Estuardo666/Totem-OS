// API Route: Latido del worker
// POST /api/facturacion/worker/latido - El worker envía su estado periódicamente
// GET /api/facturacion/worker/latido - La UI consulta el estado del worker

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { registrarLatido, getWorkerStatus } from "@/services/facturacion/configuracion-service";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";

const workerHeartbeatSchema = z.object({
  workerId: z.string().trim().min(1).max(128),
  modo: z.enum(["LOCAL", "NUBE"]),
  hostname: z.string().trim().min(1).max(255),
  version: z.string().trim().min(1).max(64).optional(),
  sriAmbiente: z.enum(["1", "2"]).default("1"),
  sriAlcanzable: z.boolean().default(false),
}).strict();

export async function POST(request: NextRequest) {
  try {
    if (!isWorkerRequestAuthorized(
      request.headers.get("authorization"),
      process.env.FACTURACION_WORKER_SECRET
    )) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const parsed = workerHeartbeatSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Latido invalido", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await registrarLatido(parsed.data);

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
    const session = await auth();
    const role = session?.user?.roleLegacy ?? session?.user?.role;
    if (!session?.user?.id || role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const status = await getWorkerStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
