"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { endOfMonth, startOfMonth } from "date-fns";

export type CurrentMonthTaskSummary = {
  totalTasks: number;
  publishedTasks: number;
  reelsCount: number;
  flyerCount: number;
};

const currentMonthTaskWhere = (currentMonthStart: Date, currentMonthEnd: Date) => ({
  OR: [
    {
      scheduledAt: {
        gte: currentMonthStart,
        lte: currentMonthEnd,
      },
    },
    {
      scheduledAt: null,
      dueDate: {
        gte: currentMonthStart,
        lte: currentMonthEnd,
      },
    },
    {
      scheduledAt: null,
      dueDate: null,
      createdAt: {
        gte: currentMonthStart,
        lte: currentMonthEnd,
      },
    },
  ],
});

export async function getCurrentMonthTaskSummary(): Promise<ApiResponse<CurrentMonthTaskSummary>> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autenticado" };
  }

  if (session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  try {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const [totalTasks, publishedTasks, reelsCount, flyerCount] = await Promise.all([
      db.contentTask.count({
        where: currentMonthTaskWhere(currentMonthStart, currentMonthEnd),
      }),
      db.contentTask.count({
        where: {
          status: "PUBLISHED",
          publishedAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
      }),
      db.contentTask.count({
        where: {
          ...currentMonthTaskWhere(currentMonthStart, currentMonthEnd),
          type: "REEL",
        },
      }),
      db.contentTask.count({
        where: {
          ...currentMonthTaskWhere(currentMonthStart, currentMonthEnd),
          type: "FLYER",
        },
      }),
    ]);

    return {
      success: true,
      data: {
        totalTasks,
        publishedTasks,
        reelsCount,
        flyerCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener métricas del mes actual",
    };
  }
}
