import { RegimeTributario, StatusObrigacao } from './types/compliance';

export * from './types/compliance';

export interface ParsedCertificate {
  subject: {
    CN: string;
    O: string;
    OU: string[];
    C: string;
    ST: string;
    L: string;
  };
  issuer: {
    CN: string;
    O: string;
  };
  validity: {
    notBefore: Date;
    notAfter: Date;
    isValid: boolean;
    daysRemaining: number;
  };
  serialNumber: string;
  fingerprint: string;
  cnpj: string | null;
  isICPBrasil: boolean;
}

export enum CertificateStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  EXPIRING_SOON = 'EXPIRING_SOON', // Within 30 days
  INVALID = 'INVALID',
  PENDING = 'PENDING'
}

export interface ComplianceReport {
  status: CertificateStatus;
  message: string;
  details: string[];
}

// Aliases for backward compatibility
export type TaxRegime = RegimeTributario;
export type ObligationStatus = StatusObrigacao;
