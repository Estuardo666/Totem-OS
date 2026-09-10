/**
 * Cifrado de tokens de acceso en reposo (AES-256-GCM).
 *
 * Usa solo el módulo `crypto` de Node, sin dependencias nuevas.
 *
 * El prefijo de versión es lo que hace seguro el despliegue: un valor legacy
 * en texto plano atraviesa `decryptToken` intacto, así que el cifrado puede
 * desplegarse antes de correr el backfill sin romper nada en el intervalo.
 *
 * Falla cerrado al escribir (sin clave, lanza) y abierto al leer, pero solo
 * para valores legacy. Nunca se registra un token ni el detalle de un fallo
 * de descifrado.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // Recomendado para GCM
const KEY_BYTES = 32; // AES-256

/**
 * Lee y valida la clave de cifrado.
 * Lanza si falta o tiene un tamaño incorrecto: un token cifrado con una clave
 * inválida sería irrecuperable, así que es mejor fallar en el momento.
 */
export function getEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no está configurada. Genera una con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY debe ser de ${KEY_BYTES} bytes en base64; se recibieron ${key.length}.`
    );
  }

  return key;
}

/** Indica si un valor almacenado ya está cifrado con este esquema. */
export function isEncrypted(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(`${VERSION}:`);
}

/**
 * Cifra un token.
 * Formato: `v1:<iv b64>:<authTag b64>:<ciphertext b64>`
 * El IV es aleatorio por llamada, así que dos cifrados del mismo token difieren.
 */
export function encryptToken(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("No se puede cifrar un token vacío.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Descifra un token.
 *
 * Un valor sin el prefijo de versión se devuelve tal cual: es un token legacy
 * guardado antes de que existiera el cifrado. Esa tolerancia desaparece sola
 * cuando el backfill reescribe todas las filas.
 */
export function decryptToken(stored: string): string {
  if (!isEncrypted(stored)) {
    return stored;
  }

  const parts = stored.split(":");
  if (parts.length !== 4) {
    throw new Error("Token cifrado con formato inválido.");
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const key = getEncryptionKey();

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // El detalle del fallo no se propaga: puede filtrar información sobre la
    // clave o el contenido.
    throw new Error(
      "No se pudo descifrar el token. La clave de cifrado cambió o el dato está corrupto; reconecta la cuenta."
    );
  }
}
