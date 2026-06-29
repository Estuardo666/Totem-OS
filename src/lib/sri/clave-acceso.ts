// Generador de clave de acceso de 49 dígitos según ficha técnica SRI Ecuador

import { calcularModulo11 } from "./modulo-11";

interface ClaveAccesoParams {
  fecha: Date;
  tipoComprobante: string; // "01"=Factura, "04"=NC, "07"=Retención
  ruc: string; // 13 dígitos
  ambiente: string; // "1"=Pruebas, "2"=Producción
  serie: string; // "001001" (establecimiento + punto emisión)
  numero: string; // 9 dígitos (secuencial)
  codigoNumerico: string; // 8 dígitos aleatorios
  tipoEmision: string; // "1"=Normal
}

/**
 * Genera la clave de acceso de 49 dígitos.
 *
 * Composición:
 * - 8 dígitos: fecha (ddmmaaaa)
 * - 2 dígitos: tipo comprobante
 * - 13 dígitos: RUC
 * - 1 dígito: ambiente
 * - 6 dígitos: serie (estab + ptoEmi)
 * - 9 dígitos: secuencial
 * - 8 dígitos: código numérico
 * - 1 dígito: tipo emisión
 * - 1 dígito: verificador (módulo 11)
 */
export function generarClaveAcceso(params: ClaveAccesoParams): string {
  const {
    fecha,
    tipoComprobante,
    ruc,
    ambiente,
    serie,
    numero,
    codigoNumerico,
    tipoEmision,
  } = params;

  // Formatear fecha: ddmmaaaa
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yyyy = String(fecha.getFullYear());
  const fechaStr = `${dd}${mm}${yyyy}`;

  // Validaciones
  if (ruc.length !== 13) throw new Error(`RUC debe tener 13 dígitos, tiene ${ruc.length}`);
  if (serie.length !== 6) throw new Error(`Serie debe tener 6 dígitos, tiene ${serie.length}`);
  if (numero.length !== 9) throw new Error(`Número debe tener 9 dígitos, tiene ${numero.length}`);
  if (codigoNumerico.length !== 8) throw new Error(`Código numérico debe tener 8 dígitos`);
  if (!/^\d+$/.test(ruc)) throw new Error("RUC debe ser numérico");

  const base =
    fechaStr +
    tipoComprobante +
    ruc +
    ambiente +
    serie +
    numero +
    codigoNumerico +
    tipoEmision;

  if (base.length !== 48) {
    throw new Error(`Base de clave de acceso debe tener 48 dígitos, tiene ${base.length}`);
  }

  const digitoVerificador = calcularModulo11(base);

  return base + String(digitoVerificador);
}

/**
 * Genera un código numérico aleatorio de 8 dígitos.
 */
export function generarCodigoNumerico(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

/**
 * Genera el secuencial formateado a 9 dígitos.
 */
export function formatearSecuencial(secuencial: number): string {
  return String(secuencial).padStart(9, "0");
}

/**
 * Genera la serie (establecimiento + punto emisión) formateada a 6 dígitos.
 */
export function formatearSerie(establecimiento: string, puntoEmision: string): string {
  return `${establecimiento}${puntoEmision}`;
}

/**
 * Parsea una clave de acceso y extrae sus componentes.
 */
export function parsearClaveAcceso(clave: string): {
  fecha: string;
  tipoComprobante: string;
  ruc: string;
  ambiente: string;
  serie: string;
  numero: string;
  codigoNumerico: string;
  tipoEmision: string;
  digitoVerificador: string;
} {
  if (clave.length !== 49) throw new Error("Clave de acceso debe tener 49 dígitos");

  return {
    fecha: clave.substring(0, 8), // ddmmyyyy
    tipoComprobante: clave.substring(8, 10),
    ruc: clave.substring(10, 23),
    ambiente: clave.substring(23, 24),
    serie: clave.substring(24, 30),
    numero: clave.substring(30, 39),
    codigoNumerico: clave.substring(39, 47),
    tipoEmision: clave.substring(47, 48),
    digitoVerificador: clave.substring(48, 49),
  };
}
