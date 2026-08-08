/**
 * CONTRATO DE DATOS COMPARTIDO ENTRE FRONT Y BACK.
 *
 * Esta es la única fuente de verdad. El front programa contra `MedLicenseApi`
 * usando `MockMedLicenseApi`; el back reemplaza la implementación por la real
 * (Midnight + proof server) sin que el front cambie una línea.
 *
 * REGLA: si algo de acá cambia, se avisa al otro ANTES de tocarlo.
 */

/** Tipo de licencia. Lo ve la empresa — NO revela diagnóstico. */
export type LicenseType = 'MEDICA' | 'MATERNIDAD' | 'ACCIDENTE_LABORAL' | 'FAMILIAR';

/** Por qué una verificación falló. */
export type FailureReason =
  | 'INVALID_PROOF' // la prueba criptográfica no valida
  | 'ALREADY_USED' // el nullifier ya fue gastado (anti-reuso)
  | 'UNKNOWN_ISSUER' // el Merkle root no pertenece a un emisor registrado
  | 'EXPIRED'; // el período de la licencia ya pasó

// ---------------------------------------------------------------------------
// 1. CLÍNICA / MÉDICO — emitir credencial
// ---------------------------------------------------------------------------

export interface IssueRequest {
  /** ID público del emisor (matrícula / clínica). */
  issuerId: string;
  licenseType: LicenseType;
  /** ISO date, ej. '2026-03-01' */
  periodStart: string;
  /** ISO date, ej. '2026-03-07' */
  periodEnd: string;
  /**
   * El diagnóstico NUNCA sale del dispositivo del médico ni entra al circuito.
   * Está acá solo para que la demo muestre que se ingresa y luego se descarta.
   */
  diagnosisNote?: string;
}

export interface Credential {
  /** Secreto del trabajador. Se guarda SOLO en su dispositivo. */
  secret: string;
  /** hash(secret, licenseType, period). Es lo único que va al Merkle tree. */
  commitment: string;
  issuerId: string;
  licenseType: LicenseType;
  periodStart: string;
  periodEnd: string;
  /** Momento de emisión, para mostrar en la UI. */
  issuedAt: string;
}

// ---------------------------------------------------------------------------
// 2. TRABAJADOR — generar prueba
// ---------------------------------------------------------------------------

/** Datos que la empresa ve en claro. Todo lo demás queda oculto. */
export interface PublicInputs {
  issuerRoot: string;
  licenseType: LicenseType;
  periodStart: string;
  periodEnd: string;
}

export interface LicenseProof {
  /** Prueba ZK serializada. */
  proofBytes: string;
  /** Deriva del secreto — impide presentar la misma credencial dos veces. */
  nullifier: string;
  publicInputs: PublicInputs;
}

// ---------------------------------------------------------------------------
// 3. EMPRESA — verificar
// ---------------------------------------------------------------------------

export interface VerificationResult {
  valid: boolean;
  reason?: FailureReason;
  /** Presentes solo si valid === true. */
  licenseType?: LicenseType;
  periodStart?: string;
  periodEnd?: string;
  /** Hash de la tx on-chain (la empresa paga el gas). */
  txHash?: string;
  verifiedAt?: string;
}

// ---------------------------------------------------------------------------
// Interfaz que implementan el mock y la versión real
// ---------------------------------------------------------------------------

export interface MedLicenseApi {
  /** Rol clínica. Agrega el commitment al Merkle tree y publica el root. */
  issueCredential(req: IssueRequest): Promise<Credential>;

  /** Rol trabajador. Genera la prueba localmente (proof server en :6300). */
  generateProof(credential: Credential): Promise<LicenseProof>;

  /** Rol empresa. Manda la prueba on-chain y paga el gas. */
  verifyProof(proof: LicenseProof): Promise<VerificationResult>;

  /** Solo para la demo: estado del Merkle root y nullifiers gastados. */
  getLedgerState(): Promise<{ issuerRoot: string; spentNullifiers: string[] }>;
}
