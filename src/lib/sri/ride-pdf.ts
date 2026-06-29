// Generador de RIDE (Representación Impresa de Documentos Electrónicos) - PDF
// Según especificaciones del SRI Ecuador

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

interface RideData {
  // Emisor
  razonSocialEmisor: string;
  nombreComercialEmisor?: string;
  rucEmisor: string;
  dirMatriz: string;
  dirEstablecimiento?: string;
  obligadoContabilidad: string;

  // Comprobante
  tipoComprobante: string; // "FACTURA", "NOTA DE CRÉDITO", "COMPROBANTE DE RETENCIÓN"
  numeroComprobante: string; // "001-001-000000001"
  claveAcceso: string;
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  fechaEmision: string;
  ambiente: string;

  // Cliente
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;

  // Montos
  subtotalSinImpuestos: number;
  totalDescuento: number;
  valorIva: number;
  propina: number;
  importeTotal: number;
  moneda: string;
  formaPago: string;
  formaPagoLabel: string;

  // Detalles
  detalles: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    total: number;
    iva: number;
  }>;

  // Totales por tipo de IVA
  subtotal0: number;
  subtotal12: number;
  subtotal15: number;
}

/**
 * Genera el PDF del RIDE (Representación Impresa de Documento Electrónico).
 * Retorna un Buffer con el contenido del PDF.
 */
