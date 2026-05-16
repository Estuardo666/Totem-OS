"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { upsertClientMonthlyStrategySchema } from "@/schemas/content-strategy";
import type { ApiResponse } from "@/types";
import type { ContentMonthlyStrategyRecord } from "@/components/features/content/content-accounts-utils";

function serializeStrategy(strategy: {
  id: string;
  clientId: string;
  month: number;
  year: number;
  prepared: boolean;
  sentAt: Date | null;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ContentMonthlyStrategyRecord {
  return {
    id: strategy.id,
    clientId: strategy.clientId,
    month: strategy.month,
    year: strategy.year,
    prepared: strategy.prepared,
    sentAt: strategy.sentAt,
    approved: strategy.approved,
    createdAt: strategy.createdAt,
    updatedAt: strategy.updatedAt,
  };
}

export async function getContentMonthlyStrategies(): Promise<ApiResponse<ContentMonthlyStrategyRecord[]>> {
  try {
    const strategies = await db.clientMonthlyStrategy.findMany({
      select: {
        id: true,
        clientId: true,
        month: true,
        year: true,
        prepared: true,
        sentAt: true,
        approved: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }],
    });

    return {
      success: true,
      data: strategies.map(serializeStrategy),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cargar estrategias mensuales",
    };
  }
}

export async function upsertContentMonthlyStrategy(
  input: unknown
): Promise<ApiResponse<ContentMonthlyStrategyRecord>> {
  try {
    const validatedData = upsertClientMonthlyStrategySchema.parse(input);

    const strategy = await db.clientMonthlyStrategy.upsert({
      where: {
        clientId_month_year: {
          clientId: validatedData.clientId,
          month: validatedData.month,
          year: validatedData.year,
        },
      },
      create: validatedData,
      update: {
        prepared: validatedData.prepared,
        sentAt: validatedData.sentAt,
        approved: validatedData.approved,
      },
      select: {
        id: true,
        clientId: true,
        month: true,
        year: true,
        prepared: true,
        sentAt: true,
        approved: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    revalidatePath("/content");

    return {
      success: true,
      data: serializeStrategy(strategy),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar la estrategia mensual",
    };
  }
}