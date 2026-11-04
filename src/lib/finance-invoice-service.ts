/**
 * Finance Invoice Service
 * Gestiónde facturas (CRUD)
 */

import { db } from "@/lib/db";
import type { Invoice } from "@prisma/client";
import type { InvoiceStatus } from "@/types";

export interface CreateInvoiceInput {
  amount: number;
  status: InvoiceStatus;
  clientId: string;
  dueDate?: Date;
  generatedAt?: Date;
  paidAt?: Date;
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
      paidAt: data.paidAt ?? (data.status === "PAID" ? new Date() : null),
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
  invoiceId: string,
  paidAt: Date = new Date()
): Promise<Invoice> {
  return db.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt },
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
    status?: InvoiceStatus;
    clientId?: string;
    dueDate?: Date | null;
    generatedAt?: Date;
  }
): Promise<Invoice> {
  // Solo los campos editables: cualquier otra clave del payload (como `id`)
  // nunca llega a Prisma. `undefined` deja el valor actual intacto.
  const { amount, status, clientId, dueDate, generatedAt } = data;

  // Marcarla pagada desde la edición registra la fecha de cobro, como
  // markInvoiceAsPaidInDb; los reportes de ingresos filtran por paidAt.
  let paidAt: Date | undefined;
  if (status === "PAID") {
    const current = await db.invoice.findUnique({ where: { id }, select: { paidAt: true } });
    if (current && !current.paidAt) paidAt = new Date();
  }

  return db.invoice.update({
    where: { id },
    data: { amount, status, clientId, dueDate, generatedAt, paidAt },
  });
}

/**
 * Obtiene facturas filtradas
 */
export async function getInvoicesFromDb(options?: {
  clientId?: string;
  status?: InvoiceStatus;
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
  status?: InvoiceStatus;
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
