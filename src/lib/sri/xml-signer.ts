// Firma digital XAdES-BES para comprobantes electrónicos SRI Ecuador
// Usa node-forge para leer el .p12 y construir la firma según el estándar XMLDSig + XAdES

import forge from "node-forge";
import { create } from "xmlbuilder2";

interface P12Data {
  privateKey: forge.pki.PrivateKey;
  certificate: forge.pki.Certificate;
  certificatePem: string;
  issuerName: string;
  serialNumber: string;
}

/**
 * Lee un archivo .p12 (PKCS#12) y extrae la llave privada y el certificado.
 */
export function leerP12(p12Buffer: Buffer, password: string): P12Data {
  try {
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Extraer certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = certBags[forge.pki.oids.certBag];
    if (!certs || certs.length === 0) {
      throw new Error("No se encontró certificado en el archivo .p12");
    }
    const certificate = certs[0].cert!;

    // Extraer llave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    let privateKey: forge.pki.PrivateKey | undefined;

    const shroudedKeys = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (shroudedKeys && shroudedKeys.length > 0) {
      privateKey = shroudedKeys[0].key;
    }

    if (!privateKey) {
      // Intentar con keyBag normal
      const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
      const keys = plainKeyBags[forge.pki.oids.keyBag];
      if (keys && keys.length > 0) {
        privateKey = keys[0].key;
      }
    }

    if (!privateKey) {
      throw new Error("No se encontró llave privada en el archivo .p12");
    }

    const certificatePem = forge.pki.certificateToPem(certificate);
    const issuerAttrs = certificate.issuer.attributes;
    const issuerName = issuerAttrs
      .map((a) => `${a.shortName || a.name}=${a.value}`)
      .join(", ");
    const serialNumber = certificate.serialNumber;

    return {
      privateKey,
      certificate,
      certificatePem,
      issuerName,
      serialNumber,
    };
  } catch (error) {
    throw new Error(
      `Error al leer archivo .p12: ${error instanceof Error ? error.message : "Error desconocido"}`
    );
  }
}

/**
 * Calcula el SHA-1 de un string y retorna en base64.
 */
function sha1Base64(content: string): string {
  const md = forge.md.sha1.create();
  md.update(content, "utf8");
  return forge.util.encode64(md.digest().bytes());
}

/**
 * Calcula el SHA-256 de un string y retorna en base64.
 */
function sha256Base64(content: string): string {
  const md = forge.md.sha256.create();
  md.update(content, "utf8");
  return forge.util.encode64(md.digest().bytes());
}

/**
 * Canonicaliza un XML usando Exclusive C14N (exc-c14n).
 * Implementación simplificada que remueve declaraciones XML y normaliza espacios.
 */
function canonicalizeExcC14N(xml: string): string {
  // Remover declaración XML si existe
  let result = xml.replace(/<\?xml[^?]*\?>\s*/g, "");
  // Remover saltos de línea entre tags y normalizar espacios
  result = result.replace(/>\s+</g, "><");
  return result;
}

/**
 * Genera el digest SHA-1 del XML canonicalizado para el SignedInfo.
 */
function calcularDigestXml(xml: string): string {
  const canonical = canonicalizeExcC14N(xml);
  return sha1Base64(canonical);
}

/**
 * Firma un XML de comprobante electrónico con XAdES-BES.
 *
 * La firma sigue el estándar del SRI Ecuador:
 * - XMLDSig con enveloped signature
 * - Canonicalization: Exclusive C14N
 * - SignatureMethod: RSA-SHA1
 * - DigestMethod: SHA-1
 * - XAdES-BES con SignedProperties
 *
 * @param xmlContent XML del comprobante SIN firma
 * @param p12Buffer Buffer del archivo .p12
 * @param password Password del .p12
 * @returns XML firmado con la estructura Signature insertada
 */
