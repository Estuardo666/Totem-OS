// Worker SRI - Procesador de comprobantes electrónicos
// Ejecutar con: SRI_MODO=LOCAL SRI_AMBIENTE=1 DATABASE_URL=... node worker/dist/index.js
// O con: pm2 start worker/dist/index.js --name sri-worker

import { dequeueJob, completeJob, failJob } from "../src/services/facturacion/job-service";
import { db as prisma } from "../src/lib/sri/database";
import { buildFacturaXml } from "../src/lib/sri/xml/factura-builder";
import { buildNotaCreditoXml } from "../src/lib/sri/xml/nota-credito-builder";
import { firmarXml, obtenerHuellaCertificado } from "../src/lib/sri/xml-signer";
import { enviarRecepcion, consultarAutorizacion, verificarConectividadSri, extraerMensajesError, esRechazoRecuperable } from "../src/lib/sri/sri-soap-client";
import { descifrarP12 } from "../src/lib/sri/p12-cipher";
import { generarRideFactura } from "../src/lib/sri/invoice-ride";
import { enviarComprobanteEmail } from "../src/lib/sri/email-service";
import { SRI_URLS } from "../src/lib/sri/types";
import { assertSriDocumentEnvironment, assertSriWorkerDatabase, sriEmailAllowed } from "../src/lib/sri/execution-policy";
import { registrarLatido } from "../src/services/facturacion/configuracion-service";
import { agruparImpuestosSri } from "../src/lib/sri/tax-calculation";
import { assertCreditNoteAllowed } from "../src/lib/sri/credit-note-policy";
import { sriDisplayDate } from "../src/lib/sri/ecuador-date";
import type { FacturaXmlData, NotaCreditoXmlData } from "../src/lib/sri/types";

const POLL_INTERVAL = parseInt(process.env.SRI_POLL_INTERVAL ?? "5000");
const WORKER_ID = process.env.SRI_WORKER_ID ?? `worker-${Date.now()}`;
const MODO = process.env.SRI_MODO ?? "LOCAL";
const AMBIENTE = process.env.SRI_AMBIENTE ?? "1";
const APP_API_URL = process.env.APP_API_URL || process.env.TOTEM_API_URL;
const WORKER_SECRET = process.env.FACTURACION_WORKER_SECRET;

let running = true;
let lastHeartbeat = 0;

export async function startSRIWorker() {
  assertSriWorkerDatabase(AMBIENTE, process.env.DATABASE_URL);
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
    if (mensaje === "SRI_AUTHORIZATION_PENDING") {
      await prisma.sriJob.update({ where: { id: job.id }, data: { status: "PENDING", disponibleAt: new Date(Date.now() + 60_000), error: null } });
      return;
    }
    console.error(`[SRI Worker] Error procesando job ${job.id}:`, mensaje);
    const sriCodes = [...mensaje.matchAll(/\[(\d+)\]/g)].map(match => match[1]);
    const permanent = sriCodes.length > 0 && sriCodes.every(code => !esRechazoRecuperable(code));
    await failJob(job.id, mensaje, permanent ? 1 : 3);
  }
}

