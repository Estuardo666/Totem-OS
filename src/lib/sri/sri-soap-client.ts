// Cliente SOAP para comunicación con el SRI Ecuador
// Endpoints de Recepción y Autorización de Comprobantes Electrónicos

import soap from "soap";
import { SRI_URLS } from "./types";

export interface RespuestaRecepcion {
  estado: string; // "RECIBIDA", "DEVUELTA"
  comprobantes?: {
    comprobante: {
      claveAcceso: string;
      mensajes?: {
        mensaje: Array<{
          identificador: string;
          mensaje: string;
          tipo: string;
          informacionAdicional?: string;
        }>;
      };
    };
  };
}

export interface RespuestaAutorizacion {
  numeroComprobantes: string;
  autorizaciones: {
    autorizacion: Array<{
      estado: string; // "AUTORIZADO", "NO AUTORIZADO"
      numeroAutorizacion: string;
      fechaAutorizacion: string;
      ambiente: string;
      comprobante: string; // XML del comprobante autorizado
      mensajes?: {
        mensaje: Array<{
          identificador: string;
          mensaje: string;
          tipo: string;
          informacionAdicional?: string;
        }>;
      };
    }>;
  };
}

/**
 * Obtiene las URLs del SRI según el ambiente configurado.
 */
function getSriUrls(ambiente: string) {
  const urls = SRI_URLS[ambiente as keyof typeof SRI_URLS];
  if (!urls) {
    throw new Error(`Ambiente SRI inválido: ${ambiente}. Use "1" (pruebas) o "2" (producción)`);
  }
  return urls;
}

/**
 * Envía un comprobante electrónico firmado al SRI para recepción.
 *
 * @param xmlFirmado XML firmado con XAdES-BES
 * @param ambiente "1"=Pruebas, "2"=Producción
 * @param timeoutMs Timeout en milisegundos (default 30s)
 */
export async function enviarRecepcion(
  xmlFirmado: string,
  ambiente: string,
  timeoutMs: number = 30000
): Promise<RespuestaRecepcion> {
  const urls = getSriUrls(ambiente);

  try {
    const client = await soap.createClientAsync(urls.recepcion, {
      wsdl_options: {},
    });

    // El SRI espera el XML como string dentro de <xml>
    const args = {
      xml: xmlFirmado,
    };

    const [result] = await client.validarComprobanteAsync(args);

    if (!result) {
      throw new Error("Respuesta vacía del SRI en recepción");
    }

    const respuesta: RespuestaRecepcion = {
      estado: result.RespuestaRecepcionComprobante?.estado ?? "DESCONOCIDO",
      comprobantes: result.RespuestaRecepcionComprobante?.comprobantes,
    };

    return respuesta;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error en recepción SRI: ${mensaje}`);
  }
}

/**
 * Consulta la autorización de un comprobante por su clave de acceso.
 *
 * @param claveAcceso Clave de acceso de 49 dígitos
 * @param ambiente "1"=Pruebas, "2"=Producción
 * @param timeoutMs Timeout en milisegundos (default 30s)
 */
export async function consultarAutorizacion(
  claveAcceso: string,
  ambiente: string,
  timeoutMs: number = 30000
): Promise<RespuestaAutorizacion> {
  const urls = getSriUrls(ambiente);

  try {
    const client = await soap.createClientAsync(urls.autorizacion, {
      wsdl_options: {},
    });

    const args = {
      claveAccesoComprobante: claveAcceso,
    };

    const [result] = await client.autorizacionComprobanteAsync(args);

    if (!result) {
      throw new Error("Respuesta vacía del SRI en autorización");
    }

    const respuesta: RespuestaAutorizacion = {
      numeroComprobantes:
        result.RespuestaAutorizacionComprobante?.numeroComprobantes ?? "0",
      autorizaciones:
        result.RespuestaAutorizacionComprobante?.autorizaciones ?? { autorizacion: [] },
    };

    return respuesta;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error en consulta autorización SRI: ${mensaje}`);
  }
}

/**
 * Verifica si el SRI es alcanzable (healthcheck).
 */
export async function verificarConectividadSri(ambiente: string): Promise<boolean> {
  try {
    const urls = getSriUrls(ambiente);
    const client = await soap.createClientAsync(urls.autorizacion, {
      wsdl_options: {},
    });
    return !!client;
  } catch {
    return false;
  }
}

/**
 * Extrae mensajes de error legibles de una respuesta SRI.
 */
export function extraerMensajesError(
  mensajes?: { mensaje: Array<{ identificador: string; mensaje: string; tipo: string; informacionAdicional?: string }> }
): string[] {
  if (!mensajes?.mensaje) return [];
  return mensajes.mensaje.map(
    (m) => `[${m.identificador}] ${m.mensaje}${m.informacionAdicional ? ` - ${m.informacionAdicional}` : ""}`
  );
}

/**
 * Determina si un rechazo del SRI es recuperable (reintentable).
 */
export function esRechazoRecuperable(identificador: string): boolean {
  // Errores temporales del SRI que se pueden reintentar
  const erroresTemporales = [
    "43", // Error interno del SRI
    "45", // Tiempo de espera agotado
    "70", // Error de comunicación
    "99", // Error no clasificado
  ];
  return erroresTemporales.includes(identificador);
}
