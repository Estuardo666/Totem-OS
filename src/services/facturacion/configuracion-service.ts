// Servicio de configuración del emisor (CompanyConfig)
// Singleton: solo existe un registro de configuración

import { db as prisma } from "@/lib/db";
import type { CompanyConfig } from "@prisma/client";

/**
 * Obtiene la configuración del emisor. Si no existe, crea una con valores por defecto.
 */
export async function getOrCreateConfig(): Promise<CompanyConfig> {
  let config = await prisma.companyConfig.findFirst();

  if (!config) {
    config = await prisma.companyConfig.create({
      data: {
        ruc: "9999999999999",
        razonSocial: "CONFIGURAR EMPRESA",
        nombreComercial: "",
        direccionMatriz: "CONFIGURAR DIRECCIÓN",
        establecimiento: "001",
        puntoEmision: "001",
        sriAmbiente: "1",
        modoFirma: "LOCAL",
        emailFrom: "Facturacion <facturas@totem.com.ec>",
      },
    });
  }

  return config;
}

/**
 * Actualiza la configuración del emisor.
 */
export async function updateConfig(
  data: Partial<
    Pick<
      CompanyConfig,
      | "ruc"
      | "razonSocial"
      | "nombreComercial"
      | "direccionMatriz"
      | "establecimiento"
      | "puntoEmision"
      | "obligadoContabilidad"
      | "agenteRetencion"
      | "contribuyenteRimpe"
      | "sriAmbiente"
      | "modoFirma"
      | "emailFrom"
      | "emailReplyTo"
      | "emailBccAdmin"
      | "emailAsuntoTemplate"
      | "emailCuerpoTemplate"
      | "emailLogoUrl"
      | "emailProveedor"
    >
  >
): Promise<CompanyConfig> {
  const config = await getOrCreateConfig();

  return prisma.companyConfig.update({
    where: { id: config.id },
    data,
  });
}

/**
 * Guarda el .p12 cifrado en la configuración.
 */
export async function guardarP12Local(
  configId: string,
  p12Cifrado: Buffer,
  p12Iv: Buffer,
  p12AuthTag: Buffer,
  nombreArchivo: string,
  huella: string,
  titular: string,
  vence: Date
): Promise<CompanyConfig> {
  return prisma.companyConfig.update({
    where: { id: configId },
    data: {
      p12LocalCifrado: p12Cifrado,
      p12LocalIv: p12Iv,
      p12LocalAuthTag: p12AuthTag,
      p12LocalNombre: nombreArchivo,
      p12LocalSubidoAt: new Date(),
      p12Huella: huella,
      p12Titular: titular,
      p12Vence: vence,
    },
  });
}

/**
 * Elimina el .p12 local de la configuración.
 */
export async function eliminarP12Local(configId: string): Promise<CompanyConfig> {
  return prisma.companyConfig.update({
    where: { id: configId },
    data: {
      p12LocalCifrado: null,
      p12LocalIv: null,
      p12LocalAuthTag: null,
      p12LocalNombre: null,
      p12LocalSubidoAt: null,
      p12Huella: null,
      p12Titular: null,
      p12Vence: null,
    },
  });
}

/**
 * Registra un latido del worker.
 */
export async function registrarLatido(data: {
  workerId: string;
  modo: string;
  hostname: string;
  version?: string;
  sriAmbiente: string;
  sriAlcanzable: boolean;
}): Promise<void> {
  await prisma.workerLatido.create({
    data: {
      workerId: data.workerId,
      modo: data.modo,
      hostname: data.hostname,
      version: data.version ?? "unknown",
      sriAmbiente: data.sriAmbiente,
      sriAlcanzable: data.sriAlcanzable,
    },
  });

  // Actualizar CompanyConfig con el último latido
  const config = await getOrCreateConfig();
  await prisma.companyConfig.update({
    where: { id: config.id },
    data: {
      workerModo: data.modo,
      workerUltimoLatido: new Date(),
      workerVersion: data.version,
      workerHostname: data.hostname,
    },
  });
}

/**
 * Obtiene el estado del worker (último latido).
 */
export async function getWorkerStatus(): Promise<{
  activo: boolean;
  modo: string | null;
  hostname: string | null;
  version: string | null;
  ultimoLatido: Date | null;
  sriAlcanzable: boolean;
}> {
  const config = await getOrCreateConfig();
  const ultimoLatido = config.workerUltimoLatido;
  const activo = ultimoLatido
    ? Date.now() - ultimoLatido.getTime() < 60000 // Activo si latió en los últimos 60s
    : false;

  const ultimoRegistro = await prisma.workerLatido.findFirst({
    orderBy: { timestamp: "desc" },
  });

  return {
    activo,
    modo: config.workerModo,
    hostname: config.workerHostname,
    version: config.workerVersion,
    ultimoLatido,
    sriAlcanzable: ultimoRegistro?.sriAlcanzable ?? false,
  };
}
