"use server";

import { db } from "./db.ts";
import { clientMonthlyClosureSchema } from "../schemas/finance.ts";
import type { ApiResponse } from "../types/index.ts";

export type MonthlyClosureAccrualStatus = "FULL" | "PARTIAL" | "NONE";
export type MonthlyClosureRecommendation = "FULL" | "PARTIAL" | "NONE";

export type MonthlyClosureEvidenceSummary = {
  publishedTasks: number;
  approvedTasks: number;
  completedShoots: number;
  trackedHours: number;
  publishedReels: number;
  publishedFlyers: number;
  approvedReels: number;
  approvedFlyers: number;
};

export type MonthlyClosureOverrideRow = {
  clientId: string;
  year: number;
  month: number;
  accrualStatus: MonthlyClosureAccrualStatus;
  accruedAmount: number;
};

export type ClientMonthlyClosureListItem = {
  clientId: string;
  clientName: string;
  clientLogo?: string | null;
  clientStatus: string;
  monthlyRate: number;
  paymentDay: number | null;
  monthlyReels: number;
  monthlyFlyers: number;
  evidence: MonthlyClosureEvidenceSummary;
  paidThisMonth: number;
  recommendation: {
    status: MonthlyClosureRecommendation;
    amount: number;
    reason: string;
  };
  closure: null | {
    id: string;
    accrualStatus: MonthlyClosureAccrualStatus;
    accruedAmount: number;
    notes: string | null;
    approvedAt: Date | null;
    approvedByName: string | null;
  };
};

export type ClientMonthlyClosurePageData = {
  period: {
    year: number;
    month: number;
    value: string;
    label: string;
  };
  items: ClientMonthlyClosureListItem[];
};

type ClientForRecommendation = {
  id: string;
  name: string;
  logo: string | null;
  status: string;
  monthlyRate: number;
  paymentDay: number | null;
  monthlyReels: number;
  monthlyFlyers: number;
};

function buildPeriodValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildPeriodLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function getPeriodRange(year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return { monthStart, monthEnd };
}

function createEmptyEvidence(): MonthlyClosureEvidenceSummary {
  return {
    publishedTasks: 0,
    approvedTasks: 0,
    completedShoots: 0,
    trackedHours: 0,
    publishedReels: 0,
    publishedFlyers: 0,
    approvedReels: 0,
    approvedFlyers: 0,
  };
}

function getEquivalentReels(evidence: MonthlyClosureEvidenceSummary) {
  return evidence.publishedReels + evidence.approvedReels;
}

function getEquivalentFlyers(evidence: MonthlyClosureEvidenceSummary) {
  return evidence.publishedFlyers + evidence.approvedFlyers;
}

function buildRecommendation(
  client: ClientForRecommendation,
  evidence: MonthlyClosureEvidenceSummary
): ClientMonthlyClosureListItem["recommendation"] {
  const hasRecurringPlan = client.monthlyRate > 0 && client.paymentDay !== null && client.status !== "PAUSED";

  if (!hasRecurringPlan) {
    return {
      status: "NONE",
      amount: 0,
      reason: "El cliente no tiene un fee recurrente activo para cerrar por devengo.",
    };
  }

  const hasOperationalEvidence =
    evidence.publishedTasks > 0 ||
    evidence.approvedTasks > 0 ||
    evidence.completedShoots > 0 ||
    evidence.trackedHours > 0;

  if (!hasOperationalEvidence) {
    return {
      status: "NONE",
      amount: 0,
      reason: "No hay publicaciones, aprobaciones, rodajes ni horas registradas en el período.",
    };
  }

  const reelsSatisfied = client.monthlyReels <= 0 || getEquivalentReels(evidence) >= client.monthlyReels;
  const flyersSatisfied = client.monthlyFlyers <= 0 || getEquivalentFlyers(evidence) >= client.monthlyFlyers;

  if (reelsSatisfied && flyersSatisfied) {
    return {
      status: "FULL",
      amount: client.monthlyRate,
      reason: "Hay evidencia operativa suficiente para reconocer el fee mensual completo.",
    };
  }

  return {
    status: "PARTIAL",
    amount: client.monthlyRate,
    reason: "Sí hubo trabajo en el mes, pero el cumplimiento del plan no luce completo. Conviene revisar devengo parcial o total según el acuerdo con el cliente.",
  };
}

