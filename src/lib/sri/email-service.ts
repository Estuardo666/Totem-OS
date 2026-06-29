// Servicio de envío de comprobantes electrónicos por email
// Usa Resend como proveedor de email

import { Resend } from "resend";
import type { ElectronicInvoice } from "@prisma/client";

interface EmailConfig {
  proveedor: string;
  from: string;
  replyTo?: string;
  bccAdmin: boolean;
  asuntoTemplate?: string;
  cuerpoTemplate?: string;
  logoUrl?: string;
}

interface EnvioComprobanteParams {
  emailDestino: string;
  factura: ElectronicInvoice & { client?: { name: string } | null };
  pdfBuffer?: Buffer;
  xmlContent?: string;
  config: EmailConfig;
  adminEmail?: string;
}

/**
 * Envía un comprobante electrónico por email usando Resend.
 */
export async function enviarComprobanteEmail(params: EnvioComprobanteParams): Promise<{
  success: boolean;
  providerId?: string;
  error?: string;
}> {
  const { emailDestino, factura, pdfBuffer, xmlContent, config, adminEmail } = params;

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Construir asunto
  const asunto = config.asuntoTemplate
    ? template(config.asuntoTemplate, factura)
    : `Factura Electrónica ${factura.secuencial} - ${factura.razonSocial}`;

  // Construir cuerpo HTML
  const cuerpoHtml = config.cuerpoTemplate
    ? template(config.cuerpoTemplate, factura)
    : buildDefaultEmailBody(factura, config.logoUrl);

  // Adjuntos
  const attachments: Array<{ filename: string; content: Buffer | string; contentType?: string }> = [];

  if (pdfBuffer) {
    attachments.push({
      filename: `RIDE-${factura.secuencial}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }

  if (xmlContent) {
    attachments.push({
      filename: `${factura.secuencial}.xml`,
      content: Buffer.from(xmlContent, "utf-8"),
      contentType: "application/xml",
    });
  }

  // Destinatarios
  const to = [emailDestino];
  const bcc = config.bccAdmin && adminEmail ? [adminEmail] : undefined;

  try {
    const result = await resend.emails.send({
      from: config.from || "Facturacion <facturas@totem.com.ec>",
      to,
      bcc,
      replyTo: config.replyTo,
      subject: asunto,
      html: cuerpoHtml,
      attachments,
    });

    return {
      success: true,
      providerId: result.data?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido al enviar email",
    };
  }
}

/**
 * Template simple de reemplazo de variables.
 */
function template(text: string, factura: ElectronicInvoice & { client?: { name: string } | null }): string {
  return text
    .replace(/\{numero\}/g, factura.secuencial)
    .replace(/\{cliente\}/g, factura.razonSocial)
    .replace(/\{total\}/g, `$${factura.importeTotal.toFixed(2)}`)
    .replace(/\{fecha\}/g, new Date(factura.fechaEmision).toLocaleDateString("es-EC"))
    .replace(/\{claveAcceso\}/g, factura.claveAcceso ?? "")
    .replace(/\{autorizacion\}/g, factura.numeroAutorizacion ?? "");
}

/**
 * Cuerpo de email por defecto (HTML).
 */
function buildDefaultEmailBody(
  factura: ElectronicInvoice & { client?: { name: string } | null },
  logoUrl?: string
): string {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height:60px;margin-bottom:16px;" />`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { text-align: center; border-bottom: 2px solid #27221F; padding-bottom: 16px; margin-bottom: 24px; }
    .info-box { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; margin: 4px 0; }
    .info-label { font-weight: 600; color: #666; }
    .info-value { color: #333; }
    .total { font-size: 24px; font-weight: 700; color: #27221F; text-align: center; margin: 24px 0; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
    .verify-link { display: inline-block; background: #27221F; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoHtml}
      <h2 style="margin:0;color:#27221F;">Factura Electrónica</h2>
    </div>

    <p>Estimado/a <strong>${factura.razonSocial}</strong>,</p>
    <p>Adjuntamos su factura electrónica con los siguientes datos:</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Número:</span>
        <span class="info-value">${factura.secuencial}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fecha:</span>
        <span class="info-value">${new Date(factura.fechaEmision).toLocaleDateString("es-EC")}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Clave de Acceso:</span>
        <span class="info-value" style="font-size:11px;word-break:break-all;">${factura.claveAcceso ?? "N/A"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">N° Autorización:</span>
        <span class="info-value" style="font-size:11px;word-break:break-all;">${factura.numeroAutorizacion ?? "N/A"}</span>
      </div>
    </div>

    <div class="total">Total: $${factura.importeTotal.toFixed(2)}</div>

    <p style="text-align:center;">
      Puede verificar la autenticidad de este comprobante en:<br>
      <a href="https://www.sri.gob.ec/facturacion-electronica/consultas" class="verify-link">
        Verificar en SRI
      </a>
    </p>

    <div class="footer">
      <p>Este correo fue enviado automáticamente. Por favor no responda a este mensaje.</p>
      <p>Documento adjunto: RIDE (PDF) + XML firmado</p>
    </div>
  </div>
</body>
</html>`;
}
