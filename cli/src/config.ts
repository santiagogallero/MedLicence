import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Carpeta que `compact compile` generó: contiene keys/, zkir/ y contract/. */
export const contractBuildPath = path.resolve(currentDir, '..', '..', 'contract', 'build');

export const previewEnvironment = {
  walletNetworkId: 'preview' as const,
  networkId: 'preview' as const,
  indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preview.midnight.network',
  nodeWS: 'wss://rpc.preview.midnight.network',
  faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
  proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
};

// Tiene que llamarse antes de cualquier operación de wallet/contrato — si no,
// deployContract/findDeployedContract tiran "Network ID has not been configured".
setNetworkId(previewEnvironment.networkId);
