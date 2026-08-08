// Tests del contrato medlicense.compact usando el runtime de Compact
// directamente (sin proof server ni indexer) — corren en memoria y en
// milisegundos. Cubren las tres propiedades de seguridad que le dan sentido
// al diseño: solo el emisor autorizado puede insertar licencias, el
// nullifier impide reusar una credencial, y el circuito realmente ata el
// commitment probado al camino de Merkle presentado (no alcanza con conocer
// *algún* camino válido del árbol).
import { describe, expect, it } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type WitnessContext,
} from '@midnight-ntwrk/compact-runtime';

import { Contract, ledger, pureCircuits } from '../build/contract/index.js';
import type { Ledger, Witnesses } from '../build/contract/index.js';

type PS = undefined;

const CONTRACT_ADDRESS = sampleContractAddress();
const COIN_PUBLIC_KEY = '0'.repeat(64);

function bytes32(seed: number): Uint8Array {
  const out = new Uint8Array(32);
  out[31] = seed;
  return out;
}

function throwingWitness(name: string) {
  return (): never => {
    throw new Error(`witness ${name} no debería invocarse en este escenario`);
  };
}

/** Witnesses para issueLicense: cierran sobre el secreto del emisor. */
function issuerWitnesses(issuerSecret: Uint8Array): Witnesses<PS> {
  return {
    localSecret: throwingWitness('localSecret'),
    merklePath: throwingWitness('merklePath'),
    issuerSecretKey: (ctx: WitnessContext<Ledger, PS>) => [ctx.privateState, issuerSecret],
  };
}

/** Witnesses para proveLicense: buscan el camino real de ESTA credencial en el tree. */
function proverWitnesses(secret: Uint8Array, licenseType: Uint8Array, period: Uint8Array): Witnesses<PS> {
  return {
    issuerSecretKey: throwingWitness('issuerSecretKey'),
    localSecret: (ctx: WitnessContext<Ledger, PS>) => [ctx.privateState, secret],
    merklePath: (ctx: WitnessContext<Ledger, PS>) => {
      const commitment = pureCircuits.computeCommitment(secret, licenseType, period);
      const path = ctx.ledger.licenses.findPathForLeaf(commitment);
      if (!path) throw new Error('commitment no encontrado en el tree (setup de test incorrecto)');
      return [ctx.privateState, path];
    },
  };
}

/** Witnesses "maliciosos": prueban con el secreto de A pero el camino de B. */
function forgedProverWitnesses(secretA: Uint8Array, commitmentB: Uint8Array): Witnesses<PS> {
  return {
    issuerSecretKey: throwingWitness('issuerSecretKey'),
    localSecret: (ctx: WitnessContext<Ledger, PS>) => [ctx.privateState, secretA],
    merklePath: (ctx: WitnessContext<Ledger, PS>) => {
      const path = ctx.ledger.licenses.findPathForLeaf(commitmentB);
      if (!path) throw new Error('commitment B no encontrado (setup de test incorrecto)');
      return [ctx.privateState, path];
    },
  };
}

function deploy(issuerSecret: Uint8Array) {
  const issuerPublicKey = pureCircuits.computeIssuerPublicKey(issuerSecret);
  const contract = new Contract<PS>(issuerWitnesses(issuerSecret));
  const ctorResult = contract.initialState(
    createConstructorContext<PS>(undefined, COIN_PUBLIC_KEY),
    issuerPublicKey,
  );
  const context = createCircuitContext<PS>(
    CONTRACT_ADDRESS,
    ctorResult.currentZswapLocalState,
    ctorResult.currentContractState,
    ctorResult.currentPrivateState,
  );
  return { issuerPublicKey, context };
}

function currentLedger(context: ReturnType<typeof deploy>['context']): Ledger {
  return ledger(context.currentQueryContext.state);
}

describe('constructor', () => {
  it('publica la clave pública del emisor, nunca el secreto', () => {
    const issuerSecret = bytes32(1);
    const { issuerPublicKey, context } = deploy(issuerSecret);

    expect(currentLedger(context).authorizedIssuer).toEqual(issuerPublicKey);
    expect(currentLedger(context).authorizedIssuer).not.toEqual(issuerSecret);
  });
});

