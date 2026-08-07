/**
 * Implementación real de MedLicenseApi sobre Midnight Network.
 *
 * SIMPLIFICACIÓN DELIBERADA PARA LA DEMO (avisado en el pitch, punto 5):
 * no implementamos el relayer/meta-tx completo. `proveLicense` en el
 * contrato hace la verificación de membership Y gasta el nullifier en la
 * MISMA transacción — no hay forma de "probar sin someter" sin construir
 * el flujo de meta-transacciones (worker prueba offline → empresa balancea
 * y somete). Para el hackathon, generateProof() somete la tx usando una
 * wallet compartida de backend (el "relayer" narrado en el pitch).
 *
 * Consecuencia observable: el reuso de una credencial se detecta en
 * generateProof() (tira LicenseAlreadyUsedError), no en verifyProof() como
 * en el mock. Si el front quiere reproducir el mensaje "ALREADY_USED" en el
 * mismo punto del flujo que con el mock, tiene que capturar ese error acá
 * en vez de esperarlo de verifyProof(). Avisado — no se tocó types.ts.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';

import * as MedLicenseContract from '../../contract/build/contract/index.js';
import type { Ledger, Witnesses as ContractWitnesses } from '../../contract/build/contract/index.js';
import {
  encodePeriod,
  fieldToHex,
  fromHex,
  randomBytes32,
  toBytes32,
  toHex,
} from './encoding.js';
import type {
  Credential,
  IssueRequest,
  LicenseProof,
  MedLicenseApi,
  VerificationResult,
} from './types.js';

const { Contract, ledger, pureCircuits } = MedLicenseContract;

/** Carpeta que `compact compile` generó (keys/, zkir/, contract/). */
const CONTRACT_BUILD_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'contract',
  'build',
);

type MedLicenseContractType = MedLicenseContract.Contract<PrivateState>;

/**
 * `deployContract`/`findDeployedContract` (midnight-js 4.x) ya no aceptan
 * `new Contract(witnesses)` directo: quieren el binding `CompiledContract`
 * (API basada en `effect`) con los witnesses y la ruta de assets ZK atados.
 */
function bindContract(witnesses: ContractWitnesses<PrivateState>) {
  return CompiledContract.make<MedLicenseContractType>('MedLicense', Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(CONTRACT_BUILD_PATH),
  );
}

/**
 * No guardamos nada entre llamadas: cada witness cierra sobre los datos de
 * una credencial puntual. `undefined` matiza con el overload de
 * deployContract/findDeployedContract para contratos sin estado privado real.
 */
type PrivateState = undefined;
const NO_PRIVATE_STATE: PrivateState = undefined;
const PRIVATE_STATE_ID = 'medlicense';

export class LicenseAlreadyUsedError extends Error {
  constructor() {
    super('Esta licencia ya fue presentada (nullifier gastado)');
    this.name = 'LicenseAlreadyUsedError';
  }
}

type MedLicenseCircuitId = 'issueLicense' | 'proveLicense';
export type MedLicenseProviders = MidnightProviders<MedLicenseCircuitId, string, PrivateState>;

/** issueLicense no invoca witnesses — nunca deberían ejecutarse. */
const unusedWitnesses: ContractWitnesses<PrivateState> = {
  localSecret: () => {
    throw new Error('localSecret no debería invocarse fuera de proveLicense');
  },
  merklePath: () => {
    throw new Error('merklePath no debería invocarse fuera de proveLicense');
  },
};

/** Witnesses reales para proveLicense: cierran sobre el secreto de ESTA credencial. */
function makeProveWitnesses(
  secret: Uint8Array,
  licenseTypeBytes: Uint8Array,
  periodBytes: Uint8Array,
): ContractWitnesses<PrivateState> {
  return {
    localSecret: (context: WitnessContext<Ledger, PrivateState>) => [context.privateState, secret],
    merklePath: (context: WitnessContext<Ledger, PrivateState>) => {
      const commitment = pureCircuits.computeCommitment(secret, licenseTypeBytes, periodBytes);
      const path = context.ledger.licenses.findPathForLeaf(commitment);
      if (!path) {
        throw new Error(
          'Credencial no encontrada en el Merkle tree del emisor (¿root desactualizado o commitment incorrecto?)',
        );
      }
      return [context.privateState, path];
    },
  };
}

export class MidnightMedLicenseApi implements MedLicenseApi {
  private constructor(
    private readonly providers: MedLicenseProviders,
    private readonly contractAddress: string,
  ) {}

  /** Conecta a un contrato YA deployado (dirección guardada de una corrida anterior de `cli`). */
  static async connect(
    providers: MedLicenseProviders,
    contractAddress: string,
  ): Promise<MidnightMedLicenseApi> {
    const state = await providers.publicDataProvider.queryContractState(contractAddress);
    if (state == null) {
      throw new Error(`No hay ningún contrato deployado en ${contractAddress}`);
    }
    return new MidnightMedLicenseApi(providers, contractAddress);
  }