export async function generarRidePdf(data: RideData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Generar QR con la clave de acceso
      const qrDataUrl = await QRCode.toDataURL(data.claveAcceso, {
        width: 120,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `${data.tipoComprobante} ${data.numeroComprobante}`,
          Author: data.razonSocialEmisor,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 80; // márgenes

      // ════════════════════════════════════════════
      // ENCABEZADO
      // ════════════════════════════════════════════

      // Título del comprobante
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(data.tipoComprobante.toUpperCase(), 40, 40, { align: "center" });
      doc.moveDown(0.3);

      // RUC y razón social del emisor
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`RUC: ${data.rucEmisor}`, 40, doc.y, { align: "center" });
      doc
        .fontSize(11)
        .text(data.razonSocialEmisor, 40, doc.y + 2, { align: "center" });
      if (data.nombreComercialEmisor && data.nombreComercialEmisor !== data.razonSocialEmisor) {
        doc
          .fontSize(9)
          .font("Helvetica")
          .text(data.nombreComercialEmisor, 40, doc.y + 2, { align: "center" });
      }
      doc.moveDown(0.5);

      // Dirección y obligado contabilidad
      doc
        .fontSize(8)
        .font("Helvetica")
        .text(`Dirección Matriz: ${data.dirMatriz}`, 40, doc.y, { align: "center" });
      if (data.dirEstablecimiento) {
        doc.text(`Dirección Establecimiento: ${data.dirEstablecimiento}`, 40, doc.y + 2, { align: "center" });
      }
      doc.text(`Obligado a contabilidad: ${data.obligadoContabilidad}`, 40, doc.y + 2, { align: "center" });
      doc.moveDown(0.8);

      // Línea separadora
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      // ════════════════════════════════════════════
      // DATOS DEL COMPROBANTE + QR
      // ════════════════════════════════════════════

      const qrX = pageWidth - 90;
      const qrY = doc.y;

      // QR a la derecha
      doc.image(qrBuffer, qrX, qrY, { width: 90, height: 90 });

      // Datos a la izquierda
      const leftWidth = pageWidth - 110;
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("Número de Autorización:", 40, qrY);
      doc
        .font("Helvetica")
        .fontSize(7)
        .text(data.numeroAutorizacion, 40, doc.y + 1, { width: leftWidth });

      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(8).text("Clave de Acceso:");
      doc.font("Helvetica").fontSize(7).text(data.claveAcceso, 40, doc.y + 1, { width: leftWidth });

      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(8).text("Fecha y Hora de Autorización:");
      doc.font("Helvetica").fontSize(8).text(data.fechaAutorizacion);

      doc.moveDown(0.3);
      doc.text(`Ambiente: ${data.ambiente === "1" ? "PRUEBAS" : "PRODUCCIÓN"}`, 40, doc.y);
      doc.text(`Emisión: NORMAL`, 40, doc.y + 2);
      doc.text(`Fecha Emisión: ${data.fechaEmision}`, 40, doc.y + 2);
      doc.text(`Número: ${data.numeroComprobante}`, 40, doc.y + 2);

      doc.moveDown(1);

      // ════════════════════════════════════════════
      // DATOS DEL CLIENTE
      // ════════════════════════════════════════════
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("DATOS DEL CLIENTE", 40, doc.y);
      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(8)
        .text(`Identificación: ${data.identificacionComprador}`, 40, doc.y);
      doc.text(`Razón Social: ${data.razonSocialComprador}`, 40, doc.y + 2);
      if (data.direccionComprador) {
        doc.text(`Dirección: ${data.direccionComprador}`, 40, doc.y + 2);
      }
      doc.text(`Forma de Pago: ${data.formaPagoLabel}`, 40, doc.y + 2);

      doc.moveDown(1);

      // ════════════════════════════════════════════
      // TABLA DE DETALLES
      // ════════════════════════════════════════════
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      // Encabezado de tabla
      const cols = {
        codigo: { x: 40, w: 60 },
        descripcion: { x: 100, w: 180 },
        cant: { x: 280, w: 40 },
        pUnit: { x: 320, w: 60 },
        desc: { x: 380, w: 50 },
        total: { x: 430, w: 60 },
      };

      const headerY = doc.y;
      doc.font("Helvetica-Bold").fontSize(7);
      doc.text("Código", cols.codigo.x, headerY, { width: cols.codigo.w });
      doc.text("Descripción", cols.descripcion.x, headerY, { width: cols.descripcion.w });
      doc.text("Cant.", cols.cant.x, headerY, { width: cols.cant.w, align: "right" });
      doc.text("P.Unitario", cols.pUnit.x, headerY, { width: cols.pUnit.w, align: "right" });
      doc.text("Desc.", cols.desc.x, headerY, { width: cols.desc.w, align: "right" });
      doc.text("Total", cols.total.x, headerY, { width: cols.total.w, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.3);

      // Filas
      doc.font("Helvetica").fontSize(7);
      for (const det of data.detalles) {
        const rowY = doc.y;
        doc.text(det.codigo, cols.codigo.x, rowY, { width: cols.codigo.w });
        doc.text(det.descripcion, cols.descripcion.x, rowY, {
          width: cols.descripcion.w,
        });
        doc.text(String(det.cantidad), cols.cant.x, rowY, {
          width: cols.cant.w,
          align: "right",
        });
        doc.text(formatMoney(det.precioUnitario), cols.pUnit.x, rowY, {
          width: cols.pUnit.w,
          align: "right",
        });
        doc.text(formatMoney(det.descuento), cols.desc.x, rowY, {
          width: cols.desc.w,
          align: "right",
        });
        doc.text(formatMoney(det.total), cols.total.x, rowY, {
          width: cols.total.w,
          align: "right",
        });
        doc.moveDown(0.4);
      }

      doc.moveDown(0.5);

      // ════════════════════════════════════════════
      // TOTALES
      // ════════════════════════════════════════════
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      const totalsX = 300;
      const totalsValueX = 430;
      const totalsW = 60;

      const drawTotal = (label: string, value: string, bold = false) => {
        const font = bold ? "Helvetica-Bold" : "Helvetica";
        doc.font(font).fontSize(8);
        doc.text(label, totalsX, doc.y, { width: 120 });
        doc.text(value, totalsValueX, doc.y - 10, {
          width: totalsW,
          align: "right",
        });
        doc.moveDown(0.2);
      };

      if (data.subtotal0 > 0) drawTotal("Subtotal 0%:", formatMoney(data.subtotal0));
      if (data.subtotal12 > 0) drawTotal("Subtotal 12%:", formatMoney(data.subtotal12));
      if (data.subtotal15 > 0) drawTotal("Subtotal 15%:", formatMoney(data.subtotal15));
      if (data.subtotalSinImpuestos > 0 && data.subtotal0 === 0 && data.subtotal12 === 0 && data.subtotal15 === 0) {
        drawTotal("Subtotal:", formatMoney(data.subtotalSinImpuestos));
      }
      if (data.totalDescuento > 0) drawTotal("Descuento:", formatMoney(data.totalDescuento));
      drawTotal("IVA:", formatMoney(data.valorIva));
      if (data.propina > 0) drawTotal("Propina:", formatMoney(data.propina));
      doc.moveDown(0.2);
      drawTotal("TOTAL:", formatMoney(data.importeTotal), true);

      doc.moveDown(1);

      // ════════════════════════════════════════════
      // PIE DE PÁGINA
      // ════════════════════════════════════════════
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      doc
        .font("Helvetica")
        .fontSize(7)
        .text(
          "Este documento es la representación impresa de un comprobante electrónico.",
          40,
          doc.y,
          { align: "center" }
        );
      doc.text(
        "Puede verificarlo en: https://www.sri.gob.ec/facturacion-electronica/consultas",
        40,
        doc.y + 2,
        { align: "center" }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Genera un nombre de archivo para el RIDE.
 */
export function nombreArchivoRide(numeroComprobante: string, tipo: string): string {
  const tipoLower = tipo.toLowerCase().replace(/\s+/g, "-");
  return `ride-${tipoLower}-${numeroComprobante}.pdf`;
}

/**
 * Genera un nombre de archivo para el XML firmado.
 */
export function nombreArchivoXml(numeroComprobante: string, tipo: string): string {
  const tipoLower = tipo.toLowerCase().replace(/\s+/g, "-");
  return `${tipoLower}-${numeroComprobante}.xml`;
}
