// Construcción de XML de Comprobante de Retención Electrónica según esquema SRI v1.1.0

import { create } from "xmlbuilder2";
import type { RetencionXmlData } from "../types";

/**
 * Genera el XML de un comprobante de retención electrónica según el esquema XSD del SRI v1.1.0.
 */
export function buildRetencionXml(data: RetencionXmlData): string {
  const { infoTributaria, infoRetencion, impuestos } = data;

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("comprobanteRetencion", { id: "comprobante", version: "1.1.0" })
      // ── infoTributaria ──
      .ele("infoTributaria")
        .ele("ambiente").txt(infoTributaria.ambiente).up()
        .ele("tipoEmision").txt(infoTributaria.tipoEmision).up()
        .ele("razonSocial").txt(infoTributaria.razonSocial).up()
        .ele("nombreComercial").txt(infoTributaria.nombreComercial ?? infoTributaria.razonSocial).up()
        .ele("ruc").txt(infoTributaria.ruc).up()
        .ele("claveAcceso").txt(infoTributaria.claveAcceso).up()
        .ele("codDoc").txt(infoTributaria.codDoc).up()
        .ele("estab").txt(infoTributaria.estab).up()
        .ele("ptoEmi").txt(infoTributaria.ptoEmi).up()
        .ele("secuencial").txt(infoTributaria.secuencial).up()
        .ele("dirMatriz").txt(infoTributaria.dirMatriz).up()
      .up()

      // ── infoCompRetencion ──
      .ele("infoCompRetencion")
        .ele("fechaEmision").txt(infoRetencion.fechaEmision).up()
        .ele("tipoIdentificacionSujetoRetenido").txt(infoRetencion.tipoIdentificacionSujetoRetenido).up()
        .ele("razonSocialSujetoRetenido").txt(infoRetencion.razonSocialSujetoRetenido).up()
        .ele("identificacionSujetoRetenido").txt(infoRetencion.identificacionSujetoRetenido).up()
        .ele("periodoFiscal").txt(infoRetencion.periodoFiscal).up()
      .up()

      // ── impuestos ──
      .ele("impuestos");

    for (const imp of impuestos) {
      doc.ele("impuesto")
        .ele("codigo").txt(imp.codigo).up()
        .ele("codigoRetencion").txt(imp.codigoRetencion).up()
        .ele("baseImponible").txt(formatDecimal(imp.baseImponible)).up()
        .ele("porcentajeRetener").txt(formatDecimal(imp.porcentajeRetener)).up()
        .ele("valorRetenido").txt(formatDecimal(imp.valorRetenido)).up()
      .up();
    }

  return doc.end({ prettyPrint: true });
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}
