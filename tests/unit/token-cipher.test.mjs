import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';

const KEY = randomBytes(32).toString('base64');
process.env.TOKEN_ENCRYPTION_KEY = KEY;

const { encryptToken, decryptToken, isEncrypted, getEncryptionKey } = await import(
  '../../src/lib/crypto/token-cipher.ts'
);

test('a token survives a round trip', () => {
  const token = 'EAAG1234567890abcdefTOKEN';
  const encrypted = encryptToken(token);
  assert.notEqual(encrypted, token);
  assert.equal(decryptToken(encrypted), token);
});

test('the ciphertext never contains the plaintext', () => {
  const token = 'super-secret-value';
  assert.equal(encryptToken(token).includes(token), false);
});

test('encrypting the same token twice yields different output (fresh IV)', () => {
  const token = 'same-token';
  assert.notEqual(encryptToken(token), encryptToken(token));
});

test('a legacy plaintext value passes through untouched', () => {
  // Así el cifrado puede desplegarse antes del backfill sin romper nada.
  const legacy = 'EAAplaintextLegacyToken';
  assert.equal(isEncrypted(legacy), false);
  assert.equal(decryptToken(legacy), legacy);
});

test('encrypted values are recognised by their version prefix', () => {
  const encrypted = encryptToken('x');
  assert.equal(isEncrypted(encrypted), true);
  assert.equal(encrypted.startsWith('v1:'), true);
});

test('a tampered auth tag is rejected', () => {
  const encrypted = encryptToken('important');
  const [version, iv, , data] = encrypted.split(':');
  const forgedTag = randomBytes(16).toString('base64');
  assert.throws(
    () => decryptToken([version, iv, forgedTag, data].join(':')),
    /No se pudo descifrar/
  );
});

test('tampered ciphertext is rejected', () => {
  const encrypted = encryptToken('important');
  const [version, iv, tag] = encrypted.split(':');
  const forgedData = randomBytes(24).toString('base64');
  assert.throws(() => decryptToken([version, iv, tag, forgedData].join(':')), /No se pudo descifrar/);
});

test('a malformed encrypted value is rejected', () => {
  assert.throws(() => decryptToken('v1:only:three'), /formato inválido/);
});

test('a missing key throws on encrypt rather than storing plaintext', () => {
  const saved = process.env.TOKEN_ENCRYPTION_KEY;
  try {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    assert.throws(() => encryptToken('x'), /TOKEN_ENCRYPTION_KEY no está configurada/);
    assert.throws(() => getEncryptionKey(), /TOKEN_ENCRYPTION_KEY no está configurada/);
  } finally {
    process.env.TOKEN_ENCRYPTION_KEY = saved;
  }
});

test('a wrong-sized key is rejected instead of silently truncated', () => {
  const saved = process.env.TOKEN_ENCRYPTION_KEY;
  try {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(16).toString('base64');
    assert.throws(() => encryptToken('x'), /32 bytes/);
  } finally {
    process.env.TOKEN_ENCRYPTION_KEY = saved;
  }
});

test('an empty token is refused', () => {
  assert.throws(() => encryptToken(''), /token vacío/);
});

test('a value encrypted with another key cannot be read', () => {
  const encrypted = encryptToken('secret');
  const saved = process.env.TOKEN_ENCRYPTION_KEY;
  try {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    assert.throws(() => decryptToken(encrypted), /reconecta la cuenta/);
  } finally {
    process.env.TOKEN_ENCRYPTION_KEY = saved;
  }
});
