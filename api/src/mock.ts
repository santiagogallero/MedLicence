/**
 * Implementación MOCK de MedLicenseApi.
 *
 * Corre 100% en memoria, sin Midnight, sin proof server, sin wallet.
 * Sirve para que el front trabaje desde el minuto cero.
 *
 * Reproduce fielmente el comportamiento observable del sistema real:
 *  - el commitment es un hash, no se puede invertir para sacar el secreto
 *  - el nullifier se gasta: presentar dos veces la misma credencial falla
 *  - la verificación devuelve tipo y período, NUNCA el diagnóstico
 *
 * NO reproduce: seguridad criptográfica real. Es una demo.
 */

import type {
  Credential,
  IssueRequest,
  LicenseProof,
  MedLicenseApi,
  VerificationResult,
} from './types.js';

const enc = new TextEncoder();

/** SHA-256 → hex. Disponible en browser y en Node 22. */
async function sha256(...parts: string[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(parts.join('|')));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Latencia simulada, para que la UI tenga que mostrar loading states de verdad. */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface MockOptions {
  /** ms que tarda generateProof. Real ronda 3-15s; default acá 1200. */
  proofDelayMs?: number;
  /** ms que tarda verifyProof (tx on-chain). Default 800. */
  verifyDelayMs?: number;
}

export class MockMedLicenseApi implements MedLicenseApi {
  /** Hojas del Merkle tree del emisor. */
  private leaves: string[] = [];
  /** Nullifiers ya gastados. */
  private spent = new Set<string>();
  /** Metadata de credenciales emitidas, para que verify pueda responder. */
  private issued = new Map<string, Credential>();

  constructor(private opts: MockOptions = {}) {}

  // -- 1. Clínica ----------------------------------------------------------

  async issueCredential(req: IssueRequest): Promise<Credential> {
    await delay(300);

    const secret = randomHex();
    const commitment = await sha256(
      secret,
      req.licenseType,
      req.periodStart,
      req.periodEnd,
      req.issuerId,
    );

    this.leaves.push(commitment);

    const credential: Credential = {
      secret,
      commitment,
      issuerId: req.issuerId,
      licenseType: req.licenseType,
      periodStart: req.periodStart,
      periodEnd: req.periodEnd,
      issuedAt: new Date().toISOString(),
    };

    // El diagnóstico se descarta acá. No se guarda, no se transmite.
    this.issued.set(commitment, credential);

    return credential;
  }

  // -- 2. Trabajador -------------------------------------------------------

  async generateProof(credential: Credential): Promise<LicenseProof> {
    await delay(this.opts.proofDelayMs ?? 1200);

    const nullifier = await sha256('NULLIFIER', credential.secret, credential.commitment);
    const issuerRoot = await this.computeRoot();

    return {
      proofBytes: `mock:${await sha256(credential.commitment, issuerRoot, nullifier)}`,
      nullifier,
      publicInputs: {
        issuerRoot,
        licenseType: credential.licenseType,
        periodStart: credential.periodStart,
        periodEnd: credential.periodEnd,
      },
    };
  }

  // -- 3. Empresa ----------------------------------------------------------

  async verifyProof(proof: LicenseProof): Promise<VerificationResult> {
    await delay(this.opts.verifyDelayMs ?? 800);

    const currentRoot = await this.computeRoot();
    if (proof.publicInputs.issuerRoot !== currentRoot) {
      return { valid: false, reason: 'UNKNOWN_ISSUER' };
    }

    if (!proof.proofBytes.startsWith('mock:')) {
      return { valid: false, reason: 'INVALID_PROOF' };
    }

    if (this.spent.has(proof.nullifier)) {
      return { valid: false, reason: 'ALREADY_USED' };
    }

    if (new Date(proof.publicInputs.periodEnd) < new Date()) {
      return { valid: false, reason: 'EXPIRED' };
    }

    this.spent.add(proof.nullifier);

    return {
      valid: true,
      licenseType: proof.publicInputs.licenseType,
      periodStart: proof.publicInputs.periodStart,
      periodEnd: proof.publicInputs.periodEnd,
      txHash: `0x${randomHex(16)}`,
      verifiedAt: new Date().toISOString(),
    };
  }

  // -- Demo ----------------------------------------------------------------

  async getLedgerState() {
    return {
      issuerRoot: await this.computeRoot(),
      spentNullifiers: [...this.spent],
    };
  }

  /** Merkle root binario simple. Suficiente para el mock. */
  private async computeRoot(): Promise<string> {
    if (this.leaves.length === 0) return '0'.repeat(64);
    let level = [...this.leaves];
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] ?? left;
        next.push(await sha256(left, right));
      }
      level = next;
    }
    return level[0];
  }
}
