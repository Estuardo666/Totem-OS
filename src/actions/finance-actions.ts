"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { createInvoiceSchema, createExpenseSchema, updateExpenseSchema, updateTransactionSchema, updateInvoiceSchema, createTransactionSchema, updateUserSalaryConfigSchema, processSalaryPaymentSchema } from "@/schemas/finance";
import type { ApiResponse } from "@/types";
import type { Invoice, Expense, Transaction, User } from "@prisma/client";
import { sendNotification } from "./notification-actions";

export interface FinancialStats {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  incomeDeltaPct?: number;
  expensesDeltaPct?: number;
  netProfitDeltaPct?: number;
  marginDeltaPct?: number;
  pendingReimbursementsDeltaPct?: number;
  honorariosDeltaPct?: number;
  recentTransactions: Array<{
    id: string;
    type: "INCOME" | "EXPENSE" | "HONORARIOS";
    amount: number;
    description: string;
    date: Date;
    clientName?: string;
    status?: string;
    category?: string;
    sourceType?: "INVOICE" | "EXPENSE" | "TRANSACTION"; // Tipo de origen de la transacción
    assignedToName?: string; // Para reembolsos
    assignedToId?: string; // Para reembolsos
    userId?: string; // Para honorarios/propietario
  }>;
  // Campos específicos para EDITOR
  pendingReimbursements?: number; // Gastos pendientes de reembolso
  honorariosReceived?: number; // Honorarios recibidos en el mes
}

export interface MonthlyProfitability {
  month: string; // Formato: "Enero 2025"
  monthKey: string; // Formato: "2025-01"
  income: number;
  expenses: number;
  profit: number;
}

export interface GlobalProfitabilityStats {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number; // Porcentaje
  monthlyData: MonthlyProfitability[];
  partnerDistribution: {
    stuart: number;
    paty: number;
  };
}

export interface StrategicClientPlan {
  id: string;
  name: string;
  status: string;
  monthlyRate: number;
  monthlyReels: number;
  monthlyShoots: number;
}

export async function getStrategicClientPlans(): Promise<ApiResponse<StrategicClientPlan[]>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;
    const isEditor = userRole === "EDITOR";

    const clients = await db.client.findMany({
      where: {
        ...(isEditor && userId ? { editorId: userId } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        monthlyRate: true,
        monthlyReels: true,
        monthlyShoots: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: clients };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cargar planes de clientes",
    };
  }
}

/**
 * Server Action para obtener estadísticas financieras
 * Calcula ingresos, gastos, beneficio neto y últimas transacciones
 * Si el usuario no es ADMIN, filtra solo sus transacciones
 */