describe('issueLicense', () => {
  it('inserta el commitment cuando lo emite el issuer autorizado', () => {
    const issuerSecret = bytes32(1);
    const { context } = deploy(issuerSecret);

    const secret = bytes32(2);
    const licenseType = bytes32(10);
    const period = bytes32(20);
    const commitment = pureCircuits.computeCommitment(secret, licenseType, period);

    const issuer = new Contract<PS>(issuerWitnesses(issuerSecret));
    const { context: afterIssue } = issuer.circuits.issueLicense(context, commitment);

    expect(currentLedger(afterIssue).licenses.findPathForLeaf(commitment)).toBeDefined();
  });

  it('rechaza a un emisor que no conoce el secreto autorizado', () => {
    const { context } = deploy(bytes32(1));
    const impostorSecret = bytes32(99);
    const commitment = bytes32(50);

    const impostor = new Contract<PS>(issuerWitnesses(impostorSecret));
    expect(() => impostor.circuits.issueLicense(context, commitment)).toThrow(
      /No autorizado a emitir licencias/,
    );
  });
});

describe('proveLicense', () => {
  function issueOne(issuerSecret: Uint8Array, seed: number, licenseType: Uint8Array, period: Uint8Array) {
    const { context } = deploy(issuerSecret);
    const secret = bytes32(seed);
    const commitment = pureCircuits.computeCommitment(secret, licenseType, period);
    const issuer = new Contract<PS>(issuerWitnesses(issuerSecret));
    const { context: afterIssue } = issuer.circuits.issueLicense(context, commitment);
    return { secret, commitment, context: afterIssue };
  }

  it('acepta una credencial real y quema su nullifier, sin revelar el secreto', () => {
    const issuerSecret = bytes32(1);
    const licenseType = bytes32(10);
    const period = bytes32(20);
    const { secret, context } = issueOne(issuerSecret, 2, licenseType, period);

    const nullifier = pureCircuits.computeNullifier(secret);
    const worker = new Contract<PS>(proverWitnesses(secret, licenseType, period));
    const { context: afterProve } = worker.circuits.proveLicense(context, licenseType, period);

    expect(currentLedger(afterProve).spentNullifiers.member(nullifier)).toBe(true);
  });

  it('rechaza presentar la misma credencial dos veces (replay)', () => {
    const issuerSecret = bytes32(1);
    const licenseType = bytes32(10);
    const period = bytes32(20);
    const { secret, context } = issueOne(issuerSecret, 2, licenseType, period);

    const worker = new Contract<PS>(proverWitnesses(secret, licenseType, period));
    const { context: afterFirstProve } = worker.circuits.proveLicense(context, licenseType, period);

    const workerAgain = new Contract<PS>(proverWitnesses(secret, licenseType, period));
    expect(() => workerAgain.circuits.proveLicense(afterFirstProve, licenseType, period)).toThrow(
      /Esta licencia ya fue presentada/,
    );
  });

  it('rechaza una credencial que nunca fue emitida por ese issuer', () => {
    const issuerSecret = bytes32(1);
    const { context } = deploy(issuerSecret);

    const neverIssuedSecret = bytes32(77);
    const licenseType = bytes32(10);
    const period = bytes32(20);

    const worker = new Contract<PS>(proverWitnesses(neverIssuedSecret, licenseType, period));
    expect(() => worker.circuits.proveLicense(context, licenseType, period)).toThrow(
      /commitment no encontrado en el tree/,
    );
  });

  it('rechaza un camino de Merkle que no corresponde al commitment probado', () => {
    // Ataque: el worker conoce el secreto de la credencial A, pero intenta
    // colar el camino de Merkle de la credencial B (de otra persona) para
    // ver si el circuito solo chequea "algún camino válido del árbol" en
    // vez de atar el camino AL commitment reconstruido.
    const issuerSecret = bytes32(1);
    const licenseType = bytes32(10);
    const period = bytes32(20);

    const { context: afterA, secret: secretA } = issueOne(issuerSecret, 2, licenseType, period);
    const issuerB = new Contract<PS>(issuerWitnesses(issuerSecret));
    const secretB = bytes32(3);
    const commitmentB = pureCircuits.computeCommitment(secretB, licenseType, period);
    const { context: afterB } = issuerB.circuits.issueLicense(afterA, commitmentB);

    const attacker = new Contract<PS>(forgedProverWitnesses(secretA, commitmentB));
    expect(() => attacker.circuits.proveLicense(afterB, licenseType, period)).toThrow(
      /El camino no corresponde a esta credencial/,
    );
  });
});
