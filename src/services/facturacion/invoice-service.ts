// Servicio de facturación electrónica
// Creación de ElectronicInvoice + encolamiento de SriJob

import { db as prisma } from "@/lib/sri/database";
import type { ElectronicInvoice, ElectronicInvoiceItem, Prisma } from "@prisma/client";
import { generarClaveAcceso, formatearSecuencial, formatearSerie, generarCodigoNumerico } from "@/lib/sri/clave-acceso";
import { TIPOS_COMPROBANTE, CODIGOS_TIPO_IDENTIFICACION, FORMAS_PAGO } from "@/lib/sri/types";
import { getOrCreateConfig } from "./configuracion-service";
import { calcularLineaSri, sriMoney } from "@/lib/sri/tax-calculation";
import { assertCreditNoteAllowed } from "@/lib/sri/credit-note-policy";
import { triggerSriWorker } from "@/lib/sri/trigger-worker";

interface ItemFactura {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  tipoIva: string; // "0","2","4","6","7"
}

interface DatosFactura {
  clientId: string;
  items: ItemFactura[];
  formaPagoCodigo?: string;
  formaPagoPlazo?: string;
  formaPagoUnidad?: string;
  invoiceId?: string; // si se emite desde Invoice existente
  enviarEmail?: boolean;
  infoAdicional?: Array<{ nombre: string; valor: string }>;
}

/**
 * Crea una factura electrónica y la encola para firma/envío al SRI.
 */
