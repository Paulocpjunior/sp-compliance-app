import forge from 'node-forge';
import { ParsedCertificate } from '../types';

/**
 * Service class to handle PFX/P12 certificate parsing.
 * Specifically tailored for Brazilian ICP-Brasil A1 Certificates.
 */
export class CertificateParser {
  /**
   * Parses a PKCS#12 (.pfx) file buffer.
   * @param pfxBuffer The ArrayBuffer of the uploaded file.
   * @param password The password to unlock the certificate.
   * @returns ParsedCertificate object with extracted details.
   */
  public static parse(pfxBuffer: ArrayBuffer, password: string): ParsedCertificate {
    try {
      // 1. Convert ArrayBuffer to Forge Buffer
      const p12Der = forge.util.createBuffer(pfxBuffer);
      
      // 2. Parse ASN.1 to get P12 structure
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      
      // 3. Decrypt P12 using password
      // Note: This might throw if password is wrong or format is invalid
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');

      // 4. Extract the certificate bag
      // P12 files can contain multiple bags (keys, certs). We need the certBag.
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag];

      if (!certBag || certBag.length === 0) {
        throw new Error('No certificate found in the PFX file.');
      }

      // Usually the user's certificate is the last one in the chain or the one with a private key counterpart,
      // but in simple parsing we often take the first or filter by localKeyId.
      // For this example, we take the last one which is usually the leaf certificate in many export chains,
      // or we can iterate to find the one with the CNPJ.
      // Let's iterate to find the one that looks like an entity cert.
      let targetCert = certBag[0].cert;
      
      // We prefer the cert that has a CNPJ
      for(const bag of certBag) {
          if (bag.cert) {
              const potentialCnpj = this.extractCNPJ(bag.cert);
              if (potentialCnpj) {
                  targetCert = bag.cert;
                  break;
              }
          }
      }
      
      if (!targetCert) {
           throw new Error('Could not read certificate data.');
      }

      return this.mapToParsedCertificate(targetCert);

    } catch (error: any) {
      console.error("Certificate Parsing Error:", error);
      if (error.message && error.message.includes('password')) {
        throw new Error('Invalid password or corrupted file.');
      }
      throw new Error('Failed to parse certificate. Ensure it is a valid valid .pfx/.p12 file.');
    }
  }

  private static mapToParsedCertificate(cert: forge.pki.Certificate): ParsedCertificate {
    const now = new Date();
    const notBefore = cert.validity.notBefore;
    const notAfter = cert.validity.notAfter;
    
    // Check validity
    const isValid = now >= notBefore && now <= notAfter;
    const diffTime = Math.abs(notAfter.getTime() - now.getTime());
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) * (now > notAfter ? -1 : 1);

    // Attributes
    const subjectAttrs = cert.subject.attributes;
    const issuerAttrs = cert.issuer.attributes;

    const getAttr = (attrs: any[], name: string) => {
      const attr = attrs.find(a => a.shortName === name || a.name === name);
      return attr ? attr.value : '';
    };

    const getAttrs = (attrs: any[], name: string) => {
        return attrs.filter(a => a.shortName === name || a.name === name).map(a => a.value);
    }

    const cn = getAttr(subjectAttrs, 'CN');
    
    // Attempt to extract CNPJ
    const cnpj = this.extractCNPJ(cert);

    // Check if it looks like an ICP-Brasil cert (Issuer usually contains ICP-Brasil)
    const issuerO = getAttr(issuerAttrs, 'O');
    const isICPBrasil = issuerO.includes('ICP-Brasil');

    return {
      subject: {
        CN: cn,
        O: getAttr(subjectAttrs, 'O'),
        OU: getAttrs(subjectAttrs, 'OU'),
        C: getAttr(subjectAttrs, 'C'),
        ST: getAttr(subjectAttrs, 'ST'),
        L: getAttr(subjectAttrs, 'L'),
      },
      issuer: {
        CN: getAttr(issuerAttrs, 'CN'),
        O: issuerO,
      },
      validity: {
        notBefore,
        notAfter,
        isValid,
        daysRemaining,
      },
      serialNumber: cert.serialNumber,
      fingerprint: forge.md.sha1.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()).digest().toHex(),
      cnpj,
      isICPBrasil
    };
  }

  /**
   * Extracts CNPJ from the certificate.
   * Strategies:
   * 1. Check Subject Alternative Name (SAN) for specific OID (2.16.76.1.3.3 for CNPJ in ICP-Brasil).
   * 2. Regex match on Common Name (CN) or Description.
   */
  private static extractCNPJ(cert: forge.pki.Certificate): string | null {
    // Strategy 1: OID 2.16.76.1.3.3 (ICP-Brasil CNPJ)
    // This is often stored in the Subject Alternative Name extension or direct Subject attribute (rarely).
    // Let's check extensions first.
    const ext = cert.getExtension('subjectAltName');
    if (ext && ext.altNames) {
      for (const alt of ext.altNames) {
        // Sometimes custom OIDs are embedded in otherName.
        // Node-forge parsing of otherName can be complex depending on the version.
        // We often look for the value directly if available or accessible via value.
        if (alt.type === 0 && alt.value) { // type 0 is otherName
            // This part is tricky in JS/Forge without deep ASN.1 inspection for specific OID
            // However, often in simpler implementations, we scan the text string of the full extension if possible,
            // or rely on the CN regex as the primary fallback for A1 legacy handling.
        }
      }
    }

    // Strategy 2: Subject Attribute with OID 2.16.76.1.3.3
    // Note: forge might not have a friendly name for this, so we search by type (OID).
    const cnpjAttr = cert.subject.attributes.find(a => a.type === '2.16.76.1.3.3');
    if (cnpjAttr) {
        // The value might be raw ASN.1 or string depending on how forge parsed it.
        // Usually it's a string in these certs.
        return this.cleanCNPJ(cnpjAttr.value as string);
    }

    // Strategy 3: Regex on Common Name (Most common fallback for A1)
    // Format: "COMPANY NAME:12345678000199"
    const cn = cert.subject.getField('CN');
    if (cn) {
        const value = cn.value as string;
        // Look for 14 digits explicitly, possibly surrounded by : or space
        const match = value.match(/[:\s](\d{14})/);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // Strategy 4: Search all attributes for a 14 digit string that passes mod11 check (optional, but let's stick to regex first)
    // Sometimes it's in the 'description' field or just embedded in 'O'.
    
    return null;
  }

  private static cleanCNPJ(raw: string): string {
    return raw.replace(/\D/g, '');
  }
}
