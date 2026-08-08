/**
 * Deploy manual + smoke test end-to-end contra Preview real (sin mock).
 *
 * Uso:
 *   WALLET_SEED=<64 hex chars, opcional> ISSUER_SECRET=<64 hex chars, opcional> npm run cli
 *
 * Sin WALLET_SEED genera una wallet nueva y hay que cargarla con tDUST del
 * faucet antes de continuar (el script espera confirmación por consola).
 * Con WALLET_SEED reusa la misma wallet/dirección entre corridas.
 *
 * ISSUER_SECRET es el secreto de la clínica (nunca sale on-chain, solo su
 * hash queda público como `authorizedIssuer`). Sin él se genera uno nuevo Y
 * SE DEPLOYA UN CONTRATO NUEVO, porque `authorizedIssuer` queda fijado para
 * siempre en el constructor — reusar el contrato con otro secreto significa
 * que issueLicense va a rechazar todo. Guardalo si querés emitir de nuevo
 * en el mismo contrato más adelante.
 *
 * Guarda la dirección del contrato en `.contract-address` (gitignored) y,
 * si ya existe, se conecta a ese contrato en vez de deployar uno nuevo.
 */
import { createInterface } from 'node:readline/promises';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';

import { fromHex, LicenseAlreadyUsedError, MidnightMedLicenseApi, randomBytes32, toHex } from '@medlicense/api';

import { previewEnvironment } from './config.js';
import { configureProviders } from './providers.js';
import { MidnightWalletProvider } from './wallet.js';

const logger = pino({ transport: { target: 'pino-pretty' } });
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const addressFile = path.resolve(currentDir, '..', '.contract-address');

async function loadSavedAddress(): Promise<string | null> {
  try {
    return (await readFile(addressFile, 'utf8')).trim();
  } catch {
    return null;
  }
}

function loadIssuerSecret(): Uint8Array {
  if (process.env.ISSUER_SECRET) return fromHex(process.env.ISSUER_SECRET);
  const secret = randomBytes32();
  logger.warn(
    `Generé un ISSUER_SECRET nuevo: ${toHex(secret)} — guardalo (env ISSUER_SECRET) si querés volver a emitir en este mismo contrato.`,
  );
  return secret;
}

async function main() {
  const wallet = await MidnightWalletProvider.build(logger, previewEnvironment, process.env.WALLET_SEED);
  await wallet.start();

  logger.info(`Dirección de la wallet (pegá esta en el faucet): ${wallet.unshieldedAddress}`);
  const rli = createInterface({ input: process.stdin, output: process.stdout });
  await rli.question(
    `Cargá tNIGHT en esa dirección desde el faucet (${previewEnvironment.faucet}) y presioná Enter para continuar...`,
  );
  rli.close();

  await wallet.ensureDustGenerated();

  const providers = configureProviders(wallet);
  const issuerSecret = loadIssuerSecret();

  const savedAddress = await loadSavedAddress();
  const api = savedAddress
    ? await MidnightMedLicenseApi.connect(providers, savedAddress, issuerSecret)
    : await MidnightMedLicenseApi.deploy(providers, issuerSecret);

  if (!savedAddress) {
    await writeFile(addressFile, api.address, 'utf8');
    logger.info(`Contrato deployado en ${api.address} (guardado en ${addressFile})`);
  } else {
    logger.info(`Conectado al contrato existente en ${api.address}`);
  }

  // --- Smoke test: emitir, probar, verificar, y confirmar que el reuso falla ---

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  logger.info('Emitiendo credencial de prueba...');
  const credential = await api.issueCredential({
    issuerId: 'clinica-demo',
    licenseType: 'MEDICA',
    periodStart: isoDate(today),
    periodEnd: isoDate(in7Days),
    diagnosisNote: 'esto nunca debería salir de acá',
  });
  logger.info(`Credencial emitida. Commitment: ${credential.commitment}`);

  logger.info('Generando y sometiendo la prueba (proveLicense)...');
  const proof = await api.generateProof(credential);
  logger.info(`Prueba sometida. tx: ${proof.proofBytes}`);

  const result = await api.verifyProof(proof);
  logger.info({ result }, 'Resultado de verificación');
  if (!result.valid) throw new Error('La primera verificación debería ser válida');

  logger.info('Intentando reusar la misma credencial (debería fallar)...');
  try {
    await api.generateProof(credential);
    throw new Error('Se esperaba que el reuso fallara y no falló');
  } catch (err) {
    if (err instanceof LicenseAlreadyUsedError) {
      logger.info('OK: el reuso fue rechazado por el nullifier, como se espera.');
    } else {
      throw err;
    }
  }

  const ledgerState = await api.getLedgerState();
  logger.info({ ledgerState }, 'Estado final del ledger');

  await wallet.stop();
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
