// Tipos compartidos para Facturación Electrónica Ecuador (SRI)

export const TIPOS_COMPROBANTE = {
  FACTURA: "01",
  NOTA_CREDITO: "04",
  NOTA_DEBITO: "05",
  COMPROBANTE_RETENCION: "07",
} as const;

export const AMBIENTES = {
  PRUEBAS: "1",
  PRODUCCION: "2",
} as const;

export const TIPOS_EMISION = {
  NORMAL: "1",
} as const;

export const CODIGOS_IVA = {
  IVA_0: "0",
  IVA_2: "2",
  IVA_4: "4",
  NO_OBJETO: "6",
  EXENTO: "7",
} as const;

export const PORCENTAJES_IVA: Record<string, number> = {
  "0": 0,
  "2": 2,
  "4": 4,
  "6": 0,
  "7": 0,
};

export const CODIGOS_TIPO_IDENTIFICACION = {
  RUC: "04",
  CEDULA: "05",
  CONSUMIDOR_FINAL: "07",
  PASAPORTE: "06",
  EXTERIOR: "08",
} as const;

export const FORMAS_PAGO = {
  SIN_SISTEMA_FINANCIERO: "01",
  COMPENSACION_DEUDAS: "15",
  TARJETA_DEBITO: "16",
  DINERO_ELECTRONICO: "17",
  TARJETA_PREPAGO: "18",
  TARJETA_CREDITO: "19",
  OTROS_SISTEMA_FINANCIERO: "20",
  ENDOSO_TITULOS: "21",
} as const;

export const FORMAS_PAGO_LABELS: Record<string, string> = {
  "01": "Sin utilización del sistema financiero",
  "15": "Compensación de deudas",
  "16": "Tarjeta de débito",
  "17": "Dinero electrónico",
  "18": "Tarjeta prepago",
  "19": "Tarjeta de crédito",
  "20": "Otros con utilización del sistema financiero",
  "21": "Endoso de títulos",
};

export const CODIGOS_TIPO_IMPUESTO = {
  RENTA: "1",
  IVA: "2",
  ICE: "3",
  IRBPNR: "5",
} as const;

export const CODIGOS_RETENCION_RENTA: Record<string, { codigo: string; porcentaje: number; descripcion: string }[]> = {
  "301": [
    { codigo: "301", porcentaje: 1.75, descripcion: "Honorarios profesionales" },
    { codigo: "303", porcentaje: 10, descripcion: "Servicios profesionales" },
    { codigo: "304", porcentaje: 1, descripcion: "Comisiones" },
    { codigo: "307", porcentaje: 2.75, descripcion: "Servicios de transporte privado de pasajeros" },
    { codigo: "312", porcentaje: 1, descripcion: "Transferencia de bienes muebles de naturaleza corporal" },
    { codigo: "320", porcentaje: 1, descripcion: "Otros servicios" },
  ],
};

export const CODIGOS_RETENCION_IVA: Record<string, { codigo: string; porcentaje: number; descripcion: string }[]> = {
  "IVA_SERVICIOS": [
    { codigo: "10", porcentaje: 30, descripcion: "Retención IVA 30%" },
    { codigo: "20", porcentaje: 70, descripcion: "Retención IVA 70%" },
    { codigo: "30", porcentaje: 100, descripcion: "Retención IVA 100%" },
  ],
  "IVA_BIENES": [
    { codigo: "10", porcentaje: 30, descripcion: "Retención IVA 30% (bienes)" },
    { codigo: "20", porcentaje: 70, descripcion: "Retención IVA 70% (bienes)" },
  ],
};

export const ESTADOS_FACTURA = {
  PENDIENTE_FIRMA: "PENDIENTE_FIRMA",
  FIRMADA: "FIRMADA",
  ENVIADA: "ENVIADA",
  AUTORIZADA: "AUTORIZADA",
  RECHAZADA: "RECHAZADA",
  ANULADA: "ANULADA",
  ERROR: "ERROR",
  CANCELADA_LOCAL: "CANCELADA_LOCAL",
} as const;

export type EstadoFactura = (typeof ESTADOS_FACTURA)[keyof typeof ESTADOS_FACTURA];

export const ESTADOS_SRI_JOB = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;

export const TIPOS_SRI_JOB = {
  EMITIR_FACTURA: "EMITIR_FACTURA",
  NOTA_CREDITO: "NOTA_CREDITO",
  RETENCION: "RETENCION",
  CONSULTAR_AUTORIZACION: "CONSULTAR_AUTORIZACION",
  TEST: "TEST",
} as const;

// URLs del SRI
export const SRI_URLS = {
  [AMBIENTES.PRUEBAS]: {
    recepcion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    autorizacion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
  },
  [AMBIENTES.PRODUCCION]: {
    recepcion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    autorizacion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
  },
} as const;

// Estructuras para construir XML
export interface InfoTributaria {
  ambiente: string;
  tipoEmision: string;
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  claveAcceso: string;
  codDoc: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  dirMatriz: string;
}

export interface ImpuestoDetalle {
  codigo: string; // "2"=IVA
  codigoPorcentaje: string; // "0","2","4","6","7"
  tarifa: number;
  baseImponible: number;
  valor: number;
}

export interface DetalleFactura {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  impuestos: ImpuestoDetalle[];
}

export interface PagoFactura {
  formaPago: string;
  total: number;
  plazo?: string;
  unidadTiempo?: string;
}

export interface TotalImpuesto {
  codigo: string;
  codigoPorcentaje: string;
  baseImponible: number;
  valor: number;
}

export interface InfoFactura {
  fechaEmision: string; // dd/mm/yyyy
  dirEstablecimiento?: string;
  obligadoContabilidad: string; // "SI" | "NO"
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalConImpuestos: TotalImpuesto[];
  propina: number;
  importeTotal: number;
  moneda: string;
  pagos: PagoFactura[];
}

export interface FacturaXmlData {
  infoTributaria: InfoTributaria;
  infoFactura: InfoFactura;
  detalles: DetalleFactura[];
}

export interface InfoNotaCredito {
  fechaEmision: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  codDocModificado: string; // "01" = factura
  numDocModificado: string; // secuencial de la factura original
  fechaEmisionDocSustento: string;
  totalSinImpuestos: number;
  valorModificacion: number;
  moneda: string;
  totalConImpuestos: TotalImpuesto[];
  motivo: string;
}

export interface NotaCreditoXmlData {
  infoTributaria: InfoTributaria;
  infoNotaCredito: InfoNotaCredito;
  detalles: DetalleFactura[];
}

export interface RetencionItem {
  codigo: string; // "1"=RENTA, "2"=IVA
  codigoRetencion: string; // ej: "301", "10"
  baseImponible: number;
  porcentajeRetener: number;
  valorRetenido: number;
}

export interface InfoRetencion {
  fechaEmision: string;
  tipoIdentificacionSujetoRetenido: string;
  razonSocialSujetoRetenido: string;
  identificacionSujetoRetenido: string;
  periodoFiscal: string; // mm/yyyy
  obligadoContabilidad: string;
}

export interface RetencionXmlData {
  infoTributaria: InfoTributaria;
  infoRetencion: InfoRetencion;
  impuestos: RetencionItem[];
}