export async function emitirFactura(
  datos: DatosFactura
): Promise<ElectronicInvoice & { items: ElectronicInvoiceItem[] }> {
  const config = await getOrCreateConfig();

  // 1. Obtener datos del cliente
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: datos.clientId },
  });

  if (!client.numeroIdentificacion || !client.razonSocial) {
    throw new Error(
      "El cliente no tiene datos fiscales completos. Configure RUC/Cédula y Razón Social."
    );
  }

  const tipoIdentificacion = client.tipoIdentificacion ?? determinarTipoIdentificacion(client.numeroIdentificacion);
  if (!datos.items.length) throw new Error("Agregue al menos un item");
  const itemsCalculados = datos.items.map((item) => calcularItem(item));

  // 2. Obtener y actualizar secuencial (atómico)
  const secuencialNumero = await obtenerSiguienteSecuencial(
    TIPOS_COMPROBANTE.FACTURA,
    config.establecimiento,
    config.puntoEmision
  );

  const secuencialFormateado = formatearSecuencial(secuencialNumero);
  const secuencialDisplay = `${config.establecimiento}-${config.puntoEmision}-${secuencialFormateado}`;

  // 3. Calcular montos
  const subtotalSinImpuestos = sriMoney(itemsCalculados.reduce((s, i) => s + i.precioTotalSinImpuesto, 0));

  const subtotal0 = itemsCalculados
    .filter((i) => i.tipoIva === "0")
    .reduce((s, i) => s + i.precioTotalSinImpuesto, 0);
  const subtotal2 = itemsCalculados
    .filter((i) => i.tipoIva === "2")
    .reduce((s, i) => s + i.precioTotalSinImpuesto, 0);
  const subtotal4 = itemsCalculados
    .filter((i) => i.tipoIva === "4")
    .reduce((s, i) => s + i.precioTotalSinImpuesto, 0);
  const subtotal15 = itemsCalculados
    .filter((i) => i.tipoIva === "4") // código "4" = 15% IVA
    .reduce((s, i) => s + i.precioTotalSinImpuesto, 0);
  const valorIva = sriMoney(itemsCalculados.reduce((s, i) => s + i.valorImpuesto, 0));
  const importeTotal = sriMoney(subtotalSinImpuestos + valorIva);

  // 4. Generar clave de acceso
  const fecha = new Date();
  const serie = formatearSerie(config.establecimiento, config.puntoEmision);
  const claveAcceso = generarClaveAcceso({
    fecha,
    tipoComprobante: TIPOS_COMPROBANTE.FACTURA,
    ruc: config.ruc,
    ambiente: config.sriAmbiente,
    serie,
    numero: secuencialFormateado,
    codigoNumerico: generarCodigoNumerico(),
    tipoEmision: "1",
  });

  // 5. Crear ElectronicInvoice + items en transacción
  const factura = await prisma.$transaction(async (tx) => {
    const created = await tx.electronicInvoice.create({
      data: {
        claveAcceso,
        secuencial: secuencialDisplay,

        clientId: datos.clientId,
        tipoIdentificacion,
        numeroIdentificacion: client.numeroIdentificacion!,
        razonSocial: client.razonSocial!,
        direccionCliente: client.direccionFiscal,
        emailCliente: client.emailFacturacion ?? client.email,

        subtotalSinImpuestos,
        subtotal0,
        subtotal2,
        subtotal12: subtotal2,
        subtotal4,
        subtotal15,
        valorIva,
        totalDescuento: sriMoney(itemsCalculados.reduce((sum, item) => sum + item.descuento, 0)),
        propina: 0,
        importeTotal,
        moneda: "DOLAR",

        formaPagoCodigo: datos.formaPagoCodigo ?? FORMAS_PAGO.OTROS_SISTEMA_FINANCIERO,
        formaPagoPlazo: datos.formaPagoPlazo,
        formaPagoUnidad: datos.formaPagoUnidad,

        infoAdicional: serializarInfoAdicional(datos.infoAdicional),

        estado: "PENDIENTE_FIRMA",
        invoiceId: datos.invoiceId,

        items: {
          create: itemsCalculados.map((item) => ({
            codigoPrincipal: item.codigo,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            descuento: item.descuento,
            precioTotalSinImpuesto: item.precioTotalSinImpuesto,
            codigoImpuesto: "2", // IVA
            codigoPorcentaje: item.tipoIva,
            tarifa: item.tarifa,
            baseImponible: item.precioTotalSinImpuesto,
            valorImpuesto: item.valorImpuesto,
          })),
        },
      },
      include: { items: true },
    });

    // Actualizar el Invoice existente si aplica
    if (datos.invoiceId) {
      await tx.invoice.update({
        where: { id: datos.invoiceId },
        data: { electronicInvoice: { connect: { id: created.id } } },
      });
    }

    await tx.sriJob.create({ data: { type: "EMITIR_FACTURA", facturaId: created.id, payload: JSON.stringify({ enviarEmail: datos.enviarEmail ?? false }), status: "PENDING" } });
    return created;
  });

  await triggerSriWorker();
  return factura;
}

/**
 * Normaliza los campos adicionales y los serializa como JSON para persistirlos.
 * El SRI admite hasta 15 campos, con nombre y valor de 300 caracteres.
 */
function serializarInfoAdicional(
  campos?: Array<{ nombre: string; valor: string }>
): string | undefined {
  if (!campos || campos.length === 0) return undefined;

  const limpios = campos
    .map((campo) => ({
      nombre: campo.nombre.trim().slice(0, 300),
      valor: campo.valor.trim().slice(0, 300),
    }))
    .filter((campo) => campo.nombre && campo.valor)
    .slice(0, 15);

  return limpios.length > 0 ? JSON.stringify(limpios) : undefined;
}

/**
 * Anula una factura autorizada emitiendo una Nota de Crédito.
 */
