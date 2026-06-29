// Construcción de XML de Factura Electrónica según esquema SRI v1.1.0

import { create } from "xmlbuilder2";
import type { FacturaXmlData } from "../types";

/**
 * Genera el XML de una factura electrónica según el esquema XSD del SRI v1.1.0.
 * El XML generado NO incluye firma digital (se firma después).
 */
export function buildFacturaXml(data: FacturaXmlData): string {
  const { infoTributaria, infoFactura, detalles } = data;

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("factura", { id: "comprobante", version: "1.1.0" })
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

      // ── infoFactura ──
      .ele("infoFactura")
        .ele("fechaEmision").txt(infoFactura.fechaEmision).up()
        .ele("dirEstablecimiento").txt(infoFactura.dirEstablecimiento ?? infoTributaria.dirMatriz).up()
        .ele("obligadoContabilidad").txt(infoFactura.obligadoContabilidad).up()
        .ele("tipoIdentificacionComprador").txt(infoFactura.tipoIdentificacionComprador).up()
        .ele("razonSocialComprador").txt(infoFactura.razonSocialComprador).up()
        .ele("identificacionComprador").txt(infoFactura.identificacionComprador).up()
      .ele("totalSinImpuestos").txt(formatDecimal(infoFactura.totalSinImpuestos)).up()
      .ele("totalDescuento").txt(formatDecimal(infoFactura.totalDescuento)).up()
      .ele("totalConImpuestos");

    for (const imp of infoFactura.totalConImpuestos) {
      doc.ele("totalImpuesto")
        .ele("codigo").txt(imp.codigo).up()
        .ele("codigoPorcentaje").txt(imp.codigoPorcentaje).up()
        .ele("baseImponible").txt(formatDecimal(imp.baseImponible)).up()
        .ele("valor").txt(formatDecimal(imp.valor)).up()
      .up();
    }

    doc.up()
      .ele("propina").txt(formatDecimal(infoFactura.propina)).up()
      .ele("importeTotal").txt(formatDecimal(infoFactura.importeTotal)).up()
      .ele("moneda").txt(infoFactura.moneda).up()
      .ele("pagos");

    for (const pago of infoFactura.pagos) {
      const pagoNode = doc.ele("pago")
        .ele("formaPago").txt(pago.formaPago).up()
        .ele("total").txt(formatDecimal(pago.total)).up();
      if (pago.plazo) {
        pagoNode.ele("plazo").txt(pago.plazo).up();
      }
      if (pago.unidadTiempo) {
        pagoNode.ele("unidadTiempo").txt(pago.unidadTiempo).up();
      }
      pagoNode.up();
    }

    doc.up().up()

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

/**
 * Formatea un número con 2 decimales (formato SRI: 1000.00)
 */
function formatDecimal(value: number): string {
  return value.toFixed(2);
}
