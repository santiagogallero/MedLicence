/**
 * Wallet headless (sin Lace) para correr desde este CLI, con la wallet
 * pagando el gas de todas las operaciones (issueLicense y proveLicense).
 * Simplificación de demo — ver nota en api/src/midnight.ts.
 *
 * Estructura adaptada del patrón oficial documentado para bboard-cli
 * (misma forma de implementar MidnightProvider + WalletProvider); no es
 * código copiado del repo example-bboard, es la forma estándar de armar
 * una wallet headless con testkit-js.
 */
import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProvider, UnboundTransaction, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import {
  FluentWalletBuilder,
  type DustWalletOptions,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';
import type { UnshieldedKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { Logger } from 'pino';

export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  private constructor(
    private readonly logger: Logger,
    readonly wallet: WalletFacade,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    private readonly unshieldedKeystore: UnshieldedKeystore,
  ) {}

  /** Dirección bech32m (`mn_addr_preview...`) — la que pide el faucet de tNIGHT. */
  get unshieldedAddress(): string {
    return this.unshieldedKeystore.getBech32Address().asString();
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl },
    );
    return this.wallet.finalizeRecipe(recipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  async start(): Promise<void> {
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  /**
   * NIGHT no genera DUST solo: hay que registrar las UTXOs con una tx
   * explícita, y esperar (~1-2 min) a que la red la procese. Sin esto,
   * cualquier operación falla con "Insufficient Funds: could not balance
   * dust" aunque la wallet ya tenga tNIGHT del faucet.
   */
  async ensureDustGenerated(): Promise<void> {
    let state = await this.wallet.waitForSyncedState();

    if (state.dust.availableCoins.length === 0) {
      const unregistered = state.unshielded.availableCoins.filter(
        (coin) => coin.meta?.registeredForDustGeneration !== true,
      );
      if (unregistered.length === 0) {
        this.logger.warn('No hay NIGHT disponible para registrar — ¿ya cargaste el faucet?');
      } else {
        this.logger.info(`Registrando ${unregistered.length} UTXO(s) de NIGHT para generación de DUST...`);
        const recipe = await this.wallet.registerNightUtxosForDustGeneration(
          unregistered,
          this.unshieldedKeystore.getPublicKey(),
          (payload) => this.unshieldedKeystore.signData(payload),
        );
        const finalized = await this.wallet.finalizeRecipe(recipe);
        const txId = await this.wallet.submitTransaction(finalized);
        this.logger.info(`Registro de DUST sometido: ${txId}`);
      }
    }

    this.logger.info('Esperando a que se genere DUST (puede tardar 1-2 minutos)...');
    while (true) {
      state = await this.wallet.waitForSyncedState();
      const dustBalance = state.dust.balance(new Date());
      if (dustBalance > 0n) {
        this.logger.info(`DUST disponible: ${dustBalance}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }

  /**
   * `seed` fijo (env `WALLET_SEED`) para reusar la misma dirección entre
   * corridas — así no hay que recargar el faucet cada vez. Sin `seed`,
   * genera una nueva (y hay que fondearla de nuevo).
   */
  static async build(
    logger: Logger,
    env: EnvironmentConfiguration,
    seed?: string,
  ): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };
    const builder = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
    const buildResult = seed
      ? await builder.withSeed(seed).buildWithoutStarting()
      : await builder.withRandomSeed().buildWithoutStarting();
    const { wallet, seeds, keystore } = buildResult as {
      wallet: WalletFacade;
      seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };

    logger.info(`Wallet seed: ${seeds.masterSeed}`);
    if (!seed) {
      logger.warn('Guardá este seed en WALLET_SEED si querés reusar esta wallet la próxima corrida.');
    }

    return new MidnightWalletProvider(
      logger,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
    );
  }
}
