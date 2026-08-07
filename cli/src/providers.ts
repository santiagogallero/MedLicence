import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import type { MedLicenseProviders } from '@medlicense/api';

import { contractBuildPath, preprodEnvironment } from './config.js';
import type { MidnightWalletProvider } from './wallet.js';

export function configureProviders(wallet: MidnightWalletProvider): MedLicenseProviders {
  const zkConfigProvider = new NodeZkConfigProvider<'issueLicense' | 'proveLicense'>(contractBuildPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'medlicense-private-state',
      signingKeyStoreName: 'medlicense-signing-keys',
      accountId: 'medlicense-relay-demo',
      // Solo pasa la policy de validatePassword de midnight-js-utils (>=16
      // chars, 3 de 4 clases). No hay estado privado real que proteger acá
      // (ver PrivateState = undefined en api/src/midnight.ts).
      privateStoragePasswordProvider: () => 'MedLicense-Demo-2026!',
    }),
    publicDataProvider: indexerPublicDataProvider(preprodEnvironment.indexer, preprodEnvironment.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(preprodEnvironment.proofServer, zkConfigProvider),
    walletProvider: wallet,
    midnightProvider: wallet,
  } as MedLicenseProviders;
}