export async function getFinancialStats(): Promise<ApiResponse<FinancialStats>> {
  try {
    // Obtener sesión del usuario
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;
    const isAdmin = userRole === "ADMIN";

    // Obtener el mes actual para calcular ingresos del mes
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Obtener todas las facturas pagadas del mes actual
    // Non-ADMIN no ve facturas (solo ADMIN)
    const paidInvoicesThisMonth = isAdmin ? await db.invoice.findMany({
      where: {
        status: "PAID",
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        client: true,
      },
    }) : [];

    const paidInvoicesPrevMonth = isAdmin ? await db.invoice.findMany({
      where: {
        status: "PAID",
        generatedAt: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
      include: {
        client: true,
      },
    }) : [];

    // Obtener todas las transacciones pagadas del mes actual
    // Non-ADMIN solo ve honorarios recibidos
    const paidTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: !isAdmin ? "HONORARIOS" : "INCOME",
        status: "PAID",
        ...(!isAdmin && userId ? { userId: userId } : {}),
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const paidTransactionsPrevMonth = await db.transaction.findMany({
      where: {
        type: !isAdmin ? "HONORARIOS" : "INCOME",
        status: "PAID",
        ...(!isAdmin && userId ? { userId: userId } : {}),
        createdAt: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
    });

    // Calcular ingresos totales del mes (solo PAID del mes actual)
    // Para Non-ADMIN: solo honorarios recibidos
    const totalIncome = 
      paidInvoicesThisMonth.reduce((sum, invoice) => sum + invoice.amount, 0) +
      paidTransactionsThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    const prevTotalIncome =
      paidInvoicesPrevMonth.reduce((sum, invoice) => sum + invoice.amount, 0) +
      paidTransactionsPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Obtener gastos pagados del mes actual (del modelo Expense)
    // Non-ADMIN solo ve sus propios gastos
    // INCLUIR gastos no reembolsados también
    const paidExpensesThisMonth = await db.expense.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        // REMOVIDO: reimbursed: true, // Ahora incluye todos los gastos del mes
        ...(!isAdmin && userId ? { paidByUserId: userId } : {}),
      },
    });

    const paidExpensesPrevMonth = await db.expense.findMany({
      where: {
        date: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
        ...(!isAdmin && userId ? { paidByUserId: userId } : {}),
      },
    });

    // Obtener transacciones HONORARIOS pagadas del mes actual (restan de la utilidad)
    // Non-ADMIN no ve honorarios de otros usuarios
    const paidHonorariosThisMonth = isAdmin ? await db.transaction.findMany({
      where: {
        type: "HONORARIOS",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    }) : [];

    const paidHonorariosPrevMonth = isAdmin ? await db.transaction.findMany({
      where: {
        type: "HONORARIOS",
        status: "PAID",
        createdAt: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
    }) : [];

    // Obtener transacciones de tipo EXPENSE pagadas del mes actual
    // Non-ADMIN solo ve sus propios gastos
    const paidExpenseTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: "EXPENSE",
        status: "PAID",
        ...(!isAdmin && userId ? { assignedToId: userId } : {}),
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
    });

    const paidExpenseTransactionsPrevMonth = await db.transaction.findMany({
      where: {
        type: "EXPENSE",
        status: "PAID",
        ...(!isAdmin && userId ? { assignedToId: userId } : {}),
        createdAt: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
    });

    // Calcular gastos pagados del mes (solo PAID del mes actual)
    const totalExpenses = 
      paidExpensesThisMonth.reduce((sum, expense) => sum + expense.amount, 0) +
      paidExpenseTransactionsThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0) +
      paidHonorariosThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    const prevTotalExpenses =
      paidExpensesPrevMonth.reduce((sum, expense) => sum + expense.amount, 0) +
      paidExpenseTransactionsPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0) +
      paidHonorariosPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Calcular Balance Neto (Ingresos Pagados - Gastos Pagados)
    // Para EDITOR: Honorarios recibidos - Gastos pagados
    const netProfit = totalIncome - totalExpenses;
    const prevNetProfit = prevTotalIncome - prevTotalExpenses;

    const calculateDeltaPct = (current: number, previous: number) => {
      if (previous === 0) return current === 0 ? 0 : 100;
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    const incomeDeltaPct = calculateDeltaPct(totalIncome, prevTotalIncome);
    const expensesDeltaPct = calculateDeltaPct(totalExpenses, prevTotalExpenses);
    const netProfitDeltaPct = calculateDeltaPct(netProfit, prevNetProfit);
    const currentMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const prevMargin = prevTotalIncome > 0 ? (prevNetProfit / prevTotalIncome) * 100 : 0;
    const marginDeltaPct = calculateDeltaPct(currentMargin, prevMargin);

    // Si es usuario autenticado, calcular estadísticas específicas
    let pendingReimbursements: number | undefined;
    let honorariosReceived: number | undefined;
    let pendingReimbursementsDeltaPct = 0;
    let honorariosDeltaPct = 0;

    if (userId) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const prevWeekStart = new Date();
      prevWeekStart.setDate(prevWeekStart.getDate() - 14);
      const prevWeekEnd = new Date();
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

        // Gastos pendientes de reembolso (EXPENSE con status PENDING)
      const pendingExpenseTransactions = await db.transaction.findMany({
        where: {
          type: "EXPENSE",
          status: "PENDING",
          ...(userId ? { assignedToId: userId } : {}),
        },
      });

      const pendingExpenseTransactionsPrevWeek = await db.transaction.findMany({
        where: {
          type: "EXPENSE",
          status: "PENDING",
          ...(userId ? { assignedToId: userId } : {}),
          createdAt: {
            gte: prevWeekStart,
            lte: prevWeekEnd,
          },
        },
      });

      const pendingExpenses = await db.expense.findMany({
        where: {
          reimbursed: false,
          ...(userId ? { paidByUserId: userId } : {}),
        },
      });

      const pendingExpensesPrevWeek = await db.expense.findMany({
        where: {
          reimbursed: false,
          ...(userId ? { paidByUserId: userId } : {}),
          date: {
            gte: prevWeekStart,
            lte: prevWeekEnd,
          },
        },
      });

      pendingReimbursements = 
        pendingExpenseTransactions.reduce((sum, t) => sum + t.amount, 0) +
        pendingExpenses.reduce((sum, e) => sum + e.amount, 0);

      const pendingReimbursementsPrevWeek =
        pendingExpenseTransactionsPrevWeek.reduce((sum, t) => sum + t.amount, 0) +
        pendingExpensesPrevWeek.reduce((sum, e) => sum + e.amount, 0);

      // Honorarios pagados en el mes actual (HONORARIOS con status PAID)
      const honorariosThisMonth = await db.transaction.findMany({
        where: {
          type: "HONORARIOS",
          status: "PAID",
          ...(userId ? { userId } : {}),
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      const honorariosPrevMonth = await db.transaction.findMany({
        where: {
          type: "HONORARIOS",
          status: "PAID",
          ...(userId ? { userId } : {}),
          createdAt: {
            gte: prevMonthStart,
            lte: prevMonthEnd,
          },
        },
      });

      honorariosReceived = honorariosThisMonth.reduce((sum, t) => sum + t.amount, 0);
      const honorariosPrev = honorariosPrevMonth.reduce((sum, t) => sum + t.amount, 0);
      pendingReimbursementsDeltaPct = calculateDeltaPct(
        pendingReimbursements,
        pendingReimbursementsPrevWeek
      );
      honorariosDeltaPct = calculateDeltaPct(honorariosReceived, honorariosPrev);
    }

    // Obtener todas las transacciones mezcladas (incluyendo el nuevo modelo Transaction)
    // Non-ADMIN solo ve sus transacciones
    const allInvoices = isAdmin
      ? await db.invoice.findMany({
          include: {
            client: true,
          },
          orderBy: {
            generatedAt: "desc",
          },
        })
      : [];

    const expenseWhereClause = isAdmin
      ? {}
      : {
          ...(userId ? { paidByUserId: userId } : { id: undefined }),
        };

    const allExpenses = await db.expense.findMany({
      where: expenseWhereClause,
      include: {
        client: true,
        paidByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    const transactionWhereClause = isAdmin
      ? {}
      : {
          OR: [
            userId
              ? {
                  type: "EXPENSE",
                  assignedToId: userId,
                }
              : undefined,
            userId
              ? {
                  type: "HONORARIOS",
                  userId,
                }
              : undefined,
          ].filter(Boolean) as any,
        };

    const allTransactions = await db.transaction.findMany({
      where: transactionWhereClause,
      include: {
        relatedClient: true,
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Mezclar y ordenar transacciones
    // Para non-ADMIN: solo mostrar transacciones personales del usuario
    const baseTransactions = [
      ...(isAdmin
        ? allInvoices.map((invoice) => ({
            id: invoice.id,
            type: "INCOME" as const,
            amount: invoice.amount,
            description: `Factura - ${invoice.client.name}`,
            date: invoice.generatedAt,
            clientName: invoice.client.name,
            status: invoice.status,
            category: undefined as string | undefined,
            sourceType: "INVOICE" as const,
            assignedToName: undefined as string | undefined,
            assignedToId: undefined as string | undefined,
          }))
        : []),
      ...allExpenses.map((expense) => ({
        id: expense.id,
        type: "EXPENSE" as const,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        clientName: expense.client?.name,
        status: expense.reimbursed ? "PAID" : "PENDING",
        category: expense.category,
        sourceType: "EXPENSE" as const,
        assignedToName: expense.paidByUser?.name,
        assignedToId: expense.paidByUserId ?? undefined,
        userId: expense.paidByUserId ?? undefined,
      })),
      ...allTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type as "INCOME" | "EXPENSE" | "HONORARIOS",
        amount: transaction.amount,
        description: transaction.description || "Transacción",
        date: transaction.createdAt,
        clientName: transaction.relatedClient?.name,
        status: transaction.status,
        category: transaction.category ?? undefined,
        sourceType: "TRANSACTION" as const,
        assignedToName: transaction.assignedTo?.name,
        assignedToId:
          transaction.type === "HONORARIOS"
            ? transaction.userId ?? transaction.assignedToId ?? undefined
            : transaction.assignedToId ?? undefined,
        userId: transaction.userId ?? undefined,
      })),
    ];

    const transactions = baseTransactions
      .filter((t) => {
        // If ADMIN, show all transactions
        if (isAdmin) {
          return true;
        }

        // For non-ADMIN users, filter their personal transactions only
        if (userId) {
          if (t.type === "INCOME") {
            return false;
          }

          const ownerId = t.assignedToId ?? t.userId;
          const recipientId = t.userId ?? t.assignedToId;
          const isUserExpense = t.type === "EXPENSE" && ownerId === userId;
          const isHonorario = t.type === "HONORARIOS" && recipientId === userId;

          return isUserExpense || isHonorario;
        }

        return true;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime()) as FinancialStats["recentTransactions"];

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit,
        incomeDeltaPct,
        expensesDeltaPct,
        netProfitDeltaPct,
        marginDeltaPct,
        recentTransactions: transactions,
        ...(userId && {
          pendingReimbursements,
          honorariosReceived,
          pendingReimbursementsDeltaPct,
          honorariosDeltaPct,
        }),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener estadísticas financieras",
    };
  }
}

/**
 * Server Action para crear una factura (Ingreso)
 * Valida con Zod y guarda en Prisma
 */
export async function createInvoice(
  input: unknown
): Promise<ApiResponse<Invoice>> {
  try {
    // Validar con Zod
    const validatedData = createInvoiceSchema.parse(input);

    // Crear la factura
    const invoice = await db.invoice.create({
      data: {
        amount: validatedData.amount,
        status: validatedData.status,
        clientId: validatedData.clientId,
        dueDate: validatedData.dueDate ?? null,
        generatedAt: validatedData.generatedAt ?? new Date(),
      },
    });

    // Revalidar la ruta de finanzas y el Dashboard
    revalidatePath("/finance");
    revalidatePath("/");

    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear factura",
    };
  }
}

/**
 * Server Action para registrar un pago (marcar factura como pagada o crear nueva factura pagada)
 * Esta función hace que el Dashboard sea dinámico
 */
export async function registerPayment(
  input: {
    amount: number;
    clientId: string;
    description?: string;
  }
): Promise<ApiResponse<Invoice>> {
  try {
    // Validar datos básicos
    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        error: "El monto debe ser mayor a 0",
      };
    }

    if (!input.clientId) {
      return {
        success: false,
        error: "El cliente es requerido",
      };
    }

    // Verificar que el cliente existe
    const client = await db.client.findUnique({
      where: { id: input.clientId },
    });

    if (!client) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    // Crear factura con status PAID directamente
    const invoice = await db.invoice.create({
      data: {
        amount: input.amount,
        status: "PAID",
        clientId: input.clientId,
        generatedAt: new Date(),
      },
      include: {
        client: true,
      },
    });

    // Revalidar Dashboard, página de finanzas y receivables
    revalidatePath("/");
    revalidatePath("/finance");
    revalidatePath("/finance/receivables");

    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al registrar pago",
    };
  }
}

