// Cifrado AES-256-GCM para almacenamiento seguro del .p12 en BD

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Cifra un buffer usando AES-256-GCM.
 * @param data Datos a cifrar (buffer del .p12)
 * @param masterKey Clave maestra de 32 bytes (hex o string)
 */
export function cifrarDatos(data: Buffer, masterKey: string): EncryptedData {
  const key = deriveKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

/**
 * Descifra un buffer usando AES-256-GCM.
 * @param encryptedData Datos cifrados + IV + authTag
 * @param masterKey Clave maestra de 32 bytes (hex o string)
 */
export function descifrarDatos(encryptedData: EncryptedData, masterKey: string): Buffer {
  const key = deriveKey(masterKey);
  const { encrypted, iv, authTag } = encryptedData;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Cifra el .p12 y retorna los componentes como Buffers listos para Prisma (Bytes).
 */
export function cifrarP12(
  p12Buffer: Buffer,
  masterKey: string
): { cifrado: Buffer; iv: Buffer; authTag: Buffer } {
  const { encrypted, iv, authTag } = cifrarDatos(p12Buffer, masterKey);
  return { cifrado: encrypted, iv, authTag };
}

/**
 * Descifra el .p12 desde los componentes almacenados en BD.
 */
export function descifrarP12(
  cifrado: Buffer,
  iv: Buffer,
  authTag: Buffer,
  masterKey: string
): Buffer {
  return descifrarDatos({ encrypted: cifrado, iv, authTag }, masterKey);
}

/**
 * Deriva una clave de 32 bytes desde un string usando SHA-256.
 */
function deriveKey(masterKey: string): Buffer {
  // Si ya es hex de 64 caracteres (32 bytes), usar directamente
  if (/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    return Buffer.from(masterKey, "hex");
  }
  // Si no, derivar con SHA-256
  return crypto.createHash("sha256").update(masterKey).digest();
}

/**
 * Valida que los datos cifrados sean consistentes.
 */
export function validarDatosCifrados(
  cifrado: Buffer | null,
  iv: Buffer | null,
  authTag: Buffer | null
): boolean {
  return !!(cifrado && iv && authTag && cifrado.length > 0 && iv.length === IV_LENGTH);
}