  /** Deploya el contrato por primera vez. `issuer` identifica a la clínica (ver cli/). */
  static async deploy(
    providers: MedLicenseProviders,
    issuer: Uint8Array,
  ): Promise<MidnightMedLicenseApi> {
    const deployed = await deployContract(providers, {
      compiledContract: bindContract(unusedWitnesses),
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: NO_PRIVATE_STATE,
      args: [issuer],
    });
    return new MidnightMedLicenseApi(providers, deployed.deployTxData.public.contractAddress);
  }

  get address(): string {
    return this.contractAddress;
  }

  private connectReadOnly() {
    return findDeployedContract(this.providers, {
      contractAddress: this.contractAddress,
      compiledContract: bindContract(unusedWitnesses),
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: NO_PRIVATE_STATE,
    });
  }

  // -- 1. Clínica -----------------------------------------------------------

  async issueCredential(req: IssueRequest): Promise<Credential> {
    const secret = randomBytes32();
    const licenseTypeBytes = toBytes32(req.licenseType);
    const periodBytes = encodePeriod(req.periodStart, req.periodEnd);
    const commitment = pureCircuits.computeCommitment(secret, licenseTypeBytes, periodBytes);

    const contract = await this.connectReadOnly();
    await contract.callTx.issueLicense(commitment);

    // req.diagnosisNote se descarta acá: nunca se guarda, nunca se transmite.
    return {
      secret: toHex(secret),
      commitment: toHex(commitment),
      issuerId: req.issuerId,
      licenseType: req.licenseType,
      periodStart: req.periodStart,
      periodEnd: req.periodEnd,
      issuedAt: new Date().toISOString(),
    };
  }

  // -- 2. Trabajador (ver aviso de simplificación arriba) --------------------

  async generateProof(credential: Credential): Promise<LicenseProof> {
    const secret = fromHex(credential.secret);
    const licenseTypeBytes = toBytes32(credential.licenseType);
    const periodBytes = encodePeriod(credential.periodStart, credential.periodEnd);
    const nullifier = pureCircuits.computeNullifier(secret);

    const contract = await findDeployedContract(this.providers, {
      contractAddress: this.contractAddress,
      compiledContract: bindContract(makeProveWitnesses(secret, licenseTypeBytes, periodBytes)),
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: NO_PRIVATE_STATE,
    });

    try {
      const txData = await contract.callTx.proveLicense(licenseTypeBytes, periodBytes);
      const rootAfter = (await this.getRawLedger()).licenses.root();
      return {
        proofBytes: `chain:${txData.public.txHash}`,
        nullifier: toHex(nullifier),
        publicInputs: {
          issuerRoot: fieldToHex(rootAfter.field),
          licenseType: credential.licenseType,
          periodStart: credential.periodStart,
          periodEnd: credential.periodEnd,
        },
      };
    } catch (err) {
      if (String(err).includes('Esta licencia ya fue presentada')) {
        throw new LicenseAlreadyUsedError();
      }
      throw err;
    }
  }

  // -- 3. Empresa -------------------------------------------------------------

  async verifyProof(proof: LicenseProof): Promise<VerificationResult> {
    if (!proof.proofBytes.startsWith('chain:')) {
      return { valid: false, reason: 'INVALID_PROOF' };
    }
    const txHash = proof.proofBytes.slice('chain:'.length);

    const state = await this.getRawLedger();
    const nullifierBytes = fromHex(proof.nullifier);
    if (!state.spentNullifiers.member(nullifierBytes)) {
      // En nuestro modelo simplificado esto no debería pasar: si generateProof()
      // no tiró, el nullifier ya está gastado on-chain.
      return { valid: false, reason: 'INVALID_PROOF' };
    }

    if (new Date(proof.publicInputs.periodEnd) < new Date()) {
      return { valid: false, reason: 'EXPIRED' };
    }

    return {
      valid: true,
      licenseType: proof.publicInputs.licenseType,
      periodStart: proof.publicInputs.periodStart,
      periodEnd: proof.publicInputs.periodEnd,
      txHash,
      verifiedAt: new Date().toISOString(),
    };
  }

  // -- Demo -------------------------------------------------------------------

  async getLedgerState(): Promise<{ issuerRoot: string; spentNullifiers: string[] }> {
    const state = await this.getRawLedger();
    const nullifiers: string[] = [];
    for (const n of state.spentNullifiers) nullifiers.push(toHex(n));
    return {
      issuerRoot: fieldToHex(state.licenses.root().field),
      spentNullifiers: nullifiers,
    };
  }

  private async getRawLedger(): Promise<Ledger> {
    const state = await this.providers.publicDataProvider.queryContractState(this.contractAddress);
    if (state == null) throw new Error('El contrato ya no existe on-chain');
    return ledger(state.data);
  }
}