async function collectEvidenceByClient(clientIds: string[], year: number, month: number) {
  const evidenceMap = new Map<string, MonthlyClosureEvidenceSummary>(
    clientIds.map((clientId) => [clientId, createEmptyEvidence()])
  );

  if (clientIds.length === 0) {
    return evidenceMap;
  }

  const { monthStart, monthEnd } = getPeriodRange(year, month);

  const [tasks, shoots, timeEntries] = await Promise.all([
    db.contentTask.findMany({
      where: {
        clientId: { in: clientIds },
        OR: [
          {
            status: "PUBLISHED",
            publishedAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          {
            status: { in: ["APPROVED", "CLIENT_APPROVED"] },
            updatedAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        ],
      },
      select: {
        clientId: true,
        type: true,
        status: true,
      },
    }),
    db.shoot.findMany({
      where: {
        clientId: { in: clientIds },
        status: "COMPLETED",
        endTime: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        clientId: true,
      },
    }),
    db.timeEntry.findMany({
      where: {
        clientId: { in: clientIds },
        status: { in: ["COMPLETED", "MANUAL"] },
        startTime: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        clientId: true,
        duration: true,
      },
    }),
  ]);

  for (const task of tasks) {
    const evidence = evidenceMap.get(task.clientId);
    if (!evidence) continue;

    if (task.status === "PUBLISHED") {
      evidence.publishedTasks += 1;
      if (task.type === "REEL") evidence.publishedReels += 1;
      if (task.type === "FLYER") evidence.publishedFlyers += 1;
    }

    if (task.status === "APPROVED" || task.status === "CLIENT_APPROVED") {
      evidence.approvedTasks += 1;
      if (task.type === "REEL") evidence.approvedReels += 1;
      if (task.type === "FLYER") evidence.approvedFlyers += 1;
    }
  }

  for (const shoot of shoots) {
    const evidence = evidenceMap.get(shoot.clientId);
    if (!evidence) continue;
    evidence.completedShoots += 1;
  }

  for (const timeEntry of timeEntries) {
    const clientId = timeEntry.clientId ?? null;
    if (!clientId) continue;
    const evidence = evidenceMap.get(clientId);
    if (!evidence) continue;
    evidence.trackedHours += (timeEntry.duration ?? 0) / 3600;
  }

  for (const evidence of evidenceMap.values()) {
    evidence.trackedHours = Number(evidence.trackedHours.toFixed(2));
  }

  return evidenceMap;
}

async function collectPaidAmountsByClient(clientIds: string[], year: number, month: number) {
  const paidMap = new Map<string, number>(clientIds.map((clientId) => [clientId, 0]));

  if (clientIds.length === 0) {
    return paidMap;
  }

  const { monthStart, monthEnd } = getPeriodRange(year, month);

  const [invoices, transactions] = await Promise.all([
    db.invoice.findMany({
      where: {
        clientId: { in: clientIds },
        status: "PAID",
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        clientId: true,
        amount: true,
      },
    }),
    db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { relatedClientId: { in: clientIds } },
          { clientId: { in: clientIds } },
        ],
      },
      select: {
        relatedClientId: true,
        clientId: true,
        amount: true,
      },
    }),
  ]);

  for (const invoice of invoices) {
    paidMap.set(invoice.clientId, (paidMap.get(invoice.clientId) ?? 0) + invoice.amount);
  }

  for (const transaction of transactions) {
    const clientId = transaction.relatedClientId ?? transaction.clientId ?? null;
    if (!clientId) continue;
    paidMap.set(clientId, (paidMap.get(clientId) ?? 0) + transaction.amount);
  }

  return paidMap;
}

export async function getClientMonthlyClosureRows(
  clientIds: string[],
  input: { maxYear: number; maxMonth: number }
): Promise<MonthlyClosureOverrideRow[]> {
  if (clientIds.length === 0) {
    return [];
  }

  const rows = await db.clientMonthlyClosure.findMany({
    where: {
      clientId: { in: clientIds },
      OR: [
        { year: { lt: input.maxYear } },
        {
          year: input.maxYear,
          month: { lte: input.maxMonth },
        },
      ],
    },
    select: {
      clientId: true,
      year: true,
      month: true,
      accrualStatus: true,
      accruedAmount: true,
    },
  });

  return rows as MonthlyClosureOverrideRow[];
}