/**
 * Server Action para marcar una factura existente como pagada
 */
export async function markInvoiceAsPaid(
  invoiceId: string
): Promise<ApiResponse<Invoice>> {
  try {
    // Verificar que la factura existe
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return {
        success: false,
        error: "Factura no encontrada",
      };
    }

    // Actualizar status a PAID
    const updatedInvoice = await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
      },
      include: {
        client: true,
      },
    });

    // Revalidar Dashboard, página de finanzas y receivables
    revalidatePath("/");
    revalidatePath("/finance");
    revalidatePath("/finance/receivables");

    return { success: true, data: updatedInvoice };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al marcar factura como pagada",
    };
  }
}

/**
 * Server Action para crear un gasto
 * Valida con Zod y guarda en Prisma
 * Si el usuario es EDITOR, fuerza el paidByUserId a su userId
 */
export async function createExpense(
  input: unknown
): Promise<ApiResponse<Expense>> {
  try {
    // Verificar autenticación y rol
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    const userRole = session.user.role;
    const userId = session.user.id;
    const isEditor = userRole === "EDITOR";

    // Validar con Zod
    const validatedData = createExpenseSchema.parse(input);

    // Si es EDITOR, forzar paidByUserId a su userId
    if (isEditor) {
      validatedData.paidByUserId = userId;
      validatedData.paidByUserIds = [userId]; // Solo puede crear gastos para sí mismo
    }

    // Lógica de gasto compartido: si hay múltiples usuarios, dividir el monto
    const userIds = validatedData.paidByUserIds && validatedData.paidByUserIds.length > 0
      ? validatedData.paidByUserIds
      : validatedData.paidByUserId
      ? [validatedData.paidByUserId]
      : [];

    const isSharedExpense = userIds.length > 1;
    const amountPerUser = isSharedExpense
      ? Math.round((validatedData.amount / userIds.length) * 100) / 100
      : validatedData.amount;

    // Crear un gasto principal (o múltiples si es compartido)
    const expenses = [];
    
    for (const userId of userIds) {
      const expense = await db.expense.create({
        data: {
          description: isSharedExpense
            ? `${validatedData.description} (Compartido - ${userIds.length} personas)`
            : validatedData.description,
          amount: amountPerUser,
          category: validatedData.category,
          date: validatedData.date ?? new Date(),
          receiptUrl: validatedData.receiptUrl ?? null,
          clientId: validatedData.clientId ?? null,
          paidByUserId: userId,
          reimbursed: validatedData.reimbursed ?? false,
          payrollId: validatedData.payrollId ?? null,
        },
      });
      expenses.push(expense);

      // NO crear Transaction si ya se creó un Expense
      // El Expense es el modelo principal para gastos y ya incluye toda la información necesaria
      // Las Transactions solo se usan para gastos que NO tienen un Expense asociado
    }

    // Si no hay usuarios asignados, crear un solo gasto sin asignar
    if (userIds.length === 0) {
      const expense = await db.expense.create({
        data: {
          description: validatedData.description,
          amount: validatedData.amount,
          category: validatedData.category,
          date: validatedData.date ?? new Date(),
          receiptUrl: validatedData.receiptUrl ?? null,
          clientId: validatedData.clientId ?? null,
          paidByUserId: null,
          reimbursed: validatedData.reimbursed ?? false,
          payrollId: validatedData.payrollId ?? null,
        },
      });
      expenses.push(expense);

      if (validatedData.clientId) {
        await db.transaction.create({
          data: {
            amount: validatedData.amount,
            type: "EXPENSE",
            status: validatedData.reimbursed ? "PAID" : "PENDING",
            description: validatedData.description,
            category: validatedData.category,
            relatedClientId: validatedData.clientId,
            clientId: validatedData.clientId,
            assignedToId: null,
          },
        });
      }
    }

    // Notificar a los admins sobre el nuevo gasto (Pusher + PUSH PWA)
    try {
      const { notifyAdminsWithPush } = await import("@/actions/notification-actions");
      const userName = session.user.name || session.user.email || "Un usuario";
      
      await notifyAdminsWithPush(
        "Nuevo gasto registrado",
        `${userName} registró un gasto: ${validatedData.description} - $${validatedData.amount}`,
        "ADMIN_ALERT",
        "/finance/expenses",
        userId
      );
    } catch (error) {
      console.error("❌ Error al enviar notificaciones a admins:", error);
      // No fallar la operación si las notificaciones fallan
    }

    // Revalidar las rutas
    revalidatePath("/finance");
    revalidatePath("/finance/expenses");
    revalidatePath("/"); // Dashboard para actualizar estadísticas

    return { success: true, data: expenses[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear gasto",
    };
  }
}

/**
 * Server Action para crear una transacción
 * Solo ADMIN puede crear transacciones de tipo HONORARIOS
 * EDITOR solo puede crear gastos (EXPENSE) y se fuerza assignedToId a su userId
 */
export async function createTransaction(
  input: unknown
): Promise<ApiResponse<Transaction>> {
  try {
    // Verificar autenticación y rol
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    const userRole = session.user.role;
    const userId = session.user.id;
    const isEditor = userRole === "EDITOR";

    // Validar con Zod
    const validatedData = createTransactionSchema.parse(input);

    // Si es HONORARIOS, solo ADMIN puede crearlo
    if (validatedData.type === "HONORARIOS" && userRole !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para crear transacciones de tipo HONORARIOS",
      };
    }

    // Si es EDITOR, solo puede crear gastos (EXPENSE) y se fuerza assignedToId
    if (isEditor) {
      if (validatedData.type !== "EXPENSE") {
        return {
          success: false,
          error: "Solo puedes crear transacciones de tipo EXPENSE",
        };
      }
      // Forzar assignedToId al userId del EDITOR
      validatedData.assignedToId = userId;
    }

    // Crear la transacción
    const transaction = await db.transaction.create({
      data: {
        amount: validatedData.amount,
        type: validatedData.type,
        status: validatedData.status ?? "PENDING",
        description: validatedData.description ?? null,
        category: validatedData.category ?? null,
        relatedClientId: validatedData.relatedClientId ?? null,
        clientId: validatedData.clientId ?? null,
        assignedToId: validatedData.assignedToId ?? null,
        userId: validatedData.userId ?? null,
      },
    });

    // Notificar a los admins sobre nuevos ingresos u honorarios (Pusher + PUSH PWA)
    if (transaction.type === "INCOME" || transaction.type === "HONORARIOS") {
      try {
        const { notifyAdminsWithPush } = await import("@/actions/notification-actions");
        
        const typeLabel = transaction.type === "INCOME" ? "Ingreso" : "Honorario";
        const description = transaction.description || "Sin descripción";
        
        await notifyAdminsWithPush(
          `Nuevo ${typeLabel.toLowerCase()} registrado`,
          `Se registró un ${typeLabel.toLowerCase()}: ${description} - $${transaction.amount}`,
          "ADMIN_ALERT",
          "/finance",
          userId
        );
      } catch (error) {
        console.error("❌ Error al enviar notificaciones a admins:", error);
        // No fallar la operación si las notificaciones fallan
      }
    }

    // Revalidar rutas
    revalidatePath("/finance");
    revalidatePath("/");

    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear transacción",
    };
  }
}

/**
 * Server Action para actualizar una transacción
 * Permite cambiar el status (PENDING, PAID, CANCELLED) y otros campos
 */
export async function updateTransaction(
  id: string,
  input: unknown
): Promise<ApiResponse<Transaction>> {
  try {
    // Validar con Zod
    const validatedData = updateTransactionSchema.parse(input);

    // Actualizar la transacción
    const transaction = await db.transaction.update({
      where: { id },
      data: {
        ...(validatedData.amount !== undefined && { amount: validatedData.amount }),
        ...(validatedData.type !== undefined && { type: validatedData.type }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.relatedClientId !== undefined && {
          relatedClientId: validatedData.relatedClientId || null,
        }),
        ...(validatedData.assignedToId !== undefined && {
          assignedToId: validatedData.assignedToId || null,
        }),
      },
    });

    // Revalidar Dashboard, página de finanzas y receivables
    revalidatePath("/");
    revalidatePath("/finance");
    revalidatePath("/finance/receivables");

    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar transacción",
    };
  }
}

