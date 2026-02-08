/**
 * Finance Invoice Service
 * Gestiónde facturas (CRUD)
 */

import { db } from "@/lib/db";
import type { Invoice } from "@prisma/client";

export interface CreateInvoiceInput {
  amount: number;
  status: "PENDING" | "PAID" | "OVERDUE";
  clientId: string;
  dueDate?: Date;
  generatedAt?: Date;
}

/**
 * Crea una nueva factura
 */
export async function createInvoiceInDb(
  data: CreateInvoiceInput
): Promise<Invoice> {
  return db.invoice.create({
    data: {
      amount: data.amount,
      status: data.status,
      clientId: data.clientId,
      dueDate: data.dueDate ?? null,
      generatedAt: data.generatedAt ?? new Date(),
    },
  });
}

/**
 * Crea una factura pagada (registra pago)
 */
export async function registerPaymentInDb(input: {
  amount: number;
  clientId: string;
  description?: string;
}): Promise<Invoice> {
  return db.invoice.create({
    data: {
      amount: input.amount,
      status: "PAID",
      clientId: input.clientId,
      generatedAt: new Date(),
    },
    include: {
      client: true,
    },
  }) as Promise<Invoice>;
}

/**
 * Obtiene una factura por ID
 */
export async function getInvoiceByIdFromDb(id: string): Promise<Invoice | null> {
  return db.invoice.findUnique({
    where: { id },
    include: {
      client: true,
    },
  });
}

/**
 * Marca una factura como pagada
 */
export async function markInvoiceAsPaidInDb(
  invoiceId: string
): Promise<Invoice> {
  return db.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID" },
    include: {
      client: true,
    },
  });
}

/**
 * Actualiza una factura
 */
export async function updateInvoiceInDb(
  id: string,
  data: {
    amount?: number;
    status?: "PENDING" | "PAID" | "OVERDUE";
    dueDate?: Date | null;
  }
): Promise<Invoice> {
  return db.invoice.update({
    where: { id },
    data,
  });
}

/**
 * Obtiene facturas filtradas
 */
export async function getInvoicesFromDb(options?: {
  clientId?: string;
  status?: "PENDING" | "PAID" | "OVERDUE";
  startDate?: Date;
  endDate?: Date;
}): Promise<Invoice[]> {
  return db.invoice.findMany({
    where: {
      ...(options?.clientId && { clientId: options.clientId }),
      ...(options?.status && { status: options.status }),
      ...(options?.startDate && options?.endDate && {
        generatedAt: {
          gte: options.startDate,
          lte: options.endDate,
        },
      }),
    },
    include: {
      client: true,
    },
    orderBy: {
      generatedAt: "desc",
    },
  });
}

/**
 * Obtiene suma de facturas
 */
export async function getInvoicesSumFromDb(options?: {
  status?: "PENDING" | "PAID" | "OVERDUE";
  startDate?: Date;
  endDate?: Date;
}): Promise<number> {
  const invoices = await getInvoicesFromDb(options);
  return invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
}

/**
 * Obtiene facturas pendientes (PENDING + OVERDUE)
 */
export async function getPendingInvoicesFromDb(
  clientId?: string
): Promise<Invoice[]> {
  return db.invoice.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      ...(clientId && { clientId }),
    },
    include: {
      client: true,
    },
    orderBy: {
      dueDate: "asc",
    },
  });
}

/**
 * Obtiene suma de facturas pendientes
 */
export async function getPendingInvoicesSumFromDb(
  clientId?: string
): Promise<number> {
  const invoices = await getPendingInvoicesFromDb(clientId);
  return invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
}

/**
 * Elimina una factura
 */
export async function deleteInvoiceFromDb(id: string): Promise<void> {
  await db.invoice.delete({ where: { id } });
}
