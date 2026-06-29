"use server";

// Server Actions para gestión de facturas electrónicas

import { auth } from "@/auth";
import { emitirFactura, anularFactura, cancelarFacturaLocal, getFacturas, getResumenFacturas } from "@/services/facturacion/invoice-service";
import { revalidatePath } from "next/cache";

/**
 * Emite una nueva factura electrónica.
 */
export async function emitirFacturaAction(data: {
  clientId: string;
  items: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento?: number;
    tipoIva: string;
  }>;
  formaPagoCodigo?: string;
  formaPagoPlazo?: string;
  formaPagoUnidad?: string;
  invoiceId?: string;
  enviarEmail?: boolean;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  if (!data.clientId) throw new Error("Seleccione un cliente");
  if (!data.items || data.items.length === 0) throw new Error("Agregue al menos un item");

  const factura = await emitirFactura(data);

  revalidatePath("/admin/facturacion/facturas");
  revalidatePath("/admin/facturacion");

  return {
    success: true,
    facturaId: factura.id,
    secuencial: factura.secuencial,
    claveAcceso: factura.claveAcceso,
    importeTotal: factura.importeTotal,
    estado: factura.estado,
  };
}

/**
 * Emite una factura electrónica desde un Invoice existente.
 */
export async function emitirDesdeInvoiceAction(invoiceId: string, enviarEmail = true) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  // Obtener datos del Invoice
  const { db: prisma } = await import("@/lib/db");
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { client: true },
  });

  if (invoice.status === "PAID") {
    throw new Error("Este cobro ya está pagado y no necesita factura electrónica.");
  }

  // Verificar que no tenga FE ya emitida
  const existing = await prisma.electronicInvoice.findUnique({
    where: { invoiceId },
  });
  if (existing) {
    throw new Error("Este cobro ya tiene una factura electrónica emitida.");
  }

  // Construir items desde el Invoice (un item genérico por el monto total)
  const factura = await emitirFactura({
    clientId: invoice.clientId,
    items: [
      {
        codigo: "SERV-001",
        descripcion: `Servicio de marketing digital - ${invoice.client.name}`,
        cantidad: 1,
        precioUnitario: invoice.amount,
        tipoIva: "4", // 15% IVA por defecto
      },
    ],
    formaPagoCodigo: "20",
    invoiceId: invoice.id,
    enviarEmail,
  });

  revalidatePath("/finance/receivables");
  revalidatePath("/admin/facturacion/facturas");
  revalidatePath("/admin/facturacion");

  return {
    success: true,
    facturaId: factura.id,
    secuencial: factura.secuencial,
  };
}

/**
 * Anula una factura autorizada (genera Nota de Crédito).
 */
export async function anularFacturaAction(
  facturaId: string,
  motivo: string,
  tipoModificacion = "ANULACION"
) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  if (!motivo || motivo.trim().length < 5) {
    throw new Error("El motivo de anulación debe tener al menos 5 caracteres.");
  }

  await anularFactura(facturaId, motivo, tipoModificacion);

  revalidatePath("/admin/facturacion/facturas");
  revalidatePath(`/admin/facturacion/facturas/${facturaId}`);
  revalidatePath("/admin/facturacion");

  return { success: true };
}

/**
 * Cancela una factura que aún no fue enviada al SRI.
 */
export async function cancelarFacturaLocalAction(facturaId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await cancelarFacturaLocal(facturaId);

  revalidatePath("/admin/facturacion/facturas");
  revalidatePath("/admin/facturacion");

  return { success: true };
}

/**
 * Obtiene facturas con filtros.
 */
export async function getFacturasAction(filtros: {
  clientId?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  busqueda?: string;
  page?: number;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  return getFacturas({
    ...filtros,
    desde: filtros.desde ? new Date(filtros.desde) : undefined,
    hasta: filtros.hasta ? new Date(filtros.hasta) : undefined,
  });
}

/**
 * Obtiene el resumen del dashboard.
 */
export async function getResumenFacturasAction() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  return getResumenFacturas();
}
