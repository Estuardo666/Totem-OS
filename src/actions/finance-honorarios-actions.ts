"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export interface HonorariosUserRow {
  userId: string;
  userName: string;
  userImage: string | null;
  salaryType: string;
  baseSalary: number;
  profitSharePercent: number | null;
  paidThisMonth: number;
  remaining: number;
}

export async function getHonorariosOverview(
  month?: number,
  year?: number
): Promise<ApiResponse<HonorariosUserRow[]>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        salaryType: true,
        baseSalary: true,
        profitSharePercent: true,
      },
      orderBy: { name: "asc" },
    });

    // Get all HONORARIOS + SALARY EXPENSE transactions paid this month
    const paidTx = await db.transaction.findMany({
      where: {
        status: "PAID",
        createdAt: { gte: monthStart, lte: monthEnd },
        OR: [
          { type: "HONORARIOS" },
          { type: "EXPENSE", category: "SALARY" },
        ],
      },
      select: { userId: true, amount: true },
    });

    const paidByUser = new Map<string, number>();
    for (const tx of paidTx) {
      if (tx.userId) {
        paidByUser.set(tx.userId, (paidByUser.get(tx.userId) ?? 0) + tx.amount);
      }
    }

    const rows: HonorariosUserRow[] = users.map((u) => {
      const baseSalary = u.baseSalary ?? 0;
      const paidThisMonth = paidByUser.get(u.id) ?? 0;
      const remaining = Math.max(0, baseSalary - paidThisMonth);

      return {
        userId: u.id,
        userName: u.name,
        userImage: u.image,
        salaryType: u.salaryType,
        baseSalary,
        profitSharePercent: u.profitSharePercent,
        paidThisMonth: Math.round(paidThisMonth * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
      };
    });

    return { success: true, data: rows };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener resumen de honorarios",
    };
  }
}

export async function updateUserHonorarios(
  userId: string,
  baseSalary: number
): Promise<ApiResponse<void>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    await db.user.update({
      where: { id: userId },
      data: { baseSalary },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar honorarios",
    };
  }
}
