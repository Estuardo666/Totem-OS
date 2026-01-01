"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createClientSchema, createCredentialSchema, updateClientSchema } from "@/schemas/client";
import type { ApiResponse } from "@/types";
import type { Client, Credential, ContentTask, BrandAsset } from "@prisma/client";

/**
 * Server Action para crear un cliente
 * Valida con Zod, guarda en Prisma y revalida la ruta
 */
export async function createClient(
  input: unknown
): Promise<ApiResponse<Client>> {
  try {
    // 1. Validar con Zod
    const validatedData = createClientSchema.parse(input);

    // 2. Operación de DB
    const client = await db.client.create({
      data: {
        name: validatedData.name,
        status: validatedData.status,
        color: validatedData.color || "#000000",
        // Los campos JSON se guardan como String en SQLite
        brandKit: validatedData.brandKit
          ? JSON.stringify(validatedData.brandKit)
          : null,
        vault: validatedData.vault
          ? JSON.stringify(validatedData.vault)
          : null,
        planConfig: validatedData.planConfig
          ? JSON.stringify(validatedData.planConfig)
          : null,
        monthlyReels: validatedData.monthlyReels ?? 0,
        monthlyFlyers: validatedData.monthlyFlyers ?? 0,
        monthlyRate: validatedData.monthlyRate ?? 0,
        lastPostDate: validatedData.lastPostDate ?? null,
        editorId: validatedData.editorId ?? null,
        communityId: validatedData.communityId ?? null,
      },
    });

    // 3. Revalidar la ruta de clientes
    revalidatePath("/clients");

    // 4. Retornar éxito
    return { success: true, data: client };
  } catch (error) {
    // 5. Manejar errores
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear cliente",
    };
  }
}

/**
 * Server Action para actualizar un cliente
 * Valida con Zod, actualiza en Prisma y revalida la ruta
 */
export async function updateClient(
  id: string,
  input: unknown
): Promise<ApiResponse<Client>> {
  try {
    // 1. Validar con Zod
    const validatedData = updateClientSchema.parse(input);

    // 2. Operación de DB
    const client = await db.client.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
        ...(validatedData.color !== undefined && { color: validatedData.color }),
        ...(validatedData.brandKit !== undefined && {
          brandKit: validatedData.brandKit
            ? JSON.stringify(validatedData.brandKit)
            : null,
        }),
        ...(validatedData.vault !== undefined && {
          vault: validatedData.vault
            ? JSON.stringify(validatedData.vault)
            : null,
        }),
        ...(validatedData.planConfig !== undefined && {
          planConfig: validatedData.planConfig
            ? JSON.stringify(validatedData.planConfig)
            : null,
        }),
        ...(validatedData.monthlyReels !== undefined && {
          monthlyReels: validatedData.monthlyReels,
        }),
        ...(validatedData.monthlyFlyers !== undefined && {
          monthlyFlyers: validatedData.monthlyFlyers,
        }),
        ...(validatedData.monthlyRate !== undefined && {
          monthlyRate: validatedData.monthlyRate,
        }),
        ...(validatedData.lastPostDate !== undefined && {
          lastPostDate: validatedData.lastPostDate ?? null,
        }),
        ...(validatedData.editorId !== undefined && {
          editorId: validatedData.editorId ?? null,
        }),
        ...(validatedData.communityId !== undefined && {
          communityId: validatedData.communityId ?? null,
        }),
      },
    });

    // 3. Revalidar las rutas
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    // Si se actualizó editorId o communityId, revalidar /content para que las asignaciones automáticas funcionen
    if (validatedData.editorId !== undefined || validatedData.communityId !== undefined) {
      revalidatePath("/content");
    }

    // 4. Retornar éxito
    return { success: true, data: client };
  } catch (error) {
    // 5. Manejar errores
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar cliente",
    };
  }
}

/**
 * Server Action para obtener la rentabilidad de un cliente
 * Calcula ingresos pagados - gastos vinculados
 */
