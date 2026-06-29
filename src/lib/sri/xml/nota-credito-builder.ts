// Construcción de XML de Nota de Crédito Electrónica según esquema SRI v1.1.0

import { create } from "xmlbuilder2";
import type { NotaCreditoXmlData } from "../types";

/**
 * Genera el XML de una nota de crédito electrónica según el esquema XSD del SRI v1.1.0.
 */
export function buildNotaCreditoXml(data: NotaCreditoXmlData): string {
  const { infoTributaria, infoNotaCredito, detalles } = data;

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("notaCredito", { id: "comprobante", version: "1.1.0" })
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

      // ── infoNotaCredito ──
      .ele("infoNotaCredito")
        .ele("fechaEmision").txt(infoNotaCredito.fechaEmision).up()
        .ele("tipoIdentificacionComprador").txt(infoNotaCredito.tipoIdentificacionComprador).up()
        .ele("razonSocialComprador").txt(infoNotaCredito.razonSocialComprador).up()
        .ele("identificacionComprador").txt(infoNotaCredito.identificacionComprador).up()
        .ele("codDocModificado").txt(infoNotaCredito.codDocModificado).up()
        .ele("numDocModificado").txt(infoNotaCredito.numDocModificado).up()
        .ele("fechaEmisionDocSustento").txt(infoNotaCredito.fechaEmisionDocSustento).up()
        .ele("totalSinImpuestos").txt(formatDecimal(infoNotaCredito.totalSinImpuestos)).up()
        .ele("valorModificacion").txt(formatDecimal(infoNotaCredito.valorModificacion)).up()
        .ele("moneda").txt(infoNotaCredito.moneda).up()
      .ele("totalConImpuestos");

    for (const imp of infoNotaCredito.totalConImpuestos) {
      doc.ele("totalImpuesto")
        .ele("codigo").txt(imp.codigo).up()
        .ele("codigoPorcentaje").txt(imp.codigoPorcentaje).up()
        .ele("baseImponible").txt(formatDecimal(imp.baseImponible)).up()
        .ele("valor").txt(formatDecimal(imp.valor)).up()
      .up();
    }

    doc.up()
      .ele("motivo").txt(infoNotaCredito.motivo).up()
    .up()

      // ── detalles ──
      .ele("detalles");

    for (const det of detalles) {
      const detNode = doc.ele("detalle")
        .ele("codigoPrincipal").txt(det.codigoPrincipal).up()
        .ele("descripcion").txt(det.descripcion).up()
        .ele("cantidad").txt(formatDecimal(det.cantidad)).up()
        .ele("precioUnitario").txt(formatDecimal(det.precioUnitario)).up()
        .ele("descuento").txt(formatDecimal(det.descuento)).up()
        .ele("precioTotalSinImpuesto").txt(formatDecimal(det.precioTotalSinImpuesto)).up()
        .ele("impuestos");

      for (const imp of det.impuestos) {
        detNode.ele("impuesto")
          .ele("codigo").txt(imp.codigo).up()
          .ele("codigoPorcentaje").txt(imp.codigoPorcentaje).up()
          .ele("tarifa").txt(formatDecimal(imp.tarifa)).up()
          .ele("baseImponible").txt(formatDecimal(imp.baseImponible)).up()
          .ele("valor").txt(formatDecimal(imp.valor)).up()
        .up();
      }

      detNode.up().up();
    }

  return doc.end({ prettyPrint: true });
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}