export async function getClientMonthlyClosuresFromDb(
  year: number,
  month: number
): Promise<ApiResponse<ClientMonthlyClosurePageData>> {
  try {
    const clients = await db.client.findMany({
      where: {
        status: { not: "INACTIVE" },
      },
      select: {
        id: true,
        name: true,
        logo: true,
        status: true,
        monthlyRate: true,
        paymentDay: true,
        monthlyReels: true,
        monthlyFlyers: true,
      },
      orderBy: { name: "asc" },
    });

    const clientIds = clients.map((client) => client.id);
    const [evidenceMap, paidMap, closures] = await Promise.all([
      collectEvidenceByClient(clientIds, year, month),
      collectPaidAmountsByClient(clientIds, year, month),
      db.clientMonthlyClosure.findMany({
        where: { year, month },
        include: {
          approvedBy: {
            select: { name: true },
          },
        },
      }),
    ]);

    const closureMap = new Map(closures.map((closure) => [`${closure.clientId}-${closure.year}-${closure.month}`, closure]));

    const items: ClientMonthlyClosureListItem[] = clients.map((client) => {
      const evidence = evidenceMap.get(client.id) ?? createEmptyEvidence();
      const recommendation = buildRecommendation(client, evidence);
      const closure = closureMap.get(`${client.id}-${year}-${month}`) ?? null;

      return {
        clientId: client.id,
        clientName: client.name,
        clientLogo: client.logo,
        clientStatus: client.status,
        monthlyRate: client.monthlyRate,
        paymentDay: client.paymentDay,
        monthlyReels: client.monthlyReels,
        monthlyFlyers: client.monthlyFlyers,
        evidence,
        paidThisMonth: paidMap.get(client.id) ?? 0,
        recommendation,
        closure: closure
          ? {
              id: closure.id,
              accrualStatus: closure.accrualStatus as MonthlyClosureAccrualStatus,
              accruedAmount: closure.accruedAmount,
              notes: closure.notes,
              approvedAt: closure.approvedAt,
              approvedByName: closure.approvedBy?.name ?? null,
            }
          : null,
      };
    });

    return {
      success: true,
      data: {
        period: {
          year,
          month,
          value: buildPeriodValue(year, month),
          label: buildPeriodLabel(year, month),
        },
        items,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener los cierres mensuales por cliente",
    };
  }
}

export async function upsertClientMonthlyClosureFromDb(
  input: unknown,
  approvedById: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const validatedData = clientMonthlyClosureSchema.parse(input);

    const client = await db.client.findUnique({
      where: { id: validatedData.clientId },
      select: {
        id: true,
        name: true,
        logo: true,
        status: true,
        monthlyRate: true,
        paymentDay: true,
        monthlyReels: true,
        monthlyFlyers: true,
      },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado" };
    }

    const evidenceMap = await collectEvidenceByClient([validatedData.clientId], validatedData.year, validatedData.month);
    const evidence = evidenceMap.get(validatedData.clientId) ?? createEmptyEvidence();
    const recommendation = buildRecommendation(client, evidence);

    const closure = await db.clientMonthlyClosure.upsert({
      where: {
        clientId_year_month: {
          clientId: validatedData.clientId,
          year: validatedData.year,
          month: validatedData.month,
        },
      },
      create: {
        clientId: validatedData.clientId,
        year: validatedData.year,
        month: validatedData.month,
        accrualStatus: validatedData.accrualStatus,
        accruedAmount: validatedData.accruedAmount,
        notes: validatedData.notes ?? null,
        recommendation: recommendation.status,
        recommendationReason: recommendation.reason,
        evidenceSummary: JSON.stringify(evidence),
        approvedById,
        approvedAt: new Date(),
      },
      update: {
        accrualStatus: validatedData.accrualStatus,
        accruedAmount: validatedData.accruedAmount,
        notes: validatedData.notes ?? null,
        recommendation: recommendation.status,
        recommendationReason: recommendation.reason,
        evidenceSummary: JSON.stringify(evidence),
        approvedById,
        approvedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    return { success: true, data: closure };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar el cierre mensual del cliente",
    };
  }
}