export async function getClientProfitability(
  clientId: string
): Promise<ApiResponse<{ income: number; expenses: number; profitability: number }>> {
  try {
    // Obtener ingresos pagados del cliente (facturas y transacciones)
    const paidInvoices = await db.invoice.findMany({
      where: {
        clientId,
        status: "PAID",
      },
    });

    const paidIncomeTransactions = await db.transaction.findMany({
      where: {
        relatedClientId: clientId,
        type: "INCOME",
        status: "PAID",
      },
    });

    const totalIncome = 
      paidInvoices.reduce((sum, inv) => sum + inv.amount, 0) +
      paidIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Obtener gastos vinculados al cliente
    const clientExpenses = await db.expense.findMany({
      where: {
        clientId,
      },
    });

    const clientExpenseTransactions = await db.transaction.findMany({
      where: {
        relatedClientId: clientId,
        type: "EXPENSE",
      },
    });

    const totalExpenses = 
      clientExpenses.reduce((sum, exp) => sum + exp.amount, 0) +
      clientExpenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    const profitability = totalIncome - totalExpenses;

    return {
      success: true,
      data: {
        income: totalIncome,
        expenses: totalExpenses,
        profitability,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al calcular rentabilidad",
    };
  }
}

/**
 * Server Action para obtener todos los clientes
 * Retorna los clientes ordenados por fecha de creación descendente
 */
export async function getClients(): Promise<ApiResponse<Client[]>> {
  try {
    const clients = await db.client.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: clients };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener clientes",
    };
  }
}

// Tipo para Client con relaciones incluidas
export type ClientWithRelations = Client & {
  tasks: ContentTask[];
  credentials: Credential[];
  brandAssets: BrandAsset[];
};

/**
 * Server Action para obtener un cliente por ID
 * Incluye todas sus tareas y credenciales
 */
export async function getClientById(
  id: string
): Promise<ApiResponse<ClientWithRelations & { hasPendingFeedback: boolean }>> {
  try {
    const client = await db.client.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            metrics: true,
          },
          orderBy: { createdAt: "desc" },
        },
        credentials: {
          orderBy: { createdAt: "desc" },
        },
        brandAssets: {
          orderBy: { createdAt: "desc" },
        },
        editor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        community: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!client) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    // Intentar obtener feedbacks pendientes de forma segura
    let hasPendingFeedback = false;
    try {
      const feedbacks = await db.clientFeedback.findMany({
        where: {
          clientId: id,
          viewed: false,
        },
        take: 1,
      });
      hasPendingFeedback = feedbacks.length > 0;
    } catch (feedbackError) {
      // Si la tabla no existe aún, simplemente ignorar el error
      // Esto permite que la página funcione mientras se migra la base de datos
      console.warn("No se pudo verificar feedbacks pendientes:", feedbackError);
    }

    return {
      success: true,
      data: {
        ...client,
        hasPendingFeedback,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener cliente",
    };
  }
}

export interface ClientReportData {
  client: {
    id: string;
    name: string;
    monthlyReels: number;
    monthlyFlyers: number;
    monthlyRate: number;
  };
  deliverables: {
    reelsCompleted: number;
    flyersCompleted: number;
    reelsContracted: number;
    flyersContracted: number;
    completedTasks: Array<{
      id: string;
      title: string;
      type: string;
      publishedAt: Date | null;
    }>;
  };
  financial: {
    currentMonthInvoice: {
      amount: number;
      status: string;
      dueDate: Date | null;
    } | null;
    linkedExpenses: Array<{
      id: string;
      description: string;
      amount: number;
      category: string;
      date: Date;
    }>;
  };
  weeklyEffort: Array<{
    week: string;
    weekNumber: number;
    tasksCount: number;
  }>;
  month: string;
  year: number;
}

/**
 * Server Action para obtener datos del reporte mensual del cliente
 */
