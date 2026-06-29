"use server";

// Server Actions para configuración de facturación electrónica

import { auth } from "@/auth";
import { getOrCreateConfig, updateConfig, guardarP12Local, eliminarP12Local, getWorkerStatus } from "@/services/facturacion/configuracion-service";
import { obtenerHuellaCertificado } from "@/lib/sri/xml-signer";
import { cifrarP12 } from "@/lib/sri/p12-cipher";
import { revalidatePath } from "next/cache";

/**
 * Obtiene la configuración actual del emisor.
 */
export async function getConfiguracionAction() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const config = await getOrCreateConfig();
  const worker = await getWorkerStatus();

  return { config, worker };
}

/**
 * Actualiza los datos del emisor.
 */
export async function actualizarEmisorAction(data: {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccionMatriz: string;
  establecimiento: string;
  puntoEmision: string;
  obligadoContabilidad: boolean;
  agenteRetencion: boolean;
  contribuyenteRimpe: boolean;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await updateConfig(data);
  revalidatePath("/admin/facturacion/configuracion");
  revalidatePath("/admin/facturacion");

  return { success: true };
}

/**
 * Cambia el ambiente SRI (pruebas/producción).
 */
export async function cambiarAmbienteAction(ambiente: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  if (!["1", "2"].includes(ambiente)) {
    throw new Error("Ambiente inválido. Use 1 (pruebas) o 2 (producción).");
  }

  await updateConfig({ sriAmbiente: ambiente });
  revalidatePath("/admin/facturacion/configuracion");

  return { success: true };
}

/**
 * Cambia el modo de firma (NUBE/LOCAL).
 */
export async function cambiarModoFirmaAction(modo: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  if (!["NUBE", "LOCAL"].includes(modo)) {
    throw new Error("Modo inválido. Use NUBE o LOCAL.");
  }

  await updateConfig({ modoFirma: modo });
  revalidatePath("/admin/facturacion/configuracion");

  return { success: true };
}

/**
 * Sube y cifra el archivo .p12 local.
 * El archivo viene como base64 desde el navegador (ya cifrado con Web Crypto o sin cifrar).
 */
export async function subirP12Action(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const file = formData.get("p12") as File;
  const password = formData.get("password") as string;

  if (!file) throw new Error("No se proporcionó archivo .p12");
  if (!password) throw new Error("No se proporcionó la contraseña del certificado");

  // Leer el archivo como buffer
  const arrayBuffer = await file.arrayBuffer();
  const p12Buffer = Buffer.from(arrayBuffer);

  // Validar que el .p12 se puede leer con el password
  let huellaInfo;
  try {
    huellaInfo = obtenerHuellaCertificado(p12Buffer, password);
  } catch {
    throw new Error("No se pudo abrir el archivo .p12. Verifique la contraseña.");
  }

  // Cifrar el .p12 con la clave maestra
  const masterKey = process.env.SRI_MASTER_KEY;
  if (!masterKey) throw new Error("SRI_MASTER_KEY no configurada en el servidor");

  const { cifrado, iv, authTag } = cifrarP12(p12Buffer, masterKey);

  // Guardar en BD
  const config = await getOrCreateConfig();
  await guardarP12Local(
    config.id,
    cifrado,
    iv,
    authTag,
    file.name,
    huellaInfo.huella,
    huellaInfo.titular,
    huellaInfo.vence
  );

  revalidatePath("/admin/facturacion/configuracion");

  return {
    success: true,
    huella: huellaInfo.huella,
    titular: huellaInfo.titular,
    vence: huellaInfo.vence.toISOString(),
  };
}

/**
 * Elimina el .p12 local almacenado.
 */
export async function eliminarP12Action() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const config = await getOrCreateConfig();
  await eliminarP12Local(config.id);

  revalidatePath("/admin/facturacion/configuracion");

  return { success: true };
}

/**
 * Actualiza la configuración de email.
 */
export async function actualizarEmailAction(data: {
  emailFrom?: string;
  emailReplyTo?: string;
  emailBccAdmin?: boolean;
  emailAsuntoTemplate?: string;
  emailCuerpoTemplate?: string;
  emailLogoUrl?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await updateConfig(data);
  revalidatePath("/admin/facturacion/configuracion");

  return { success: true };
}
