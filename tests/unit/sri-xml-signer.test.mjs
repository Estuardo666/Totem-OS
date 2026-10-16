import assert from "node:assert/strict";
import { createHash, verify as verifySignature } from "node:crypto";
import test from "node:test";
import forge from "node-forge";
import { firmarXml, leerP12, obtenerHuellaCertificado } from "../../src/lib/sri/xml-signer.ts";

const password = "local-synthetic-p12-password";

function createSyntheticP12() {
  const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const certificate = forge.pki.createCertificate();
  const subject = [{ name: "commonName", value: "Totem SRI Synthetic Fixture" }];

  certificate.publicKey = keyPair.publicKey;
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.sign(keyPair.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, certificate, password, {
    algorithm: "3des",
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
}

test("lee un P12 sintético, rechaza contraseña incorrecta y reporta su huella", () => {
  const p12 = createSyntheticP12();
  const parsed = leerP12(p12, password);

  assert.ok(parsed.privateKey);
  assert.equal(parsed.certificate.subject.attributes[0].value, "Totem SRI Synthetic Fixture");
  assert.throws(() => leerP12(p12, "wrong-password"), /Error al leer archivo \.p12/);

  const fingerprint = obtenerHuellaCertificado(p12, password);
  assert.match(fingerprint.huella, /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/);
  assert.match(fingerprint.titular, /Totem SRI Synthetic Fixture/);
  assert.ok(fingerprint.vence instanceof Date);
});

test("firma un XML sintético y verifica SignedInfo, el digest de factura y la referencia XAdES", () => {
  const p12 = createSyntheticP12();
  const xml = '<factura id="comprobante" version="1.0.0"><infoTributaria/></factura>';
  const signedXml = firmarXml(xml, p12, password);
  const parsed = leerP12(p12, password);
  const signedInfo = signedXml.match(/<ds:SignedInfo\b[\s\S]*?<\/ds:SignedInfo>/)?.[0];
  const signatureValue = signedXml.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/)?.[1];
  const signedProperties = signedXml.match(/<xades:SignedProperties\b[\s\S]*?<\/xades:SignedProperties>/)?.[0];
  const digestValues = [...signedXml.matchAll(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/g)].map((match) => match[1]);

  assert.ok(signedInfo);
  assert.ok(signatureValue);
  assert.ok(signedProperties);
  assert.equal(signedXml.includes("<ds:X509Certificate>"), true);
  assert.equal(digestValues[0], createHash("sha1").update(xml, "utf8").digest("base64"));
  const canonicalSignedProperties = signedProperties.replace(/>\s+</g, "><");
  assert.equal(digestValues[1], createHash("sha1").update(canonicalSignedProperties, "utf8").digest("base64"));
  assert.equal(
    verifySignature("RSA-SHA1", Buffer.from(signedInfo, "utf8"), parsed.certificatePem, Buffer.from(signatureValue, "base64")),
    true
  );
});