export async function getClientReportData(
  clientId: string,
  month?: number,
  year?: number
): Promise<ApiResponse<ClientReportData>> {
  try {
    // Obtener cliente
    const clientResult = await getClientById(clientId);
    if (!clientResult.success || !clientResult.data) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    const client = clientResult.data;

    // Determinar mes y año (por defecto mes actual)
    const now = new Date();
    const reportMonth = month ?? now.getMonth();
    const reportYear = year ?? now.getFullYear();

    // Calcular rango de fechas del mes
    const monthStart = new Date(reportYear, reportMonth, 1);
    const monthEnd = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59, 999);

    // Obtener tareas del mes (completadas y publicadas)
    const tasks = await db.contentTask.findMany({
      where: {
        clientId,
        publishedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
    });

    // Contar entregables completados
    const reelsCompleted = tasks.filter((t) => t.type === "REEL").length;
    const flyersCompleted = tasks.filter((t) => t.type === "FLYER").length;

    // Obtener factura del mes actual
    const invoice = await db.invoice.findFirst({
      where: {
        clientId,
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    // Obtener gastos vinculados al cliente del mes (solo PENDING - no reembolsados)
    const expenses = await db.expense.findMany({
      where: {
        clientId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        reimbursed: false, // Solo gastos pendientes de reembolso
      },
      orderBy: {
        date: "desc",
      },
    });

    // Obtener transacciones de tipo EXPENSE pendientes vinculadas al cliente
    const expenseTransactions = await db.transaction.findMany({
      where: {
        type: "EXPENSE",
        status: "PENDING", // Solo gastos pendientes
        relatedClientId: clientId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calcular esfuerzo semanal
    const weeklyEffort: Array<{ week: string; weekNumber: number; tasksCount: number }> = [];
    const weeksInMonth = Math.ceil((monthEnd.getDate() - monthStart.getDate() + 1) / 7);
    
    for (let week = 0; week < weeksInMonth; week++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(weekStart.getDate() + week * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());

      const weekTasks = tasks.filter((task) => {
        if (!task.publishedAt) return false;
        const taskDate = new Date(task.publishedAt);
        return taskDate >= weekStart && taskDate <= weekEnd;
      });

      const weekNumber = week + 1;
      weeklyEffort.push({
        week: `Semana ${weekNumber}`,
        weekNumber,
        tasksCount: weekTasks.length,
      });
    }

    // Nombres de meses en español
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    return {
      success: true,
      data: {
        client: {
          id: client.id,
          name: client.name,
          monthlyReels: client.monthlyReels,
          monthlyFlyers: client.monthlyFlyers,
          monthlyRate: client.monthlyRate,
        },
        deliverables: {
          reelsCompleted,
          flyersCompleted,
          reelsContracted: client.monthlyReels,
          flyersContracted: client.monthlyFlyers,
          completedTasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            type: t.type,
            publishedAt: t.publishedAt,
          })),
        },
        financial: {
          currentMonthInvoice: invoice
            ? {
                amount: invoice.amount,
                status: invoice.status,
                dueDate: invoice.dueDate,
              }
            : null,
          linkedExpenses: [
            ...expenses.map((e) => ({
              id: e.id,
              description: e.description,
              amount: e.amount,
              category: e.category,
              date: e.date,
            })),
            ...expenseTransactions.map((t) => ({
              id: t.id,
              description: t.description || "Gasto",
              amount: t.amount,
              category: t.category || "OTROS",
              date: t.createdAt,
            })),
          ],
        },
        weeklyEffort,
        month: monthNames[reportMonth],
        year: reportYear,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener datos del reporte",
    };
  }
}

/**
 * Server Action para generar un token de enlace compartido para el cliente
 */
export async function generateShareToken(
  clientId: string
): Promise<ApiResponse<{ shareToken: string; shareUrl: string }>> {
  try {
    // Generar UUID único
    const shareToken = randomUUID();

    // Actualizar el cliente con el token
    const client = await db.client.update({
      where: { id: clientId },
      data: { shareToken },
    });

    // Construir la URL compartida
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reports/share/${shareToken}`;

    return {
      success: true,
      data: {
        shareToken: client.shareToken!,
        shareUrl,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al generar enlace compartido",
    };
  }
}

/**
 * Server Action para obtener un cliente por su shareToken
 */
export async function getClientByShareToken(
  shareToken: string
): Promise<ApiResponse<ClientWithRelations>> {
  try {
    const client = await db.client.findUnique({
      where: { shareToken },
      include: {
        tasks: {
          orderBy: { createdAt: "desc" },
        },
        credentials: {
          orderBy: { createdAt: "desc" },
        },
        brandAssets: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) {
      return {
        success: false,
        error: "Enlace no válido o expirado",
      };
    }

    return { success: true, data: client };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener cliente",
    };
  }
}

/**
 * Server Action para agregar una credencial
 * Valida con Zod, guarda en Prisma y revalida la ruta
 */
export async function addCredential(
  input: unknown
): Promise<ApiResponse<Credential>> {
  try {
    // 1. Validar con Zod
    const validatedData = createCredentialSchema.parse(input);

    // 2. Operación de DB
    const credential = await db.credential.create({
      data: {
        service: validatedData.service,
        username: validatedData.username,
        password: validatedData.password,
        url: validatedData.url || null,
        clientId: validatedData.clientId,
      },
    });

    // 3. Revalidar la ruta del cliente
    revalidatePath(`/clients/${validatedData.clientId}`);

    // 4. Retornar éxito
    return { success: true, data: credential };
  } catch (error) {
    // 5. Manejar errores
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear credencial",
    };
  }
}

/**
 * Server Action para eliminar una credencial
 */
export async function deleteCredential(
  id: string
): Promise<ApiResponse<void>> {
  try {
    // Obtener la credencial para saber el clientId antes de borrarla
    const credential = await db.credential.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!credential) {
      return {
        success: false,
        error: "Credencial no encontrada",
      };
    }

    // Eliminar la credencial
    await db.credential.delete({
      where: { id },
    });

    // Revalidar la ruta del cliente
    revalidatePath(`/clients/${credential.clientId}`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al eliminar credencial",
    };
  }
}

/**
 * Server Action para agregar un Brand Asset
 * Guarda la información del archivo subido en UploadThing
 */
export async function addBrandAsset(
  input: {
    name: string;
    url: string;
    fileKey: string;
    fileType: string;
    clientId: string;
  }
): Promise<ApiResponse<BrandAsset>> {
  try {
    const asset = await db.brandAsset.create({
      data: {
        name: input.name,
        url: input.url,
        fileKey: input.fileKey,
        fileType: input.fileType,
        clientId: input.clientId,
      },
    });

    revalidatePath(`/clients/${input.clientId}`);

    return { success: true, data: asset };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al agregar asset",
    };
  }
}

/**
 * Server Action para obtener el cumplimiento del contrato mensual
 * Retorna los conteos de tareas publicadas por tipo
 */
export async function getContractFulfillment(
  clientId: string
): Promise<ApiResponse<{ publishedReels: number; publishedFlyers: number }>> {
  try {
    const { countPublishedTasksByType } = await import("@/lib/finance-logic");
    
    const [publishedReels, publishedFlyers] = await Promise.all([
      countPublishedTasksByType(clientId, "REEL"),
      countPublishedTasksByType(clientId, "FLYER"),
    ]);

    return {
      success: true,
      data: { publishedReels, publishedFlyers },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener cumplimiento del contrato",
    };
  }
}

/**
 * Server Action para eliminar un Brand Asset
 * También elimina el archivo de UploadThing usando UTApi
 */
export async function deleteBrandAsset(
  id: string
): Promise<ApiResponse<void>> {
  try {
    // Obtener el asset para saber el clientId y fileKey
    const asset = await db.brandAsset.findUnique({
      where: { id },
      select: { clientId: true, fileKey: true },
    });

    if (!asset) {
      return {
        success: false,
        error: "Asset no encontrado",
      };
    }

    // Eliminar el archivo de UploadThing usando UTApi
    try {
      const { UTApi } = await import("uploadthing/server");
      const utapi = new UTApi();
      await utapi.deleteFiles(asset.fileKey);
    } catch (error) {
      console.error("Error al eliminar archivo de UploadThing:", error);
      // Continuar con la eliminación de la BD aunque falle UploadThing
    }

    // Eliminar el asset de la BD
    await db.brandAsset.delete({
      where: { id },
    });

    revalidatePath(`/clients/${asset.clientId}`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al eliminar asset",
    };
  }
}

