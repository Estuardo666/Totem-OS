// Worker SRI - Procesador de comprobantes electrónicos
// Ejecutar con: SRI_MODO=LOCAL SRI_AMBIENTE=1 DATABASE_URL=... node worker/dist/index.js
// O con: pm2 start worker/dist/index.js --name sri-worker

import { dequeueJob, completeJob, failJob } from "../src/services/facturacion/job-service";
import { db as prisma } from "../src/lib/db";
import { buildFacturaXml } from "../src/lib/sri/xml/factura-builder";
import { buildNotaCreditoXml } from "../src/lib/sri/xml/nota-credito-builder";
import { firmarXml, obtenerHuellaCertificado } from "../src/lib/sri/xml-signer";
import { enviarRecepcion, consultarAutorizacion, verificarConectividadSri, extraerMensajesError, esRechazoRecuperable } from "../src/lib/sri/sri-soap-client";
import { descifrarP12 } from "../src/lib/sri/p12-cipher";
import { generarRidePdf, nombreArchivoRide, nombreArchivoXml } from "../src/lib/sri/ride-pdf";
import { enviarComprobanteEmail } from "../src/lib/sri/email-service";
import { SRI_URLS } from "../src/lib/sri/types";
import type { FacturaXmlData, NotaCreditoXmlData, TotalImpuesto } from "../src/lib/sri/types";

const POLL_INTERVAL = parseInt(process.env.SRI_POLL_INTERVAL ?? "5000");
const WORKER_ID = process.env.SRI_WORKER_ID ?? `worker-${Date.now()}`;
const MODO = process.env.SRI_MODO ?? "LOCAL";
const AMBIENTE = process.env.SRI_AMBIENTE ?? "1";
const TOTEM_API_URL = process.env.TOTEM_API_URL;
const WORKER_SECRET = process.env.FACTURACION_WORKER_SECRET;

let running = true;
let lastHeartbeat = 0;

async function main() {
  console.log(`[SRI Worker] Iniciando - ID: ${WORKER_ID}, Modo: ${MODO}, Ambiente: ${AMBIENTE}`);
  console.log(`[SRI Worker] Polling cada ${POLL_INTERVAL}ms`);

  // Verificar conectividad con SRI al arrancar
  const sriAlcanzable = await verificarConectividadSri(AMBIENTE);
  console.log(`[SRI Worker] SRI alcanzable: ${sriAlcanzable}`);

  // Loop principal
  while (running) {
    try {
      // Heartbeat cada 30 segundos
      if (Date.now() - lastHeartbeat > 30000) {
        await heartbeat(sriAlcanzable);
        lastHeartbeat = Date.now();
      }

      // Buscar siguiente job
      const job = await dequeueJob();

      if (job) {
        console.log(`[SRI Worker] Procesando job ${job.id} - Tipo: ${job.type}`);
        await procesarJob(job);
      } else {
        await sleep(POLL_INTERVAL);
      }
    } catch (error) {
      console.error("[SRI Worker] Error en loop principal:", error);
      await sleep(POLL_INTERVAL);
    }
  }
}

