// Servicio de gestión de la cola de trabajos SRI (SriJob)

import { db as prisma } from "@/lib/db";
import type { SriJob } from "@prisma/client";

/**
 * Crea un nuevo trabajo en la cola.
 */
export async function enqueueJob(data: {
  type: string;
  facturaId?: string;
  notaCreditoId?: string;
  retencionId?: string;
  payload?: Record<string, unknown>;
}): Promise<SriJob> {
  return prisma.sriJob.create({
    data: {
      type: data.type,
      facturaId: data.facturaId,
      notaCreditoId: data.notaCreditoId,
      retencionId: data.retencionId,
      payload: data.payload ? JSON.stringify(data.payload) : null,
      status: "PENDING",
    },
  });
}

/**
 * Toma el siguiente trabajo pendiente de la cola (atómico con FOR UPDATE SKIP LOCKED).
 * Solo el worker debe llamar esta función.
 */
export async function dequeueJob(): Promise<SriJob | null> {
  // Usar transacción para atomicidad
  return prisma.$transaction(async (tx) => {
    // Buscar el siguiente job disponible
    const job = await tx.$queryRaw<SriJob[]>`
      SELECT * FROM "SriJob"
      WHERE "status" = 'PENDING'
        AND ("disponibleAt" IS NULL OR "disponibleAt" <= NOW())
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (!job || job.length === 0) return null;

    const found = job[0];

    // Marcar como RUNNING
    await tx.sriJob.update({
      where: { id: found.id },
      data: { status: "RUNNING" },
    });

    return { ...found, status: "RUNNING" };
  });
}

/**
 * Marca un trabajo como completado.
 */
export async function completeJob(
  jobId: string,
  resultado?: Record<string, unknown>
): Promise<void> {
  await prisma.sriJob.update({
    where: { id: jobId },
    data: {
      status: "DONE",
      resultado: resultado ? JSON.stringify(resultado) : null,
      procesadoAt: new Date(),
    },
  });
}

/**
 * Marca un trabajo como fallido. Si quedan reintentos, lo reprograma con backoff.
 */
export async function failJob(
  jobId: string,
  error: string,
  maxReintentos = 3
): Promise<void> {
  const job = await prisma.sriJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const nuevosIntentos = job.intentos + 1;

  if (nuevosIntentos < maxReintentos) {
    // Reprogramar con backoff exponencial: 30s, 2min, 5min
    const backoffMs = [30000, 120000, 300000][nuevosIntentos] ?? 300000;

    await prisma.sriJob.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        intentos: nuevosIntentos,
        error,
        disponibleAt: new Date(Date.now() + backoffMs),
      },
    });
  } else {
    // Sin reintentos restantes
    await prisma.sriJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        intentos: nuevosIntentos,
        error,
        procesadoAt: new Date(),
      },
    });
  }
}

/**
 * Obtiene el conteo de jobs por estado.
 */
export async function getJobStats(): Promise<{
  pending: number;
  running: number;
  done: number;
  failed: number;
}> {
  const [pending, running, done, failed] = await Promise.all([
    prisma.sriJob.count({ where: { status: "PENDING" } }),
    prisma.sriJob.count({ where: { status: "RUNNING" } }),
    prisma.sriJob.count({ where: { status: "DONE" } }),
    prisma.sriJob.count({ where: { status: "FAILED" } }),
  ]);

  return { pending, running, done, failed };
}

/**
 * Obtiene jobs recientes con sus comprobantes asociados.
 */
export async function getRecentJobs(limit = 20) {
  return prisma.sriJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      factura: {
        select: { secuencial: true, estado: true, razonSocial: true, importeTotal: true },
      },
      notaCredito: {
        select: { secuencial: true, estado: true },
      },
      retencion: {
        select: { secuencial: true, estado: true },
      },
    },
  });
}