export function firmarXml(
  xmlContent: string,
  p12Buffer: Buffer,
  password: string
): string {
  const p12Data = leerP12(p12Buffer, password);
  const { privateKey, certificate, certificatePem, issuerName, serialNumber } = p12Data;

  // 1. Calcular digest del documento XML
  const documentDigest = calcularDigestXml(xmlContent);

  // 2. Extraer información del certificado para XAdES
  const certBase64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).bytes()
  );

  // Subject del certificado
  const subjectAttrs = certificate.subject.attributes;
  const x509SubjectName = subjectAttrs
    .map((a) => `${a.shortName || a.name}=${a.value}`)
    .join(", ");

  // Fecha de emisión y expiración del certificado
  const certNotBefore = certificate.validity.notBefore.toISOString();
  const certNotAfter = certificate.validity.notAfter.toISOString();

  // 3. Construir SignedProperties (XAdES-BES)
  const signedPropertiesId = "Signature1-SignedProperties";
  const signedPropertiesXml = buildSignedProperties(
    signedPropertiesId,
    x509SubjectName,
    certNotBefore,
    certNotAfter,
    issuerName,
    serialNumber
  );

  // 4. Calcular digest de SignedProperties
  const signedPropertiesDigest = calcularDigestXml(signedPropertiesXml);

  // 5. Construir SignedInfo
  const signedInfoXml = buildSignedInfo(
    documentDigest,
    signedPropertiesId,
    signedPropertiesDigest
  );

  // 6. Canonicalizar SignedInfo y firmar con RSA-SHA1
  const signedInfoCanonical = canonicalizeExcC14N(signedInfoXml);
  const md = forge.md.sha1.create();
  md.update(signedInfoCanonical, "utf8");
  const signatureBytes = (privateKey as forge.pki.rsa.PrivateKey).sign(md);
  const signatureValue = forge.util.encode64(signatureBytes);

  // 7. Construir la firma completa
  const signatureXml = buildSignature(
    signedInfoXml,
    signatureValue,
    certBase64,
    signedPropertiesXml
  );

  // 8. Insertar firma en el XML del comprobante
  return insertarFirmaEnXml(xmlContent, signatureXml);
}

/**
 * Construye el nodo SignedProperties de XAdES-BES.
 */
function buildSignedProperties(
  signedPropertiesId: string,
  x509SubjectName: string,
  certNotBefore: string,
  certNotAfter: string,
  issuerName: string,
  serialNumber: string
): string {
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("ds:Object", { "xmlns:ds": "http://www.w3.org/2000/09/xmldsig#" })
      .ele("xades:QualifyingProperties", {
        "xmlns:xades": "http://uri.etsi.org/01903/v1.3.2#",
        Target: "#Signature1",
      })
        .ele("xades:SignedProperties", { Id: signedPropertiesId })
          .ele("xades:SignedSignatureProperties")
            .ele("xades:SigningTime").txt(new Date().toISOString()).up()
            .ele("xades:SigningCertificate")
              .ele("xades:Cert")
                .ele("xades:CertDigest")
                  .ele("ds:DigestMethod", { Algorithm: "http://www.w3.org/2000/09/xmldsig#sha1" }).up()
                  .ele("ds:DigestValue").txt(calcularDigestCert(issuerName + serialNumber)).up()
                .up()
                .ele("xades:IssuerSerial")
                  .ele("ds:X509IssuerName").txt(issuerName).up()
                  .ele("ds:X509SerialNumber").txt(serialNumber).up()
                .up()
              .up()
            .up()
          .up()
          .ele("xades:SignedDataObjectProperties")
            .ele("xades:DataObjectFormat", { ObjectReference: "#Reference-ID-1234567890" })
              .ele("xades:Description").txt("Comprobante Electrónico").up()
              .ele("xades:ObjectIdentifier")
                .ele("xades:Identifier", { Qualifier: "OIDAsURN" }).txt("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2").up()
              .up()
              .ele("xades:MimeType").txt("text/xml").up()
            .up()
          .up()
        .up()
      .up()
    .up();

  return canonicalizeExcC14N(doc.end({ prettyPrint: false }));
}

/**
 * Construye el nodo SignedInfo.
 */