export async function anularFactura(
  facturaId: string,
  motivo: string,
  tipoModificacion: string = "ANULACION"
): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ElectronicInvoice" WHERE id = ${facturaId} FOR UPDATE`;
  const factura = await tx.electronicInvoice.findUniqueOrThrow({
    where: { id: facturaId },
    include: { items: true },
  });

  assertCreditNoteAllowed(factura);
  if (!motivo.trim()) throw new Error("Indique el motivo de la nota de crédito.");
  const pendingNote = await tx.creditNote.findFirst({ where: { facturaOriginalId: facturaId, estado: { in: ["PENDIENTE_FIRMA", "FIRMADA", "ENVIADA", "AUTORIZADA"] } }, select: { id: true } });
  if (pendingNote) throw new Error("Esta factura ya tiene una nota de crédito en proceso o autorizada.");

  const config = await tx.companyConfig.findFirstOrThrow();

  // Obtener secuencial para NC
  const secuencialNumero = await obtenerSiguienteSecuencial(
    TIPOS_COMPROBANTE.NOTA_CREDITO,
    config.establecimiento,
    config.puntoEmision, tx
  );

  const secuencialFormateado = formatearSecuencial(secuencialNumero);
  const secuencialDisplay = `${config.establecimiento}-${config.puntoEmision}-${secuencialFormateado}`;

  // Generar clave de acceso para NC
  const fecha = new Date();
  const serie = formatearSerie(config.establecimiento, config.puntoEmision);
  const claveAcceso = generarClaveAcceso({
    fecha,
    tipoComprobante: TIPOS_COMPROBANTE.NOTA_CREDITO,
    ruc: config.ruc,
    ambiente: config.sriAmbiente,
    serie,
    numero: secuencialFormateado,
    codigoNumerico: generarCodigoNumerico(),
    tipoEmision: "1",
  });

  // Crear NC
  const nc = await tx.creditNote.create({
    data: {
      claveAcceso,
      secuencial: secuencialDisplay,
      facturaOriginalId: facturaId,
      clientId: factura.clientId,
      tipoIdentificacion: factura.tipoIdentificacion,
      numeroIdentificacion: factura.numeroIdentificacion,
      razonSocial: factura.razonSocial,
      subtotalSinImpuestos: factura.subtotalSinImpuestos,
      valorIva: factura.valorIva,
      importeTotal: factura.importeTotal,
      moneda: factura.moneda,
      motivo,
      tipoModificacion,
      estado: "PENDIENTE_FIRMA",
      items: {
        create: factura.items.map((item) => ({
          codigoPrincipal: item.codigoPrincipal,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          descuento: item.descuento,
          precioTotalSinImpuesto: item.precioTotalSinImpuesto,
          codigoImpuesto: item.codigoImpuesto,
          codigoPorcentaje: item.codigoPorcentaje,
          tarifa: item.tarifa,
          baseImponible: item.baseImponible,
          valorImpuesto: item.valorImpuesto,
        })),
      },
    },
  });

  // Encolar NC para firma/envío
  await tx.sriJob.create({ data: {
    type: "NOTA_CREDITO",
    notaCreditoId: nc.id, status: "PENDING",
  } });
  });
  await triggerSriWorker();
}

/**
 * Cancela una factura que aún no fue enviada al SRI (localmente).
 */
