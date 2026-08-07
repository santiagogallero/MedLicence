/**
 * Servidor puente entre la UI (browser) y el backend real de Midnight.
 *
 * MidnightMedLicenseApi corre en Node (wallet headless, filesystem para los
 * assets ZK) — no puede vivir en el browser sin reescribir los providers
 * para DApp Connector / Lace. Este server hace de puente: arranca UNA vez
 * (conecta wallet + contrato, ~4 min si la wallet no está sincronizada),
 * y después atiende requests HTTP de la UI reusando esa misma conexión.
 *
 * Uso:
 *   WALLET_SEED=<seed ya fondeada> npx tsx src/server.ts
 *
 * La UI (ui/src/App.tsx) le pega a este server en vez de simular local.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import pino from 'pino';

import { LicenseAlreadyUsedError, MidnightMedLicenseApi } from '@medlicense/api';

import { previewEnvironment } from './config.js';
import { configureProviders } from './providers.js';
import { MidnightWalletProvider } from './wallet.js';

const logger = pino({ transport: { target: 'pino-pretty' } });
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const addressFile = path.resolve(currentDir, '..', '.contract-address');
const PORT = Number(process.env.PORT ?? 4787);

async function main() {
  if (!process.env.WALLET_SEED) {
    throw new Error(
      'Falta WALLET_SEED. Usá la misma wallet ya fondeada/con DUST generado de las corridas anteriores.',
    );
  }

  logger.info('Levantando wallet (puede tardar unos minutos en sincronizar)...');
  const wallet = await MidnightWalletProvider.build(logger, previewEnvironment, process.env.WALLET_SEED);
  await wallet.start();
  await wallet.ensureDustGenerated();

  const providers = configureProviders(wallet);
  const contractAddress = (await readFile(addressFile, 'utf8')).trim();
  const api = await MidnightMedLicenseApi.connect(providers, contractAddress);
  logger.info(`Conectado al contrato ${contractAddress}. Server listo.`);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, contractAddress });
  });

  app.post('/issue', async (req, res) => {
    try {
      const credential = await api.issueCredential(req.body);
      const issuerRoot = (await api.getLedgerState()).issuerRoot;
      res.json({ credential, issuerRoot });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'ISSUE_FAILED', message: String(err) });
    }
  });

  app.post('/prove', async (req, res) => {
    try {
      const proof = await api.generateProof(req.body.credential);
      res.json({ proof });
    } catch (err) {
      if (err instanceof LicenseAlreadyUsedError) {
        res.status(409).json({ error: 'ALREADY_USED', message: err.message });
        return;
      }
      logger.error(err);
      res.status(500).json({ error: 'PROVE_FAILED', message: String(err) });
    }
  });

  app.post('/verify', async (req, res) => {
    try {
      const result = await api.verifyProof(req.body.proof);
      res.json({ result });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'VERIFY_FAILED', message: String(err) });
    }
  });

  app.get('/ledger', async (_req, res) => {
    res.json(await api.getLedgerState());
  });

  app.listen(PORT, () => {
    logger.info(`Bridge server escuchando en http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
