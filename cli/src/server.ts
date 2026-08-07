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
 *   WALLET_SEED=<seed ya fondeada> ISSUER_SECRET=<secreto usado en el deploy> npx tsx src/server.ts
 *
 * La UI (ui/src/App.tsx) le pega a este server en vez de simular local.
 *
 * Para que otra persona (en otra compu) le pegue a este server, andá a
 * "expone el server en la red" más abajo: escucha en 0.0.0.0, no solo
 * localhost, así que alcanza con compartir tu IP de LAN.
 *
 * OJO — CORS está abierto a cualquier origen (`cors()` sin opciones) a
 * propósito, para no trabar la integración con el front del equipo en el
 * apuro del hackathon. No es una postura de producción: si esto se expone
 * más allá de la demo, hay que restringir el origen.
 */
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import pino from 'pino';

import { fromHex, LicenseAlreadyUsedError, MidnightMedLicenseApi } from '@medlicense/api';

import { previewEnvironment } from './config.js';
import { createLeaveWorkflowRouter } from './leaveWorkflow.js';
import { configureProviders } from './providers.js';
import { MidnightWalletProvider } from './wallet.js';

const logger = pino({ transport: { target: 'pino-pretty' } });
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const addressFile = path.resolve(currentDir, '..', '.contract-address');
const PORT = Number(process.env.PORT ?? 4787);

function localNetworkAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface!.address);
}

async function main() {
  if (!process.env.WALLET_SEED) {
    throw new Error(
      'Falta WALLET_SEED. Usá la misma wallet ya fondeada/con DUST generado de las corridas anteriores.',
    );
  }
  if (!process.env.ISSUER_SECRET) {
    throw new Error(
      'Falta ISSUER_SECRET. Tiene que ser EL MISMO secreto que se usó al deployar el contrato (ver cli/src/deploy.ts) — si no, issueLicense va a rechazar todo con "No autorizado a emitir licencias".',
    );
  }

  logger.info('Levantando wallet (puede tardar unos minutos en sincronizar)...');
  const wallet = await MidnightWalletProvider.build(logger, previewEnvironment, process.env.WALLET_SEED);
  await wallet.start();
  await wallet.ensureDustGenerated();

  const providers = configureProviders(wallet);
  const contractAddress = (await readFile(addressFile, 'utf8')).trim();
  const issuerSecret = fromHex(process.env.ISSUER_SECRET);
  const api = await MidnightMedLicenseApi.connect(providers, contractAddress, issuerSecret);
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

  // Ciclo de vida empresa → empleado → médico (ver leaveWorkflow.ts).
  app.use(createLeaveWorkflowRouter(api, logger));

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Bridge server escuchando en http://localhost:${PORT}`);
    for (const ip of localNetworkAddresses()) {
      logger.info(`  → accesible en la red local en http://${ip}:${PORT}`);
    }
    logger.info(
      'Para que otra compu en la misma red lo use: VITE_API_URL=http://<esa-ip>:' + PORT,
    );
  });
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