export async function procesarFactura(job: { id: string; facturaId?: string | null; payload?: string | null }, submit = true) {
  if (!job.facturaId) throw new Error("facturaId requerido");

  const factura = await prisma.electronicInvoice.findUniqueOrThrow({
    where: { id: job.facturaId },
    include: { items: true },
  });
  if (factura.estado === "CANCELADA_LOCAL") throw new Error("Factura cancelada localmente; envío bloqueado");

  const config = await prisma.companyConfig.findFirst();
  if (!config) throw new Error("CompanyConfig no encontrada");
  assertSriDocumentEnvironment(AMBIENTE, config.sriAmbiente, factura.claveAcceso);

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
      totalConImpuestos: agruparImpuestosSri(factura.items),
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
  if (!submit) return { xmlFirmado, xmlData };

  if (factura.estado !== "ENVIADA") {
  // Actualizar estado
  await prisma.electronicInvoice.update({
    where: { id: factura.id },
    data: { estado: "FIRMADA" },
  });

  // 3. Enviar al SRI
  console.log(`[SRI Worker] Enviando a SRI (${AMBIENTE === "1" ? "Pruebas" : "Producción"})`);
  const respuestaRecepcion = await enviarRecepcion(xmlFirmado, AMBIENTE, 15_000);

  await prisma.electronicInvoice.update({
    where: { id: factura.id },
    data: { estado: "ENVIADA", intentosSri: { increment: 1 } },
  });

  if (respuestaRecepcion.estado === "DEVUELTA") {
    const mensajes = extraerMensajesError(respuestaRecepcion.comprobantes?.comprobante?.mensajes);
    await prisma.electronicInvoice.update({ where: { id: factura.id }, data: { estado: "RECHAZADA", ultimoErrorSri: mensajes.join("; ") } });
    throw new Error(`SRI devolvió la factura: ${mensajes.join("; ")}`);
  }
  }

  // 4. Consultar autorización
  console.log(`[SRI Worker] Consultando autorización...`);
  await sleep(2000); // Esperar 2s antes de consultar

  let autorizado = false;
  let intentos = 0;
  const maxIntentos = process.env.SRI_HTTP_MODE === "1" ? 1 : 5;

  while (!autorizado && intentos < maxIntentos) {
    intentos++;
    const respuestaAuth = await consultarAutorizacion(factura.claveAcceso!, AMBIENTE, 10_000);

    if (respuestaAuth.autorizaciones.autorizacion.length > 0) {
      const auth = respuestaAuth.autorizaciones.autorizacion[0];

      if (auth.estado === "AUTORIZADO") {
        // 5. Autorizado - generar RIDE y subir
        console.log(`[SRI Worker] AUTORIZADO - Generando RIDE...`);

        const pdfBuffer = await generarRideFactura(factura, config, auth);

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
            ultimoErrorSri: null,
            codigoErrorSri: null,
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
        if (sriEmailAllowed(AMBIENTE) && payload.enviarEmail && factura.emailCliente) {
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
        await prisma.electronicInvoice.update({ where: { id: factura.id }, data: { estado: "RECHAZADA", ultimoErrorSri: mensajes.join("; ") } });
        throw new Error(`SRI no autorizó: ${mensajes.join("; ")}`);
      }
    }

    if (!autorizado) {
      console.log(`[SRI Worker] Aún no autorizada, reintento ${intentos}/${maxIntentos}...`);
      await sleep(3000);
    }
  }

  if (!autorizado) {
    throw new Error("SRI_AUTHORIZATION_PENDING");
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
  assertCreditNoteAllowed(nc.facturaOriginal);

  // Construir XML de NC
  assertSriDocumentEnvironment(AMBIENTE, config.sriAmbiente, nc.claveAcceso);
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
      totalConImpuestos: agruparImpuestosSri(nc.items),
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

  if (nc.estado !== "ENVIADA") {
  const respuesta = await enviarRecepcion(xmlFirmado, AMBIENTE, 15_000);

  if (respuesta.estado === "DEVUELTA") {
    const mensajes = extraerMensajesError(respuesta.comprobantes?.comprobante?.mensajes);
    await prisma.creditNote.update({ where: { id: nc.id }, data: { estado: "RECHAZADA", ultimoErrorSri: mensajes.join("; ") } });
    throw new Error(`SRI devolvió la NC: ${mensajes.join("; ")}`);
  }
  await prisma.creditNote.update({ where: { id: nc.id }, data: { estado: "ENVIADA", intentosSri: { increment: 1 } } });
  }

  await sleep(2000);
  const authResp = await consultarAutorizacion(nc.claveAcceso!, AMBIENTE, 10_000);

  if (authResp.autorizaciones.autorizacion.length > 0) {
    const auth = authResp.autorizaciones.autorizacion[0];

    if (auth.estado === "AUTORIZADO") {
      await prisma.creditNote.update({
        where: { id: nc.id },
        data: {
          estado: "AUTORIZADA",
          numeroAutorizacion: auth.numeroAutorizacion,
          fechaAutorizacion: new Date(auth.fechaAutorizacion),
          ultimoErrorSri: null,
        },
      });

      // Marcar factura original como ANULADA
      await prisma.electronicInvoice.update({
        where: { id: nc.facturaOriginalId },
        data: { estado: "ANULADA", fechaAnulacion: new Date() },
      });

      await completeJob(job.id, { autorizado: true, numeroAutorizacion: auth.numeroAutorizacion, xmlAutorizado: auth.comprobante });
      console.log(`[SRI Worker] NC ${nc.secuencial} AUTORIZADA`);
    } else {
      const messages = extraerMensajesError(auth.mensajes);
      await prisma.creditNote.update({ where: { id: nc.id }, data: { estado: "RECHAZADA", ultimoErrorSri: messages.join("; ") } });
      throw new Error(`NC no autorizada por SRI: ${messages.join("; ")}`);
    }
  } else {
    throw new Error("SRI_AUTHORIZATION_PENDING");
  }
}

async function procesarConsultaAutorizacion(job: { id: string; facturaId?: string | null }) {
  if (!job.facturaId) throw new Error("facturaId requerido");

  const factura = await prisma.electronicInvoice.findUniqueOrThrow({
    where: { id: job.facturaId },
  });

  if (!factura.claveAcceso) throw new Error("Factura sin clave de acceso");
  const config = await prisma.companyConfig.findFirst();
  if (!config) throw new Error("CompanyConfig no encontrada");
  assertSriDocumentEnvironment(AMBIENTE, config.sriAmbiente, factura.claveAcceso);

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

function formatDate(date: Date): string {
  return sriDisplayDate(date);
}

async function heartbeat(sriAlcanzable: boolean) {
  try {
    if (AMBIENTE === "1") {
      await registrarLatido({ workerId: WORKER_ID, modo: MODO, hostname: process.env.HOSTNAME ?? require("os").hostname(), version: "0.1.0", sriAmbiente: AMBIENTE, sriAlcanzable });
      return;
    }
    if (!APP_API_URL || !WORKER_SECRET) {
      throw new Error("Faltan APP_API_URL o FACTURACION_WORKER_SECRET");
    }

    const response = await fetch(`${APP_API_URL.replace(/\/$/, "")}/api/facturacion/worker/latido`, {
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

export async function processSriOnce() {
  assertSriWorkerDatabase(AMBIENTE, process.env.DATABASE_URL);
  const job = await dequeueJob();
  await heartbeat(true);
  if (!job) return { processed: false };
  await procesarJob(job);
  const result = await prisma.sriJob.findUnique({ where: { id: job.id }, select: { status: true } });
  return { processed: true, status: result?.status };
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

if (require.main === module && process.env.SRI_HTTP_MODE !== "1") {
  startSRIWorker().catch((error) => {
    console.error("[SRI Worker] Error fatal:", error);
    process.exit(1);
  });
}