/**
 * Server Action para marcar una transacción como pagada
 */
export async function markTransactionAsPaid(
  transactionId: string
): Promise<ApiResponse<Transaction>> {
  try {
    // Obtener la transacción antes de actualizar
    const transactionBefore = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: true, // Para transacciones de tipo HONORARIOS
      },
    });

    if (!transactionBefore) {
      return {
        success: false,
        error: "Transacción no encontrada",
      };
    }

    // Actualizar la transacción
    const result = await updateTransaction(transactionId, { status: "PAID" });

    // Notificar si es un pago de honorarios
    if (result.success && transactionBefore.type === "HONORARIOS" && transactionBefore.userId) {
      try {
        await sendNotification({
          userId: transactionBefore.userId,
          message: `Se ha procesado el pago de tus honorarios por $${transactionBefore.amount}.`,
          type: "PAYMENT",
          createdBy: undefined, // Sistema
        });
      } catch (error) {
        console.error("❌ Error al enviar notificación de pago:", error);
        // No fallar la operación si la notificación falla
      }
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al marcar transacción como pagada",
    };
  }
}

/**
 * Server Action para cancelar una transacción
 */
export async function cancelTransaction(
  transactionId: string
): Promise<ApiResponse<Transaction>> {
  return updateTransaction(transactionId, { status: "CANCELLED" });
}

/**
 * Server Action para obtener una transacción por ID
 */
export async function getTransactionById(
  transactionId: string
): Promise<ApiResponse<Transaction>> {
  try {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        relatedClient: true,
      },
    });

    if (!transaction) {
      return {
        success: false,
        error: "Transacción no encontrada",
      };
    }

    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener transacción",
    };
  }
}

/**
 * Server Action para obtener cuentas por cobrar
 * Retorna transacciones INCOME con status PENDING y sus métricas
 * Filtra por usuario logueado para contabilidad personal
 */
export async function getReceivables(): Promise<ApiResponse<{
  totalReceivable: number;
  clientsWithDebt: number;
  monthProjection: number;
  pendingTransactions: Array<{
    id: string;
    clientName?: string;
    description: string;
    amount: number;
    date: Date;
    daysOverdue: number;
    sourceType: "INVOICE" | "TRANSACTION";
  }>;
}>> {
  try {
    // Obtener sesión del usuario logueado
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: "Usuario no autenticado",
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Obtener facturas pendientes (filtrar por usuario si es necesario)
    // Nota: Las facturas no tienen userId, así que las obtenemos todas
    // Si necesitas filtrar por usuario, necesitarías agregar un campo userId a Invoice
    const pendingInvoices = await db.invoice.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        client: true,
      },
      orderBy: {
        generatedAt: "asc",
      },
    });

    // Obtener transacciones pendientes de tipo INCOME
    // Filtrar por assignedToId si existe (para contabilidad personal)
    const pendingTransactions = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PENDING",
        // Si assignedToId existe, filtrar por usuario; si no, mostrar todas
        // Para contabilidad personal, asumimos que las transacciones sin assignedToId son del usuario logueado
        OR: [
          { assignedToId: userId },
          { assignedToId: null }, // Transacciones sin asignar (asumimos del usuario)
        ],
      },
      include: {
        relatedClient: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Obtener transacciones pagadas del mes actual (filtrar por usuario)
    const paidInvoicesThisMonth = await db.invoice.findMany({
      where: {
        status: "PAID",
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const paidTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { assignedToId: userId },
          { assignedToId: null },
        ],
      },
    });

    // Obtener transacciones pendientes del mes actual (para proyección)
    const pendingInvoicesThisMonth = await db.invoice.findMany({
      where: {
        status: "PENDING",
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const pendingTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PENDING",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { assignedToId: userId },
          { assignedToId: null },
        ],
      },
    });

    // Calcular métricas
    // Saldo Pendiente Total: suma de todas las transacciones INCOME con status PENDING
    const totalReceivable = 
      pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0) +
      pendingTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Clientes con Deuda: número de clientes únicos con transacciones pendientes
    const clientsWithDebtSet = new Set<string>();
    pendingInvoices.forEach((inv) => {
      if (inv.clientId) clientsWithDebtSet.add(inv.clientId);
    });
    pendingTransactions.forEach((t) => {
      if (t.relatedClientId) clientsWithDebtSet.add(t.relatedClientId);
    });
    const clientsWithDebt = clientsWithDebtSet.size;

    // Proyección del Mes: PAID + PENDING del mes actual
    const monthProjection = 
      paidInvoicesThisMonth.reduce((sum, inv) => sum + inv.amount, 0) +
      paidTransactionsThisMonth.reduce((sum, t) => sum + t.amount, 0) +
      pendingInvoicesThisMonth.reduce((sum, inv) => sum + inv.amount, 0) +
      pendingTransactionsThisMonth.reduce((sum, t) => sum + t.amount, 0);

    // Preparar lista de transacciones pendientes con días de atraso
    const pendingList = [
      ...pendingInvoices.map((inv) => {
        const invoiceDate = new Date(inv.generatedAt);
        const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: inv.id,
          clientName: inv.client.name,
          description: `Factura - ${inv.client.name}`,
          amount: inv.amount,
          date: invoiceDate,
          daysOverdue: daysDiff > 0 ? daysDiff : 0,
          sourceType: "INVOICE" as const,
        };
      }),
      ...pendingTransactions.map((t) => {
        const transactionDate = new Date(t.createdAt);
        const daysDiff = Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: t.id,
          clientName: t.relatedClient?.name,
          description: t.description || "Transacción",
          amount: t.amount,
          date: transactionDate,
          daysOverdue: daysDiff > 0 ? daysDiff : 0,
          sourceType: "TRANSACTION" as const,
        };
      }),
    ].sort((a, b) => b.daysOverdue - a.daysOverdue); // Ordenar por días de atraso descendente

    return {
      success: true,
      data: {
        totalReceivable,
        clientsWithDebt,
        monthProjection,
        pendingTransactions: pendingList,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener cuentas por cobrar",
    };
  }
}

/**
 * Server Action para obtener el estado de cuenta de un cliente
 * Retorna deudas pendientes e historial de pagos
 */
export async function getClientAccountStatus(
  clientId: string
): Promise<ApiResponse<{
  pendingDebts: Array<{
    id: string;
    description: string;
    amount: number;
    date: Date;
    daysOverdue: number;
    sourceType: "INVOICE" | "TRANSACTION";
  }>;
  paymentHistory: Array<{
    id: string;
    description: string;
    amount: number;
    date: Date;
    status: string;
    sourceType: "INVOICE" | "TRANSACTION";
  }>;
}>> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Obtener facturas del cliente
    const clientInvoices = await db.invoice.findMany({
      where: {
        clientId,
      },
      include: {
        client: true,
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    // Obtener transacciones del cliente
    const clientTransactions = await db.transaction.findMany({
      where: {
        relatedClientId: clientId,
        type: "INCOME",
      },
      include: {
        relatedClient: true,
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Filtrar deudas pendientes
    const pendingDebts = [
      ...clientInvoices
        .filter((inv) => inv.status === "PENDING")
        .map((inv) => {
          const invoiceDate = new Date(inv.generatedAt);
          const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: inv.id,
            description: `Factura - ${inv.client.name}`,
            amount: inv.amount,
            date: invoiceDate,
            daysOverdue: daysDiff > 0 ? daysDiff : 0,
            sourceType: "INVOICE" as const,
          };
        }),
      ...clientTransactions
        .filter((t) => t.status === "PENDING")
        .map((t) => {
          const transactionDate = new Date(t.createdAt);
          const daysDiff = Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: t.id,
            description: t.description || "Transacción",
            amount: t.amount,
            date: transactionDate,
            daysOverdue: daysDiff > 0 ? daysDiff : 0,
            sourceType: "TRANSACTION" as const,
          };
        }),
    ].sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Historial de pagos (todas las transacciones pagadas)
    const paymentHistory = [
      ...clientInvoices
        .filter((inv) => inv.status === "PAID")
        .map((inv) => ({
          id: inv.id,
          description: `Factura - ${inv.client.name}`,
          amount: inv.amount,
          date: new Date(inv.generatedAt),
          status: inv.status,
          sourceType: "INVOICE" as const,
        })),
      ...clientTransactions
        .filter((t) => t.status === "PAID")
        .map((t) => ({
          id: t.id,
          description: t.description || "Transacción",
          amount: t.amount,
          date: new Date(t.createdAt),
          status: t.status,
          sourceType: "TRANSACTION" as const,
        })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      success: true,
      data: {
        pendingDebts,
        paymentHistory,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener estado de cuenta",
    };
  }
}

/**
 * Server Action para obtener una factura por ID
 */
export async function getInvoiceById(
  invoiceId: string
): Promise<ApiResponse<Invoice>> {
  try {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
      },
    });

    if (!invoice) {
      return {
        success: false,
        error: "Factura no encontrada",
      };
    }

    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener factura",
    };
  }
}