async function procesarJob(job: { id: string; type: string; facturaId?: string | null; notaCreditoId?: string | null; retencionId?: string | null; payload?: string | null }) {
  try {
    switch (job.type) {
      case "EMITIR_FACTURA":
        await procesarFactura(job);
        break;
      case "NOTA_CREDITO":
        await procesarNotaCredito(job);
        break;
      case "CONSULTAR_AUTORIZACION":
        await procesarConsultaAutorizacion(job);
        break;
      case "TEST":
        await completeJob(job.id, { test: true, sriAlcanzable: await verificarConectividadSri(AMBIENTE) });
        break;
      default:
        throw new Error(`Tipo de job desconocido: ${job.type}`);
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    console.error(`[SRI Worker] Error procesando job ${job.id}:`, mensaje);
    await failJob(job.id, mensaje);
  }
}

async function procesarFactura(job: { id: string; facturaId?: string | null; payload?: string | null }) {
  if (!job.facturaId) throw new Error("facturaId requerido");

  const factura = await prisma.electronicInvoice.findUniqueOrThrow({
    where: { id: job.facturaId },
    include: { items: true },
  });

  const config = await prisma.companyConfig.findFirst();
  if (!config) throw new Error("CompanyConfig no encontrada");

  // 1. Construir XML
  console.log(`[SRI Worker] Construyendo XML para ${factura.secuencial}`);
  const xmlData: FacturaXmlData = {
    infoTributaria: {
      ambiente: config.sriAmbiente,
      tipoEmision: "1",
      razonSocial: config.razonSocial,
      nombreComercial: config.nombreComercial ?? config.razonSocial,
      ruc: config.ruc,
      claveAcceso: factura.claveAcceso!,
      codDoc: "01",
      estab: config.establecimiento,
      ptoEmi: config.puntoEmision,
      secuencial: factura.secuencial.split("-")[2],
      dirMatriz: config.direccionMatriz,
    },
    infoFactura: {
      fechaEmision: formatDate(new Date(factura.fechaEmision)),
      dirEstablecimiento: config.direccionMatriz,
      obligadoContabilidad: config.obligadoContabilidad ? "SI" : "NO",
      tipoIdentificacionComprador: factura.tipoIdentificacion,
      razonSocialComprador: factura.razonSocial,
      identificacionComprador: factura.numeroIdentificacion,
      direccionComprador: factura.direccionCliente ?? undefined,
      totalSinImpuestos: factura.subtotalSinImpuestos,
      totalDescuento: factura.totalDescuento,
      totalConImpuestos: buildTotalImpuestos(factura),
      propina: factura.propina,
      importeTotal: factura.importeTotal,
      moneda: factura.moneda,
      pagos: [{
        formaPago: factura.formaPagoCodigo,
        total: factura.importeTotal,
        plazo: factura.formaPagoPlazo ?? undefined,
        unidadTiempo: factura.formaPagoUnidad ?? undefined,
      }],
    },
    detalles: factura.items.map((item) => ({
      codigoPrincipal: item.codigoPrincipal,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      descuento: item.descuento,
      precioTotalSinImpuesto: item.precioTotalSinImpuesto,
      impuestos: [{
        codigo: item.codigoImpuesto,
        codigoPorcentaje: item.codigoPorcentaje,
        tarifa: item.tarifa,
        baseImponible: item.baseImponible,
        valor: item.valorImpuesto,
      }],
    })),
  };

  const xmlContent = buildFacturaXml(xmlData);

  // 2. Firmar XML
  console.log(`[SRI Worker] Firmando XML con ${config.modoFirma}`);
  const p12Buffer = await obtenerP12(config);
  const xmlFirmado = firmarXml(xmlContent, p12Buffer, process.env.SRI_P12_PASSWORD ?? "");

  // Actualizar estado
  await prisma.electronicInvoice.update({
    where: { id: factura.id },
    data: { estado: "FIRMADA" },
  });

  // 3. Enviar al SRI
  console.log(`[SRI Worker] Enviando a SRI (${AMBIENTE === "1" ? "Pruebas" : "Producción"})`);
  const respuestaRecepcion = await enviarRecepcion(xmlFirmado, AMBIENTE);

  await prisma.electronicInvoice.update({
    where: { id: factura.id },
    data: { estado: "ENVIADA" },
  });

  if (respuestaRecepcion.estado === "DEVUELTA") {
    const mensajes = extraerMensajesError(respuestaRecepcion.comprobantes?.comprobante?.mensajes);
    throw new Error(`SRI devolvió la factura: ${mensajes.join("; ")}`);
  }

  // 4. Consultar autorización
  console.log(`[SRI Worker] Consultando autorización...`);
  await sleep(2000); // Esperar 2s antes de consultar

  let autorizado = false;
  let intentos = 0;
  const maxIntentos = 5;

  while (!autorizado && intentos < maxIntentos) {
    intentos++;
    const respuestaAuth = await consultarAutorizacion(factura.claveAcceso!, AMBIENTE);

    if (respuestaAuth.autorizaciones.autorizacion.length > 0) {
      const auth = respuestaAuth.autorizaciones.autorizacion[0];

      if (auth.estado === "AUTORIZADO") {
        // 5. Autorizado - generar RIDE y subir
        console.log(`[SRI Worker] AUTORIZADO - Generando RIDE...`);

        const pdfBuffer = await generarRidePdf({
          razonSocialEmisor: config.razonSocial,
          nombreComercialEmisor: config.nombreComercial ?? undefined,
          rucEmisor: config.ruc,
          dirMatriz: config.direccionMatriz,
          obligadoContabilidad: config.obligadoContabilidad ? "SI" : "NO",
          tipoComprobante: "FACTURA",
          numeroComprobante: factura.secuencial,
          claveAcceso: factura.claveAcceso!,
          numeroAutorizacion: auth.numeroAutorizacion,
          fechaAutorizacion: auth.fechaAutorizacion,
          fechaEmision: formatDate(new Date(factura.fechaEmision)),
          ambiente: config.sriAmbiente,
          tipoIdentificacionComprador: factura.tipoIdentificacion,
          razonSocialComprador: factura.razonSocial,
          identificacionComprador: factura.numeroIdentificacion,
          direccionComprador: factura.direccionCliente ?? undefined,
          subtotalSinImpuestos: factura.subtotalSinImpuestos,
          totalDescuento: factura.totalDescuento,
          valorIva: factura.valorIva,
          propina: factura.propina,
          importeTotal: factura.importeTotal,
          moneda: factura.moneda,
          formaPago: factura.formaPagoCodigo,
          formaPagoLabel: factura.formaPagoCodigo,
          detalles: factura.items.map((item) => ({
            codigo: item.codigoPrincipal,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            descuento: item.descuento,
            total: item.precioTotalSinImpuesto + item.valorImpuesto,
            iva: item.valorImpuesto,
          })),
          subtotal0: factura.subtotal0,
          subtotal12: factura.subtotal12 ?? 0,
          subtotal15: factura.subtotal15 ?? 0,
        });

        // Subir a UploadThing (si está configurado)
        let rideUrl: string | undefined;
        let xmlUrl: string | undefined;

        // Por ahora guardamos el XML en la BD
        await prisma.electronicInvoice.update({
          where: { id: factura.id },
          data: {
            estado: "AUTORIZADA",
            numeroAutorizacion: auth.numeroAutorizacion,
            fechaAutorizacion: new Date(auth.fechaAutorizacion),
            xmlSriResponse: auth.comprobante,
          },
        });

        // Actualizar secuencial
        const [estab, ptoEmi] = factura.secuencial.split("-");
        await prisma.secuencialComprobante.updateMany({
          where: {
            tipoComprobante: "01",
            establecimiento: estab,
            puntoEmision: ptoEmi,
          },
          data: { ultimoSecuencial: parseInt(factura.secuencial.split("-")[2]) },
        });

        // Enviar email si se solicitó
        const payload = job.payload ? JSON.parse(job.payload) : {};
        if (payload.enviarEmail && factura.emailCliente) {
          const emailConfig = await prisma.companyConfig.findFirst();
          if (emailConfig?.emailFrom) {
            await enviarComprobanteEmail({
              emailDestino: factura.emailCliente,
              factura,
              pdfBuffer,
              xmlContent: xmlFirmado,
              config: {
                proveedor: emailConfig.emailProveedor,
                from: emailConfig.emailFrom,
                replyTo: emailConfig.emailReplyTo ?? undefined,
                bccAdmin: emailConfig.emailBccAdmin,
                asuntoTemplate: emailConfig.emailAsuntoTemplate ?? undefined,
                cuerpoTemplate: emailConfig.emailCuerpoTemplate ?? undefined,
                logoUrl: emailConfig.emailLogoUrl ?? undefined,
              },
            });
          }
        }

        await completeJob(job.id, {
          autorizado: true,
          numeroAutorizacion: auth.numeroAutorizacion,
        });

        autorizado = true;
        console.log(`[SRI Worker] Factura ${factura.secuencial} AUTORIZADA`);

      } else if (auth.estado === "NO AUTORIZADO") {
        const mensajes = extraerMensajesError(auth.mensajes);
        throw new Error(`SRI no autorizó: ${mensajes.join("; ")}`);
      }
    }

    if (!autorizado) {
      console.log(`[SRI Worker] Aún no autorizada, reintento ${intentos}/${maxIntentos}...`);
      await sleep(3000);
    }
  }

  if (!autorizado) {
    throw new Error("SRI no autorizó después de múltiples intentos de consulta");
  }
}

async function procesarNotaCredito(job: { id: string; notaCreditoId?: string | null }) {
  if (!job.notaCreditoId) throw new Error("notaCreditoId requerido");

  const nc = await prisma.creditNote.findUniqueOrThrow({
    where: { id: job.notaCreditoId },
    include: { items: true, facturaOriginal: true },
  });

  const config = await prisma.companyConfig.findFirst();
  if (!config) throw new Error("CompanyConfig no encontrada");

  // Construir XML de NC
  const xmlData: NotaCreditoXmlData = {
    infoTributaria: {
      ambiente: config.sriAmbiente,
      tipoEmision: "1",
      razonSocial: config.razonSocial,
      nombreComercial: config.nombreComercial ?? config.razonSocial,
      ruc: config.ruc,
      claveAcceso: nc.claveAcceso!,
      codDoc: "04",
      estab: config.establecimiento,
      ptoEmi: config.puntoEmision,
      secuencial: nc.secuencial.split("-")[2],
      dirMatriz: config.direccionMatriz,
    },
    infoNotaCredito: {
      fechaEmision: formatDate(new Date(nc.fechaEmision)),
      tipoIdentificacionComprador: nc.tipoIdentificacion,
      razonSocialComprador: nc.razonSocial,
      identificacionComprador: nc.numeroIdentificacion,
      codDocModificado: "01",
      numDocModificado: nc.facturaOriginal.secuencial,
      fechaEmisionDocSustento: formatDate(new Date(nc.facturaOriginal.fechaEmision)),
      totalSinImpuestos: nc.subtotalSinImpuestos,
      valorModificacion: nc.importeTotal,
      moneda: nc.moneda,
      totalConImpuestos: [{
        codigo: "2",
        codigoPorcentaje: "4",
        baseImponible: nc.subtotalSinImpuestos,
        valor: nc.valorIva,
      }],
      motivo: nc.motivo,
    },
    detalles: nc.items.map((item) => ({
      codigoPrincipal: item.codigoPrincipal,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      descuento: item.descuento,
      precioTotalSinImpuesto: item.precioTotalSinImpuesto,
      impuestos: [{
        codigo: item.codigoImpuesto,
        codigoPorcentaje: item.codigoPorcentaje,
        tarifa: item.tarifa,
        baseImponible: item.baseImponible,
        valor: item.valorImpuesto,
      }],
    })),
  };

  const xmlContent = buildNotaCreditoXml(xmlData);
  const p12Buffer = await obtenerP12(config);
  const xmlFirmado = firmarXml(xmlContent, p12Buffer, process.env.SRI_P12_PASSWORD ?? "");

  const respuesta = await enviarRecepcion(xmlFirmado, AMBIENTE);

  if (respuesta.estado === "DEVUELTA") {
    const mensajes = extraerMensajesError(respuesta.comprobantes?.comprobante?.mensajes);
    throw new Error(`SRI devolvió la NC: ${mensajes.join("; ")}`);
  }

  await sleep(2000);
  const authResp = await consultarAutorizacion(nc.claveAcceso!, AMBIENTE);

  if (authResp.autorizaciones.autorizacion.length > 0) {
    const auth = authResp.autorizaciones.autorizacion[0];

    if (auth.estado === "AUTORIZADO") {
      await prisma.creditNote.update({
        where: { id: nc.id },
        data: {
          estado: "AUTORIZADA",
          numeroAutorizacion: auth.numeroAutorizacion,
          fechaAutorizacion: new Date(auth.fechaAutorizacion),
        },
      });

      // Marcar factura original como ANULADA
      await prisma.electronicInvoice.update({
        where: { id: nc.facturaOriginalId },
        data: { estado: "ANULADA", fechaAnulacion: new Date() },
      });

      await completeJob(job.id, { autorizado: true, numeroAutorizacion: auth.numeroAutorizacion });
      console.log(`[SRI Worker] NC ${nc.secuencial} AUTORIZADA`);
    } else {
      throw new Error("NC no autorizada por SRI");
    }
  }
}

async function procesarConsultaAutorizacion(job: { id: string; facturaId?: string | null }) {
  if (!job.facturaId) throw new Error("facturaId requerido");

  const factura = await prisma.electronicInvoice.findUniqueOrThrow({
    where: { id: job.facturaId },
  });

  if (!factura.claveAcceso) throw new Error("Factura sin clave de acceso");

  const respuesta = await consultarAutorizacion(factura.claveAcceso, AMBIENTE);

  if (respuesta.autorizaciones.autorizacion.length > 0) {
    const auth = respuesta.autorizaciones.autorizacion[0];

    await prisma.electronicInvoice.update({
      where: { id: factura.id },
      data: {
        estado: auth.estado === "AUTORIZADO" ? "AUTORIZADA" : "RECHAZADA",
        numeroAutorizacion: auth.numeroAutorizacion || null,
        fechaAutorizacion: auth.fechaAutorizacion ? new Date(auth.fechaAutorizacion) : null,
        xmlSriResponse: auth.comprobante || null,
        ultimoErrorSri: auth.mensajes ? extraerMensajesError(auth.mensajes).join("; ") : null,
      },
    });
  }

  await completeJob(job.id, { consulted: true });
}

// ── Helpers ──

async function obtenerP12(config: { modoFirma: string; p12LocalCifrado: Buffer | null; p12LocalIv: Buffer | null; p12LocalAuthTag: Buffer | null }): Promise<Buffer> {
  if (config.modoFirma === "NUBE") {
    // En modo NUBE, el .p12 está en un volumen montado
    const fs = await import("fs");
    const p12Path = process.env.SRI_P12_PATH ?? "/data/firma.p12";
    return fs.readFileSync(p12Path);
  }

  // En modo LOCAL, descargar de BD y descifrar
  if (!config.p12LocalCifrado || !config.p12LocalIv || !config.p12LocalAuthTag) {
    throw new Error("No hay .p12 local almacenado en la BD");
  }

  const masterKey = process.env.SRI_MASTER_KEY;
  if (!masterKey) throw new Error("SRI_MASTER_KEY no configurada");

  return descifrarP12(config.p12LocalCifrado, config.p12LocalIv, config.p12LocalAuthTag, masterKey);
}

function buildTotalImpuestos(factura: { subtotal0: number; subtotal2?: number; subtotal4?: number; subtotal15?: number; valorIva: number }): TotalImpuesto[] {
  const result: TotalImpuesto[] = [];

  if (factura.subtotal0 > 0) {
    result.push({ codigo: "2", codigoPorcentaje: "0", baseImponible: factura.subtotal0, valor: 0 });
  }
  if (factura.subtotal2 && factura.subtotal2 > 0) {
    result.push({ codigo: "2", codigoPorcentaje: "2", baseImponible: factura.subtotal2, valor: factura.subtotal2 * 0.02 });
  }
  if (factura.subtotal15 && factura.subtotal15 > 0) {
    result.push({ codigo: "2", codigoPorcentaje: "4", baseImponible: factura.subtotal15, valor: factura.subtotal15 * 0.15 });
  }

  if (result.length === 0) {
    result.push({ codigo: "2", codigoPorcentaje: "4", baseImponible: factura.subtotal0, valor: factura.valorIva });
  }

  return result;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

async function heartbeat(sriAlcanzable: boolean) {
  try {
    if (!TOTEM_API_URL || !WORKER_SECRET) {
      throw new Error("Faltan TOTEM_API_URL o FACTURACION_WORKER_SECRET");
    }

    const response = await fetch(`${TOTEM_API_URL.replace(/\/$/, "")}/api/facturacion/worker/latido`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      body: JSON.stringify({
        workerId: WORKER_ID,
        modo: MODO,
        hostname: process.env.HOSTNAME ?? require("os").hostname(),
        version: "0.1.0",
        sriAmbiente: AMBIENTE,
        sriAlcanzable,
      }),
    });

    if (!response.ok) {
      throw new Error(`Heartbeat rechazado por Totem OS (${response.status})`);
    }
  } catch (error) {
    console.error("[SRI Worker] Error en heartbeat:", error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[SRI Worker] Recibido SIGINT, cerrando...");
  running = false;
});

process.on("SIGTERM", () => {
  console.log("[SRI Worker] Recibido SIGTERM, cerrando...");
  running = false;
});

main().catch((error) => {
  console.error("[SRI Worker] Error fatal:", error);
  process.exit(1);
});
