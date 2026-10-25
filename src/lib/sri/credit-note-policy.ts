export function assertCreditNoteAllowed(invoice: { estado: string; tipoIdentificacion: string; numeroIdentificacion: string }) {
  if (invoice.estado !== "AUTORIZADA") throw new Error("Solo se pueden corregir facturas autorizadas por el SRI.");
  if (invoice.tipoIdentificacion === "07" || invoice.numeroIdentificacion === "9999999999999") throw new Error("No se puede emitir una nota de crédito sobre una factura a consumidor final.");
}