/**
 * Server Action para actualizar una factura
 */
export async function updateInvoice(
  id: string,
  input: unknown
): Promise<ApiResponse<Invoice>> {
  try {
    // Validar con Zod
    const validatedData = updateInvoiceSchema.parse(input);

    // Actualizar la factura
    const invoice = await db.invoice.update({
      where: { id },
      data: {
        ...(validatedData.amount !== undefined && { amount: validatedData.amount }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
        ...(validatedData.dueDate !== undefined && {
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        }),
        ...(validatedData.clientId !== undefined && { clientId: validatedData.clientId }),
      },
      include: {
        client: true,
      },
    });

    // Revalidar Dashboard, página de finanzas y receivables
    revalidatePath("/");
    revalidatePath("/finance");
    revalidatePath("/finance/receivables");

    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar factura",
    };
  }
}

/**
 * Server Action para obtener estadísticas de gastos
 * Retorna gastos del mes actual y pendientes de reembolso
 * Filtra por usuario logueado para contabilidad personal
 */
export async function getExpensesStats(filters?: {
  month?: string;
  userId?: string;
  clientId?: string;
  category?: string;
}): Promise<ApiResponse<{
  totalExpensesThisMonth: number;
  pendingReimbursement: number;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
    status: string;
    assignedToName?: string;
    assignedToId?: string;
    reimbursed: boolean;
  }>;
  categoryDistribution: Array<{
    category: string;
    amount: number;
  }>;
  clientDistribution: Array<{
    clientName: string;
    amount: number;
  }>;
}>> {
  try {
    // Obtener sesión del usuario logueado
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;
    const isAdmin = userRole === "ADMIN";

    if (!userId) {
      return {
        success: false,
        error: "Usuario no autenticado",
      };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Construir filtros dinámicos
    const expenseWhere: any = {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    };

    // Filtro por usuario - SOLO mostrar gastos del usuario logueado
    if (filters?.userId && filters.userId !== "all") {
      expenseWhere.paidByUserId = filters.userId;
    } else if (!isAdmin) {
      // Solo mostrar gastos asignados al usuario logueado si no es ADMIN
      expenseWhere.paidByUserId = userId;
    }

    // Filtro por cliente
    if (filters?.clientId && filters.clientId !== "all") {
      expenseWhere.clientId = filters.clientId;
    }

    // Filtro por categoría
    if (filters?.category && filters.category !== "all") {
      expenseWhere.category = filters.category;
    }

    // Obtener todos los gastos del mes actual (filtrar por usuario si es necesario)
    // Los gastos del modelo Expense no tienen userId directo, pero tienen paidByUserId
    const expensesThisMonth = await db.expense.findMany({
      where: expenseWhere,
      include: {
        paidByUser: true,
        client: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    // Construir filtros para transacciones
    const transactionWhere: any = {
      type: "EXPENSE",
      createdAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    };

    // Filtro por usuario - SOLO mostrar transacciones del usuario logueado
    if (filters?.userId && filters.userId !== "all") {
      transactionWhere.assignedToId = filters.userId;
    } else if (!isAdmin) {
      // Solo mostrar transacciones asignadas al usuario logueado si no es ADMIN
      transactionWhere.assignedToId = userId;
    }

    // Filtro por cliente
    if (filters?.clientId && filters.clientId !== "all") {
      transactionWhere.relatedClientId = filters.clientId;
      transactionWhere.clientId = filters.clientId;
    }

    // Filtro por categoría
    if (filters?.category && filters.category !== "all") {
      transactionWhere.category = filters.category;
    }

    // Obtener transacciones de tipo EXPENSE del mes actual
    const expenseTransactionsThisMonth = await db.transaction.findMany({
      where: transactionWhere,
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
        relatedClient: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calcular total de gastos del mes
    const totalExpensesThisMonth = 
      expensesThisMonth.reduce((sum, exp) => sum + exp.amount, 0) +
      expenseTransactionsThisMonth.reduce((sum, t) => sum + t.amount, 0);

    // Calcular pendiente de reembolso (gastos con paidByUserId y status PENDING o no reembolsados)
    const pendingReimbursement = 
      expensesThisMonth
        .filter((exp) => exp.paidByUserId && !exp.reimbursed)
        .reduce((sum, exp) => sum + exp.amount, 0) +
      expenseTransactionsThisMonth
        .filter((t) => t.assignedToId && t.status === "PENDING")
        .reduce((sum, t) => sum + t.amount, 0);

    // Crear un mapa de Expenses para detectar duplicados con Transactions
    // Clave: clientId-paidByUserId-date-amount (si tiene cliente y usuario)
    const expenseMap = new Map<string, boolean>();
    expensesThisMonth.forEach((exp) => {
      if (exp.clientId && exp.paidByUserId) {
        const dateKey = exp.date.toISOString().split('T')[0]; // Solo la fecha, sin hora
        const key = `${exp.clientId}-${exp.paidByUserId}-${dateKey}-${exp.amount}`;
        expenseMap.set(key, true);
      }
    });

    // Preparar lista de gastos
    // Filtrar Transactions que tienen un Expense duplicado
    const expensesList = [
      ...expensesThisMonth.map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        category: exp.category,
        date: exp.date,
        status: exp.reimbursed ? "REIMBURSED" : "PENDING",
        assignedToName: exp.paidByUser?.name,
        assignedToId: exp.paidByUserId ?? undefined,
        reimbursed: exp.reimbursed,
        sourceType: "EXPENSE" as const,
        clientName: exp.client?.name,
        clientId: exp.clientId,
      })),
      ...expenseTransactionsThisMonth
        .filter((t) => {
          // Si la Transaction tiene clientId y assignedToId, verificar si hay un Expense duplicado
          if (t.relatedClientId && t.assignedToId) {
            const dateKey = t.createdAt.toISOString().split('T')[0]; // Solo la fecha, sin hora
            const key = `${t.relatedClientId}-${t.assignedToId}-${dateKey}-${t.amount}`;
            // Si existe un Expense con la misma clave, filtrar esta Transaction (es un duplicado)
            return !expenseMap.has(key);
          }
          // Si no tiene clientId o assignedToId, incluirla (puede ser un gasto sin cliente o sin usuario)
          return true;
        })
        .map((t) => ({
          id: t.id,
          description: t.description || "Gasto",
          amount: t.amount,
          category: t.category || "OTROS",
          date: t.createdAt,
          status: t.status,
          assignedToName: t.assignedTo?.name,
          assignedToId: t.assignedToId ?? undefined,
          reimbursed: t.status === "PAID",
          sourceType: "TRANSACTION" as const,
          clientName: t.relatedClient?.name,
          clientId: t.relatedClientId || t.clientId,
        })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calcular distribución por categoría
    const categoryMap = new Map<string, number>();
    expensesList.forEach((exp) => {
      const current = categoryMap.get(exp.category) || 0;
      categoryMap.set(exp.category, current + exp.amount);
    });
    const categoryDistribution = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));

    // Calcular distribución por cliente
    const clientMap = new Map<string, number>();
    expensesThisMonth.forEach((exp) => {
      if (exp.client) {
        const current = clientMap.get(exp.client.name) || 0;
        clientMap.set(exp.client.name, current + exp.amount);
      }
    });
    expenseTransactionsThisMonth.forEach((t) => {
      if (t.relatedClient) {
        const current = clientMap.get(t.relatedClient.name) || 0;
        clientMap.set(t.relatedClient.name, current + t.amount);
      }
    });
    const clientDistribution = Array.from(clientMap.entries()).map(([clientName, amount]) => ({
      clientName,
      amount,
    }));

    return {
      success: true,
      data: {
        totalExpensesThisMonth,
        pendingReimbursement,
        expenses: expensesList,
        categoryDistribution,
        clientDistribution,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener estadísticas de gastos",
    };
  }
}

/**
 * Server Action para obtener un gasto por ID
 */
export async function getExpenseById(
  expenseId: string
): Promise<ApiResponse<Expense & { relatedUserIds?: string[] }>> {
  try {
    const expense = await db.expense.findUnique({
      where: { id: expenseId },
      include: {
        paidByUser: true,
        client: true,
      },
    });

    if (!expense) {
      return {
        success: false,
        error: "Gasto no encontrado",
      };
    }

    // Si es un gasto compartido, buscar todos los usuarios relacionados y calcular el monto total
    let relatedUserIds: string[] = [];
    let totalAmount: number = expense.amount;
    if (expense.description.includes("(Compartido -")) {
      const baseDescription = expense.description.replace(/\s*\(Compartido - \d+ personas\)/g, "").trim();
      const dateStart = new Date(expense.date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(expense.date);
      dateEnd.setHours(23, 59, 59, 999);
      
      // Buscar todos los gastos relacionados usando múltiples criterios
      // Primero buscar por descripción base (sin el sufijo de compartido)
      const whereClause: any = {
        id: { not: expense.id }, // Excluir el gasto actual para evitar duplicados
        clientId: expense.clientId || null,
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
        OR: [
          {
            description: {
              contains: baseDescription,
            },
          },
          {
            // También buscar por descripciones que contengan la base pero con diferentes números de personas
            description: {
              startsWith: baseDescription,
            },
          },
        ],
      };
      
      const relatedExpenses = await db.expense.findMany({
        where: whereClause,
        select: {
          paidByUserId: true,
          amount: true,
          description: true,
        },
      });
      
      // Filtrar solo los que realmente son del mismo gasto compartido
      // (misma descripción base, mismo cliente, misma fecha)
      // NO filtrar por monto porque puede haber cambiado después de una edición
      const filteredRelatedExpenses = relatedExpenses.filter((e) => {
        const eBaseDescription = e.description.replace(/\s*\(Compartido - \d+ personas\)/g, "").trim();
        // Comparar descripción base, cliente y fecha, pero NO el monto
        return eBaseDescription === baseDescription;
      });
      
      // Sumar todos los montos para obtener el total original
      // Incluir el gasto actual también
      totalAmount = expense.amount + filteredRelatedExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      relatedUserIds = [
        expense.paidByUserId,
        ...filteredRelatedExpenses.map(e => e.paidByUserId).filter(Boolean)
      ].filter((id, index, self) => self.indexOf(id) === index) as string[]; // Eliminar duplicados
    }

    return { 
      success: true, 
      data: {
        ...expense,
        relatedUserIds: relatedUserIds.length > 0 ? relatedUserIds : undefined,
        totalAmount: totalAmount, // Monto total original para gastos compartidos
      } as Expense & { relatedUserIds?: string[]; totalAmount?: number }
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener gasto",
    };
  }
}

/**
 * Server Action para actualizar un gasto
 */
export async function updateExpense(
  id: string,
  input: unknown
): Promise<ApiResponse<Expense>> {
  try {
    // Validar con Zod
    const validatedData = updateExpenseSchema.parse(input);

    // Obtener el gasto actual
    const currentExpense = await db.expense.findUnique({
      where: { id },
    });

    if (!currentExpense) {
      return {
        success: false,
        error: "Gasto no encontrado",
      };
    }

    // Obtener el gasto actual con información del usuario
    const expenseBefore = await db.expense.findUnique({
      where: { id },
      include: {
        paidByUser: true,
      },
    });

    if (!expenseBefore) {
      return {
        success: false,
        error: "Gasto no encontrado",
      };
    }

    // Detectar si es un gasto compartido (la descripción contiene "(Compartido - X personas)")
    const isSharedExpense = expenseBefore.description.includes("(Compartido -");
    let relatedExpenses: Expense[] = [];

    if (isSharedExpense) {
      // Extraer la descripción base (sin el sufijo de compartido)
      const baseDescription = expenseBefore.description.replace(/\s*\(Compartido - \d+ personas\)/g, "").trim();
      
      // Buscar todos los gastos compartidos relacionados
      // Mismo cliente (o ambos null), misma fecha (mismo día), misma descripción base, mismo monto
      const dateStart = new Date(expenseBefore.date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(expenseBefore.date);
      dateEnd.setHours(23, 59, 59, 999);
      
      const whereClause: any = {
        id: { not: id }, // Excluir el gasto actual
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
        // NO filtrar por amount porque puede haber cambiado después de una edición
        description: {
          contains: baseDescription,
        },
      };
      
      // Si tiene cliente, buscar por cliente; si no, buscar gastos sin cliente
      if (expenseBefore.clientId) {
        whereClause.clientId = expenseBefore.clientId;
      } else {
        whereClause.clientId = null;
      }
      
      relatedExpenses = await db.expense.findMany({
        where: whereClause,
      });
    }

    // Si hay múltiples usuarios en paidByUserIds, usar el primero para paidByUserId
    const paidByUserId = validatedData.paidByUserIds && validatedData.paidByUserIds.length > 0
      ? validatedData.paidByUserIds[0]
      : validatedData.paidByUserId || currentExpense.paidByUserId;

    // Preparar datos de actualización
    const updateData: any = {};
    if (validatedData.description !== undefined) {
      // Si es compartido, actualizar la descripción manteniendo el sufijo
      if (isSharedExpense) {
        // Usar paidByUserIds si está disponible, sino calcular desde relatedExpenses
        const numPeople = validatedData.paidByUserIds?.length || (relatedExpenses.length + 1);
        updateData.description = `${validatedData.description} (Compartido - ${numPeople} personas)`;
      } else {
        updateData.description = validatedData.description;
      }
    }
    if (validatedData.amount !== undefined) {
      // Si es un gasto compartido, el monto recibido es por persona
      // Mantener el monto por persona para cada gasto individual
      updateData.amount = validatedData.amount;
    }
    if (validatedData.category !== undefined) {
      updateData.category = validatedData.category;
    }
    if (validatedData.date !== undefined) {
      updateData.date = validatedData.date;
    }
    if (validatedData.clientId !== undefined) {
      updateData.clientId = validatedData.clientId || null;
    }
    if (paidByUserId !== undefined) {
      updateData.paidByUserId = paidByUserId || null;
    }
    if (validatedData.reimbursed !== undefined) {
      updateData.reimbursed = validatedData.reimbursed;
    }

    // Actualizar el gasto actual
    const updatedExpense = await db.expense.update({
      where: { id },
      data: updateData,
    });

    // Si es un gasto compartido, actualizar todos los gastos relacionados
    if (isSharedExpense && relatedExpenses.length > 0) {
      const sharedUpdateData: any = {};
      
      // Actualizar descripción en todos los gastos relacionados
      if (validatedData.description !== undefined) {
        const numPeople = relatedExpenses.length + 1;
        sharedUpdateData.description = `${validatedData.description} (Compartido - ${numPeople} personas)`;
      }
      
      // Actualizar otros campos comunes
      if (validatedData.category !== undefined) {
        sharedUpdateData.category = validatedData.category;
      }
      if (validatedData.date !== undefined) {
        sharedUpdateData.date = validatedData.date;
      }
      if (validatedData.clientId !== undefined) {
        sharedUpdateData.clientId = validatedData.clientId || null;
      }
      if (validatedData.reimbursed !== undefined) {
        sharedUpdateData.reimbursed = validatedData.reimbursed;
      }
      // Si se actualizó el monto, actualizar el monto por persona en todos los gastos relacionados
      if (validatedData.amount !== undefined) {
        sharedUpdateData.amount = validatedData.amount;
      }

      // Actualizar todos los gastos relacionados
      if (Object.keys(sharedUpdateData).length > 0) {
        await db.expense.updateMany({
          where: {
            id: { in: relatedExpenses.map(exp => exp.id) },
          },
          data: sharedUpdateData,
        });
      }
    }

    // Revalidar rutas
    revalidatePath("/finance");
    revalidatePath("/finance/expenses");
    revalidatePath("/");

    return { success: true, data: updatedExpense };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar gasto",
    };
  }
}

/**
 * Server Action para marcar un gasto como reembolsado
 */
export async function markExpenseAsReimbursed(
  expenseId: string
): Promise<ApiResponse<Expense>> {
  try {
    // Verificar que el gasto existe
    const expense = await db.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      return {
        success: false,
        error: "Gasto no encontrado",
      };
    }

    // Actualizar status a reembolsado
    const updatedExpense = await db.expense.update({
      where: { id: expenseId },
      data: {
        reimbursed: true,
      },
      include: {
        paidByUser: true,
      },
    });

    // Notificar al usuario que su gasto fue reembolsado
    if (updatedExpense.paidByUserId) {
      try {
        await sendNotification({
          userId: updatedExpense.paidByUserId,
          message: `Tu gasto "${updatedExpense.description}" ha sido reembolsado.`,
          type: "FINANCE",
          createdBy: undefined, // Sistema
        });
      } catch (error) {
        console.error("❌ Error al enviar notificación de reembolso:", error);
        // No fallar la operación si la notificación falla
      }
    }

    // Revalidar rutas
    revalidatePath("/finance");
    revalidatePath("/finance/expenses");
    revalidatePath("/");

    return { success: true, data: updatedExpense };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al marcar gasto como reembolsado",
    };
  }
}

/**
 * Server Action para liquidar todos los reembolsos pendientes de un usuario
 * Marca como pagados todos los gastos pendientes del usuario especificado
 */
export async function liquidateReimbursements(
  userId: string
): Promise<ApiResponse<{ count: number }>> {
  try {
    // Verificar que el usuario existe
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: "Usuario no encontrado",
      };
    }

    // Actualizar todas las transacciones de tipo EXPENSE pendientes del usuario
    const transactionsResult = await db.transaction.updateMany({
      where: {
        assignedToId: userId,
        type: "EXPENSE",
        status: "PENDING",
      },
      data: {
        status: "PAID",
      },
    });

    // Actualizar todos los gastos del modelo Expense pendientes del usuario
    const expensesResult = await db.expense.updateMany({
      where: {
        paidByUserId: userId,
        reimbursed: false,
      },
      data: {
        reimbursed: true,
      },
    });

    const totalCount = transactionsResult.count + expensesResult.count;

    // Revalidar rutas
    revalidatePath("/finance");
    revalidatePath("/finance/expenses");
    revalidatePath("/");

    return {
      success: true,
      data: { count: totalCount },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al liquidar reembolsos",
    };
  }
}

/**
 * Server Action para obtener estadísticas de rentabilidad global
 * Incluye datos históricos de los últimos 6 meses
 */
export async function getGlobalProfitabilityStats(): Promise<ApiResponse<GlobalProfitabilityStats>> {
  try {
    const now = new Date();
    
    // Generar array de meses a analizar
    const months: Array<{ year: number; month: number; start: Date; end: Date }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        start,
        end,
      });
    }

    // Obtener datos mensuales
    const monthlyData: MonthlyProfitability[] = await Promise.all(
      months.map(async ({ year, month, start, end }) => {
        // Ingresos del mes (INCOME con status PAID)
        const incomeInvoices = await db.invoice.findMany({
          where: {
            status: "PAID",
            generatedAt: {
              gte: start,
              lte: end,
            },
          },
        });

        const incomeTransactions = await db.transaction.findMany({
          where: {
            type: "INCOME",
            status: "PAID",
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });

        const income = 
          incomeInvoices.reduce((sum, inv) => sum + inv.amount, 0) +
          incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

        // Gastos del mes (EXPENSE con status PAID o reimbursed = true)
        const expenses = await db.expense.findMany({
          where: {
            date: {
              gte: start,
              lte: end,
            },
            reimbursed: true,
          },
        });

        const expenseTransactions = await db.transaction.findMany({
          where: {
            type: "EXPENSE",
            status: "PAID",
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });

        // Incluir HONORARIOS pagados como gastos (restan de la utilidad)
        const honorariosTransactions = await db.transaction.findMany({
          where: {
            type: "HONORARIOS",
            status: "PAID",
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });

        const expensesTotal = 
          expenses.reduce((sum, e) => sum + e.amount, 0) +
          expenseTransactions.reduce((sum, t) => sum + t.amount, 0) +
          honorariosTransactions.reduce((sum, t) => sum + t.amount, 0);

        const profit = income - expensesTotal;

        // Formatear nombre del mes
        const monthNames = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];

        return {
          month: `${monthNames[month]} ${year}`,
          monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
          income,
          expenses: expensesTotal,
          profit,
        };
      })
    );

    // Calcular totales globales (mes actual)
    const currentMonth = monthlyData[monthlyData.length - 1];
    const totalIncome = currentMonth.income;
    const totalExpenses = currentMonth.expenses;
    const netProfit = currentMonth.profit;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    // Distribución por socio (50/50 por defecto, puede ajustarse)
    const partnerDistribution = {
      stuart: netProfit * 0.5,
      paty: netProfit * 0.5,
    };

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin,
        monthlyData,
        partnerDistribution,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener estadísticas de rentabilidad global",
    };
  }
}

