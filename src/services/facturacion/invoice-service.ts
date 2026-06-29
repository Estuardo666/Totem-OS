// Servicio de facturación electrónica
// Creación de ElectronicInvoice + encolamiento de SriJob

import { db as prisma } from "@/lib/db";
import type { ElectronicInvoice, ElectronicInvoiceItem } from "@prisma/client";
import { enqueueJob } from "./job-service";
import { generarClaveAcceso, formatearSecuencial, formatearSerie, generarCodigoNumerico } from "@/lib/sri/clave-acceso";
import { TIPOS_COMPROBANTE, CODIGOS_TIPO_IDENTIFICACION, FORMAS_PAGO } from "@/lib/sri/types";
import { getOrCreateConfig } from "./configuracion-service";

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

  // 2. Obtener y actualizar secuencial (atómico)
  const secuencialNumero = await obtenerSiguienteSecuencial(
    TIPOS_COMPROBANTE.FACTURA,
    config.establecimiento,
    config.puntoEmision
  );

  const secuencialFormateado = formatearSecuencial(secuencialNumero);
  const secuencialDisplay = `${config.establecimiento}-${config.puntoEmision}-${secuencialFormateado}`;

  // 3. Calcular montos
  const itemsCalculados = datos.items.map((item) => calcularItem(item));
  const subtotalSinImpuestos = itemsCalculados.reduce((s, i) => s + i.precioTotalSinImpuesto, 0);

  const subtotal0 = itemsCalculados
    .filter((i) => i.tipoIva === "0" || i.tipoIva === "6" || i.tipoIva === "7")
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
  const valorIva = itemsCalculados.reduce((s, i) => s + i.valorImpuesto, 0);
  const importeTotal = subtotalSinImpuestos + valorIva;

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
        subtotal4,
        subtotal15,
        valorIva,
        totalDescuento: 0,
        propina: 0,
        importeTotal,
        moneda: "DOLAR",

        formaPagoCodigo: datos.formaPagoCodigo ?? FORMAS_PAGO.OTROS_SISTEMA_FINANCIERO,
        formaPagoPlazo: datos.formaPagoPlazo,
        formaPagoUnidad: datos.formaPagoUnidad,

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

    return created;
  });

  // 6. Encolar job para el worker
  await enqueueJob({
    type: "EMITIR_FACTURA",
    facturaId: factura.id,
    payload: {
      enviarEmail: datos.enviarEmail ?? false,
    },
  });

  return factura;
}

/**
 * Anula una factura autorizada emitiendo una Nota de Crédito.
 */
export async function anularFactura(
  facturaId: string,
  motivo: string,
  tipoModificacion: string = "ANULACION"
): Promise<void> {
  const factura = await prisma.electronicInvoice.findUniqueOrThrow({
    where: { id: facturaId },
    include: { items: true },
  });

  if (factura.estado !== "AUTORIZADA") {
    throw new Error("Solo se pueden anular facturas autorizadas por el SRI.");
  }

  const config = await getOrCreateConfig();

  // Obtener secuencial para NC
  const secuencialNumero = await obtenerSiguienteSecuencial(
    TIPOS_COMPROBANTE.NOTA_CREDITO,
    config.establecimiento,
    config.puntoEmision
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
  const nc = await prisma.creditNote.create({
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
  await enqueueJob({
    type: "NOTA_CREDITO",
    notaCreditoId: nc.id,
  });
}

/**
 * Cancela una factura que aún no fue enviada al SRI (localmente).
 */
export async function cancelarFacturaLocal(facturaId: string): Promise<void> {
  const factura = await prisma.electronicInvoice.findUniqueOrThrow({
    where: { id: facturaId },
  });

  if (!["PENDIENTE_FIRMA", "ERROR"].includes(factura.estado)) {
    throw new Error("Solo se pueden cancelar facturas que no han sido enviadas al SRI.");
  }

  await prisma.electronicInvoice.update({
    where: { id: facturaId },
    data: { estado: "CANCELADA_LOCAL" },
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
  const precioTotalSinImpuesto = Number(
    (item.cantidad * item.precioUnitario - (item.descuento ?? 0)).toFixed(2)
  );

  const porcentajeIva = getPorcentajeIva(item.tipoIva);
  const valorImpuesto = Number((precioTotalSinImpuesto * porcentajeIva / 100).toFixed(2));

  return {
    ...item,
    descuento: item.descuento ?? 0,
    precioTotalSinImpuesto,
    tarifa: porcentajeIva,
    valorImpuesto,
  };
}

function getPorcentajeIva(codigo: string): number {
  const map: Record<string, number> = { "0": 0, "2": 2, "4": 15, "6": 0, "7": 0 };
  return map[codigo] ?? 15;
}

function determinarTipoIdentificacion(identificacion: string): string {
  if (identificacion.length === 13) return CODIGOS_TIPO_IDENTIFICACION.RUC;
  if (identificacion.length === 10) return CODIGOS_TIPO_IDENTIFICACION.CEDULA;
  return CODIGOS_TIPO_IDENTIFICACION.CONSUMIDOR_FINAL;
}

async function obtenerSiguienteSecuencial(
  tipoComprobante: string,
  establecimiento: string,
  puntoEmision: string
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    // Buscar o crear secuencial
    let secuencial = await tx.secuencialComprobante.findUnique({
      where: {
        tipoComprobante_establecimiento_puntoEmision: {
          tipoComprobante,
          establecimiento,
          puntoEmision,
        },
      },
    });

    if (!secuencial) {
      secuencial = await tx.secuencialComprobante.create({
        data: {
          tipoComprobante,
          establecimiento,
          puntoEmision,
          ultimoSecuencial: 0,
          siguiente: 1,
        },
      });
    }

    const siguiente = secuencial.siguiente;

    // Actualizar atómicamente
    await tx.secuencialComprobante.update({
      where: { id: secuencial.id },
      data: { siguiente: siguiente + 1 },
    });

    return siguiente;
  });
}