function buildSignedInfo(
  documentDigest: string,
  signedPropertiesId: string,
  signedPropertiesDigest: string
): string {
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("ds:SignedInfo", { "xmlns:ds": "http://www.w3.org/2000/09/xmldsig#" })
      .ele("ds:CanonicalizationMethod", { Algorithm: "http://www.w3.org/2001/10/xml-exc-c14n#" }).up()
      .ele("ds:SignatureMethod", { Algorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }).up()
      // Reference al documento
      .ele("ds:Reference", { Id: "Reference-ID-1234567890", URI: "" })
        .ele("ds:Transforms")
          .ele("ds:Transform", { Algorithm: "http://www.w3.org/2000/09/xmldsig#enveloped-signature" }).up()
          .ele("ds:Transform", { Algorithm: "http://www.w3.org/2001/10/xml-exc-c14n#" }).up()
        .up()
        .ele("ds:DigestMethod", { Algorithm: "http://www.w3.org/2000/09/xmldsig#sha1" }).up()
        .ele("ds:DigestValue").txt(documentDigest).up()
      .up()
      // Reference a SignedProperties
      .ele("ds:Reference", { URI: `#${signedPropertiesId}` })
        .ele("ds:DigestMethod", { Algorithm: "http://www.w3.org/2000/09/xmldsig#sha1" }).up()
        .ele("ds:DigestValue").txt(signedPropertiesDigest).up()
      .up()
    .up();

  return canonicalizeExcC14N(doc.end({ prettyPrint: false }));
}

/**
 * Construye el nodo Signature completo con todos sus componentes.
 */
function buildSignature(
  signedInfoXml: string,
  signatureValue: string,
  certBase64: string,
  signedPropertiesXml: string
): string {
  // Insertar SignedInfo como child directo
  const signedInfoNode = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfoXml.replace(/<ds:SignedInfo[^>]*>/, "").replace(/<\/ds:SignedInfo>/, "") +
    `</ds:SignedInfo>`;

  return `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Signature1">
${signedInfoXml}
<ds:SignatureValue>${signatureValue}</ds:SignatureValue>
<ds:KeyInfo>
<ds:X509Data>
<ds:X509Certificate>${certBase64}</ds:X509Certificate>
</ds:X509Data>
</ds:KeyInfo>
${signedPropertiesXml}
</ds:Signature>`;
}

/**
 * Inserta el nodo Signature dentro del XML del comprobante.
 * La firma se coloca como último hijo del nodo raíz.
 */
function insertarFirmaEnXml(xmlContent: string, signatureXml: string): string {
  // Buscar el cierre del tag raíz (</factura>, </notaCredito>, </comprobanteRetencion>)
  const rootClosePatterns = [
    "</factura>",
    "</notaCredito>",
    "</comprobanteRetencion>",
  ];

  for (const pattern of rootClosePatterns) {
    const idx = xmlContent.lastIndexOf(pattern);
    if (idx !== -1) {
      return (
        xmlContent.substring(0, idx) +
        "\n" +
        signatureXml +
        "\n" +
        pattern
      );
    }
  }

  throw new Error("No se pudo insertar la firma: tag raíz no encontrado");
}

/**
 * Calcula un digest simplificado del certificado para XAdES.
 */
function calcularDigestCert(input: string): string {
  const md = forge.md.sha1.create();
  md.update(input, "utf8");
  return forge.util.encode64(md.digest().bytes());
}

/**
 * Extrae la huella SHA-256 del certificado (para mostrar en UI).
 */
export function obtenerHuellaCertificado(p12Buffer: Buffer, password: string): {
  huella: string;
  titular: string;
  vence: Date;
  emisor: string;
} {
  const p12Data = leerP12(p12Buffer, password);
  const { certificate } = p12Data;

  // SHA-256 fingerprint
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).bytes();
  const md = forge.md.sha256.create();
  md.update(certDer);
  const huella = md.digest().toHex().toUpperCase().match(/.{2}/g)?.join(":") ?? "";

  const titular = certificate.subject.attributes
    .map((a) => a.value)
    .filter(Boolean)
    .join(" ");

  const emisor = certificate.issuer.attributes
    .map((a) => a.value)
    .filter(Boolean)
    .join(" ");

  return {
    huella,
    titular,
    vence: certificate.validity.notAfter,
    emisor,
  };
}