/**
 * Server Action para actualizar la configuración salarial de un usuario
 * Solo ejecutable por ADMIN
 */
export async function updateUserSalaryConfig(
  userId: string,
  input: unknown
): Promise<ApiResponse<User>> {
  try {
    // Verificar que el usuario actual sea ADMIN
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para realizar esta acción",
      };
    }

    // Validar con Zod
    const validatedData = updateUserSalaryConfigSchema.parse(input);

    // Verificar que el usuario existe
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: "Usuario no encontrado",
      };
    }

    // Preparar datos de actualización
    const updateData: {
      salaryType?: string;
      baseSalary?: number | null;
      hourlyRate?: number;
      profitSharePercent?: number | null;
      bankAccountInfo?: string | null;
    } = {};

    if (validatedData.salaryType !== undefined) {
      updateData.salaryType = validatedData.salaryType;
    }
    if (validatedData.baseSalary !== undefined) {
      updateData.baseSalary = validatedData.baseSalary;
    }
    if (validatedData.hourlyRate !== undefined) {
      updateData.hourlyRate = validatedData.hourlyRate;
    }
    if (validatedData.profitSharePercent !== undefined) {
      updateData.profitSharePercent = validatedData.profitSharePercent;
    }
    if (validatedData.bankAccountInfo !== undefined) {
      updateData.bankAccountInfo = validatedData.bankAccountInfo;
    }

    // Actualizar el usuario
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Si se actualizó hourlyRate, actualizar también las sesiones de tiempo activas (RUNNING)
    if (validatedData.hourlyRate !== undefined) {
      await db.timeEntry.updateMany({
        where: {
          userId: userId,
          status: "RUNNING",
        },
        data: {
          hourlyRate: validatedData.hourlyRate,
        },
      });
    }

    // Revalidar rutas relevantes
    revalidatePath("/admin/users");
    revalidatePath("/finance/settlement");
    revalidatePath("/chronos"); // Para actualizar las sesiones de tiempo activas

    return { success: true, data: updatedUser };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar configuración salarial",
    };
  }
}