export async function cancelarFacturaLocal(facturaId: string): Promise<void> {
  await prisma.$transaction(async tx => {
    const jobs = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status" FROM "SriJob" WHERE "facturaId" = ${facturaId} FOR UPDATE
    `;
    if (jobs.some(job => job.status === "RUNNING")) throw new Error("El worker ya está procesando esta factura.");
    const changed = await tx.electronicInvoice.updateMany({ where: { id: facturaId, estado: { in: ["PENDIENTE_FIRMA", "ERROR"] } }, data: { estado: "CANCELADA_LOCAL" } });
    if (!changed.count) throw new Error("Solo se pueden cancelar facturas que no han sido enviadas al SRI.");
    await tx.sriJob.updateMany({ where: { facturaId, status: "PENDING" }, data: { status: "FAILED", error: "CANCELADA_LOCAL", procesadoAt: new Date() } });
  });
}

/**
 * Obtiene facturas con filtros y paginación.
 */
export async function getFacturas(filtros: {
  clientId?: string;
  estado?: string;
  desde?: Date;
  hasta?: Date;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filtros.page ?? 1;
  const pageSize = filtros.pageSize ?? 20;

  const where: Record<string, unknown> = {};

  if (filtros.clientId) where.clientId = filtros.clientId;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.desde || filtros.hasta) {
    where.fechaEmision = {};
    if (filtros.desde) (where.fechaEmision as Record<string, Date>).gte = filtros.desde;
    if (filtros.hasta) (where.fechaEmision as Record<string, Date>).lte = filtros.hasta;
  }
  if (filtros.busqueda) {
    where.OR = [
      { secuencial: { contains: filtros.busqueda } },
      { razonSocial: { contains: filtros.busqueda } },
      { numeroIdentificacion: { contains: filtros.busqueda } },
      { claveAcceso: { contains: filtros.busqueda } },
    ];
  }

  const [facturas, total] = await Promise.all([
    prisma.electronicInvoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { name: true, logo: true } },
        notasCredito: { select: { secuencial: true, estado: true } },
      },
    }),
    prisma.electronicInvoice.count({ where }),
  ]);

  return { facturas, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Obtiene el resumen (dashboard) de facturas.
 */
export async function getResumenFacturas() {
  const [pendientes, autorizadas, rechazadas, anuladas, totalFacturado] = await Promise.all([
    prisma.electronicInvoice.count({
      where: { estado: { in: ["PENDIENTE_FIRMA", "FIRMADA", "ENVIADA"] } },
    }),
    prisma.electronicInvoice.count({ where: { estado: "AUTORIZADA" } }),
    prisma.electronicInvoice.count({ where: { estado: "RECHAZADA" } }),
    prisma.electronicInvoice.count({ where: { estado: "ANULADA" } }),
    prisma.electronicInvoice.aggregate({
      _sum: { importeTotal: true },
      where: { estado: "AUTORIZADA" },
    }),
  ]);

  const montoPendiente = await prisma.electronicInvoice.aggregate({
    _sum: { importeTotal: true },
    where: { estado: { in: ["PENDIENTE_FIRMA", "FIRMADA", "ENVIADA"] } },
  });

  const montoRechazado = await prisma.electronicInvoice.aggregate({
    _sum: { importeTotal: true },
    where: { estado: "RECHAZADA" },
  });

  const montoAnulado = await prisma.electronicInvoice.aggregate({
    _sum: { importeTotal: true },
    where: { estado: "ANULADA" },
  });

  return {
    pendientes,
    autorizadas,
    rechazadas,
    anuladas,
    montoAutorizado: totalFacturado._sum.importeTotal ?? 0,
    montoPendiente: montoPendiente._sum.importeTotal ?? 0,
    montoRechazado: montoRechazado._sum.importeTotal ?? 0,
    montoAnulado: montoAnulado._sum.importeTotal ?? 0,
  };
}

// ── Helpers internos ──

function calcularItem(item: ItemFactura) {
  return { ...item, ...calcularLineaSri(item) };
}

function determinarTipoIdentificacion(identificacion: string): string {
  if (identificacion.length === 13) return CODIGOS_TIPO_IDENTIFICACION.RUC;
  if (identificacion.length === 10) return CODIGOS_TIPO_IDENTIFICACION.CEDULA;
  return CODIGOS_TIPO_IDENTIFICACION.CONSUMIDOR_FINAL;
}

async function obtenerSiguienteSecuencial(tipoComprobante: string, establecimiento: string, puntoEmision: string, client: Prisma.TransactionClient = prisma): Promise<number> {
  const counter = await client.secuencialComprobante.upsert({
    where: { tipoComprobante_establecimiento_puntoEmision: { tipoComprobante, establecimiento, puntoEmision } },
    create: { tipoComprobante, establecimiento, puntoEmision, ultimoSecuencial: 0, siguiente: 2 },
    update: { siguiente: { increment: 1 } },
  });
  const assigned = counter.siguiente - 1;
  if (assigned < 1 || assigned > 999999999) throw new Error('Secuencial agotado');
  return assigned;
}
