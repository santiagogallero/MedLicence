import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Carpeta que `compact compile` generó: contiene keys/, zkir/ y contract/. */
export const contractBuildPath = path.resolve(currentDir, '..', '..', 'contract', 'build');

/**
 * Preprod, según la matriz de compatibilidad vigente para este proyecto
 * (compiler 0.31.0 / ledger 8.0.3 / midnight-js 4.0.4 / proof-server 8.0.3).
 */
export const preprodEnvironment = {
  walletNetworkId: 'preprod' as const,
  networkId: 'preprod' as const,
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  nodeWS: 'wss://rpc.preprod.midnight.network',
  faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
  proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
};