/**
 * Interface para el reporte de liquidación por usuario
 */
export interface UserSettlementReport {
  userId: string;
  userName: string;
  userRole: string;
  salaryType: string;
  salary: number; // Sueldo base mensual o (horas * tarifa) para HOURLY
  reimbursements: number; // Suma de Expenses pendientes
  paidSoFar: number; // Suma de transacciones pagadas este mes
  remaining: number; // Total a pagar
  // Para PROFIT_SHARE:
  netIncome?: number; // Ingresos - Gastos totales de la agencia
  share?: number; // netIncome * (profitSharePercent / 100)
}

/**
 * Server Action para obtener el reporte de liquidación del mes
 * Devuelve una lista de usuarios con el desglose financiero del mes
 */
export async function getSettlementReport(
  month: number,
  year: number
): Promise<ApiResponse<UserSettlementReport[]>> {
  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autorizado",
      };
    }
    
    const currentUserId = session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    // Calcular rangos de fecha del mes
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Obtener todos los usuarios
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        salaryType: true,
        baseSalary: true,
        hourlyRate: true,
        profitSharePercent: true,
      },
    });

    // Para calcular netIncome para PROFIT_SHARE:
    // Ingresos Totales (facturas pagadas + transacciones INCOME pagadas)
    const paidInvoices = await db.invoice.findMany({
      where: {
        status: "PAID",
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const paidIncomeTransactions = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const totalIncome =
      paidInvoices.reduce((sum, inv) => sum + inv.amount, 0) +
      paidIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Gastos Totales (expenses reembolsados + transacciones EXPENSE pagadas + HONORARIOS pagados)
    const reimbursedExpenses = await db.expense.findMany({
      where: {
        reimbursed: true,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const paidExpenseTransactions = await db.transaction.findMany({
      where: {
        type: "EXPENSE",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const paidHonorariosTransactions = await db.transaction.findMany({
      where: {
        type: "HONORARIOS",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const totalExpenses =
      reimbursedExpenses.reduce((sum, e) => sum + e.amount, 0) +
      paidExpenseTransactions.reduce((sum, t) => sum + t.amount, 0) +
      paidHonorariosTransactions.reduce((sum, t) => sum + t.amount, 0);

    const netIncome = totalIncome - totalExpenses;

    // Obtener todas las transacciones pagadas del mes (para paidSoFar)
    const allPaidTransactionsThisMonth = await db.transaction.findMany({
      where: {
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Calcular reporte para cada usuario
    const settlementReports: UserSettlementReport[] = await Promise.all(
      users.map(async (user) => {
        let salary = 0;
        let reimbursements = 0;
        let paidSoFar = 0;
        let netIncomeForUser: number | undefined;
        let share: number | undefined;

        // Calcular salario según tipo
        if (user.salaryType === "MONTHLY") {
          salary = user.baseSalary ?? 0;
        } else if (user.salaryType === "HOURLY") {
          // Obtener horas trabajadas del mes
          const timeEntries = await db.timeEntry.findMany({
            where: {
              userId: user.id,
              status: "COMPLETED",
              startTime: {
                gte: monthStart,
                lte: monthEnd,
              },
            },
            select: {
              duration: true, // en segundos
            },
          });

          const totalHours = timeEntries.reduce(
            (sum, entry) => sum + (entry.duration ?? 0) / 3600,
            0
          );
          salary = totalHours * (user.hourlyRate ?? 0);
        } else if (user.salaryType === "PROFIT_SHARE") {
          // Para socios, calcular share
          netIncomeForUser = netIncome;
          const profitSharePercent = user.profitSharePercent ?? 0;
          share = netIncome * (profitSharePercent / 100);
          salary = share;
        }

        // Calcular reembolsos pendientes (Expenses no reembolsados)
        const pendingExpenses = await db.expense.findMany({
          where: {
            paidByUserId: user.id,
            reimbursed: false,
          },
        });

        reimbursements = pendingExpenses.reduce(
          (sum, exp) => sum + exp.amount,
          0
        );

        // Calcular pagos realizados este mes (SALARY o HONORARIOS)
        // Buscar transacciones donde userId === user.id y tipo sea HONORARIOS o (EXPENSE con categoría SALARY)
        const userPaidTransactions = allPaidTransactionsThisMonth.filter(
          (t) =>
            t.userId === user.id &&
            (t.type === "HONORARIOS" ||
              (t.type === "EXPENSE" && t.category === "SALARY"))
        );

        paidSoFar = userPaidTransactions.reduce(
          (sum, t) => sum + t.amount,
          0
        );

        // Calcular restante a pagar
        const remaining = salary + reimbursements - paidSoFar;

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          salaryType: user.salaryType ?? "MONTHLY",
          salary,
          reimbursements,
          paidSoFar,
          remaining: Math.max(0, remaining), // No puede ser negativo
          ...(user.salaryType === "PROFIT_SHARE" && {
            netIncome: netIncomeForUser,
            share,
          }),
        };
      })
    );

    // Filtrar según rol
    // Mostrar todos los usuarios, incluso si no tienen transacciones
    let filteredReports = settlementReports;
    
    // Si no es ADMIN, filtrar solo el reporte del usuario actual
    if (!isAdmin) {
      filteredReports = filteredReports.filter((r) => r.userId === currentUserId);
    }

    return {
      success: true,
      data: filteredReports,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener reporte de liquidación",
    };
  }
}

/**
 * Server Action para procesar el pago de salario/honorarios
 * Crea una Transaction y marca Expenses como reembolsados si corresponde
 */
export async function processSalaryPayment(
  input: unknown
): Promise<ApiResponse<Transaction>> {
  try {
    // Verificar que el usuario actual sea ADMIN
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para realizar esta acción",
      };
    }

    // Validar con Zod
    const validatedData = processSalaryPaymentSchema.parse(input);

    // Verificar que el usuario receptor existe
    const recipientUser = await db.user.findUnique({
      where: { id: validatedData.recipientUserId },
      select: {
        id: true,
        name: true,
        salaryType: true,
      },
    });

    if (!recipientUser) {
      return {
        success: false,
        error: "Usuario receptor no encontrado",
      };
    }

    // Determinar el tipo de transacción según el salaryType del usuario
    const transactionType =
      recipientUser.salaryType === "PROFIT_SHARE" ? "HONORARIOS" : "EXPENSE";

    // Crear la Transaction
    const transaction = await db.transaction.create({
      data: {
        amount: validatedData.amount,
        type: transactionType,
        status: "PAID",
        description:
          validatedData.description ||
          `Pago de ${transactionType === "HONORARIOS" ? "honorarios" : "salario"} - ${validatedData.month}/${validatedData.year}`,
        category: transactionType === "EXPENSE" ? "SALARY" : undefined,
        userId: validatedData.recipientUserId,
      },
    });

    // Si includeReimbursements es true, marcar Expenses como reembolsados
    if (validatedData.includeReimbursements) {
      await db.expense.updateMany({
        where: {
          paidByUserId: validatedData.recipientUserId,
          reimbursed: false,
        },
        data: {
          reimbursed: true,
        },
      });
    }

    // Revalidar rutas
    revalidatePath("/finance/settlement");
    revalidatePath("/finance");

    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al procesar pago de salario",
    };
  }
}

