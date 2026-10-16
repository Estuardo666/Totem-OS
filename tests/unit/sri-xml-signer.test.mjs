import assert from "node:assert/strict";
import { createHash, verify as verifySignature } from "node:crypto";
import test from "node:test";
import forge from "node-forge";
import { DOMParser } from "@xmldom/xmldom";
import { C14nCanonicalization, ExclusiveCanonicalization, SignedXml, findAncestorNs } from "xml-crypto";
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
  assert.throws(
    () => firmarXml('<!DOCTYPE factura [<!ENTITY x "test">]><factura>&x;</factura>', p12, password),
    /No se permite DOCTYPE/
  );

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
  const signatureValue = signedXml.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/)?.[1];
  const digestValues = [...signedXml.matchAll(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/g)].map((match) => match[1]);
  const document = new DOMParser().parseFromString(signedXml, "application/xml");
  const signature = document.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
  const signedInfo = document.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "SignedInfo")[0];
  const signedProperties = document.getElementsByTagNameNS("http://uri.etsi.org/01903/v1.3.2#", "SignedProperties")[0];
  const signedPropertiesReference = Array.from(
    document.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Reference")
  ).find((reference) => reference.getAttribute("URI") === "#Signature1-SignedProperties");

  assert.ok(signatureValue);
  assert.ok(signature);
  assert.ok(signedInfo);
  assert.ok(signedProperties);
  assert.equal(signedPropertiesReference?.getAttribute("Type"), "http://uri.etsi.org/01903#SignedProperties");
  const certDigestValue = signedProperties
    .getElementsByTagNameNS("http://uri.etsi.org/01903/v1.3.2#", "CertDigest")[0]
    ?.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "DigestValue")[0]
    ?.textContent;
  const certificateDer = Buffer.from(
    forge.asn1.toDer(forge.pki.certificateToAsn1(parsed.certificate)).getBytes(),
    "binary"
  );
  assert.equal(certDigestValue, createHash("sha1").update(certificateDer).digest("base64"));
  const exclusiveCanonicalizer = new ExclusiveCanonicalization();
  const inclusiveCanonicalizer = new C14nCanonicalization();
  const canonicalSignedInfo = exclusiveCanonicalizer.process(signedInfo, {});
  const ancestorNamespaces = findAncestorNs(document, "//*[@Id='Signature1-SignedProperties']");
  const canonicalSignedProperties = inclusiveCanonicalizer.process(signedProperties, { ancestorNamespaces });
  assert.equal(digestValues[1], createHash("sha1").update(canonicalSignedProperties, "utf8").digest("base64"));
  assert.equal(
    verifySignature("RSA-SHA1", Buffer.from(canonicalSignedInfo, "utf8"), parsed.certificatePem, Buffer.from(signatureValue, "base64")),
    true
  );
  const xmlSignatureVerifier = new SignedXml({ publicCert: parsed.certificatePem });
  xmlSignatureVerifier.loadSignature(signature);
  const xmlSignatureIsValid = xmlSignatureVerifier.checkSignature(signedXml);
  const validationErrors = xmlSignatureVerifier.validationErrors;
  assert.equal(
    xmlSignatureIsValid,
    true,
    Array.isArray(validationErrors) ? validationErrors.map((error) => error.message).join("\n") : "XMLDSig validation failed"
  );

  const parent = signature.parentNode;
  assert.ok(parent);
  parent.removeChild(signature);
  const canonicalUnsignedDocument = exclusiveCanonicalizer.process(document.documentElement, {});
  assert.equal(digestValues[0], createHash("sha1").update(canonicalUnsignedDocument, "utf8").digest("base64"));
});
