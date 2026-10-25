import type {CompanyConfig, Prisma} from '@prisma/client';
import {generarRidePdf} from './ride-pdf';
type InvoiceWithItems = Prisma.ElectronicInvoiceGetPayload<{include:{items:true}}>;
export async function generarRideFactura(factura: InvoiceWithItems, config: CompanyConfig, authorization?: {numeroAutorizacion:string;fechaAutorizacion:string}) {
 if(!factura.claveAcceso)throw new Error('Factura sin clave de acceso');
 if(!/^\d{49}$/.test(factura.claveAcceso) || !['1','2'].includes(factura.claveAcceso[23]))throw new Error('Ambiente del comprobante inválido');
 const auth=authorization ?? {numeroAutorizacion:factura.numeroAutorizacion ?? '',fechaAutorizacion:factura.fechaAutorizacion?.toISOString() ?? ''};
 if(!auth.numeroAutorizacion || !auth.fechaAutorizacion)throw new Error('Factura sin autorización');
return generarRidePdf({
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
          ambiente: factura.claveAcceso[23],
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
}
function formatDate(date:Date){return date.toLocaleDateString('es-EC',{timeZone:'America/Guayaquil',day:'2-digit',month:'2-digit',year:'numeric'});}
