import * as StellarSdk from '@stellar/stellar-sdk';
import config from './index.js';

const isTestnet = config.stellar.network === 'testnet';

export const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

export const networkPassphrase = isTestnet
  ? StellarSdk.Networks.TESTNET
  : StellarSdk.Networks.PUBLIC;

export const escrowKeypair = config.stellar.escrowSecretKey
  ? StellarSdk.Keypair.fromSecret(config.stellar.escrowSecretKey)
  : null;

const usdcIssuer = isTestnet ? config.usdcIssuerTestnet : config.usdcIssuerMainnet;

export const USDC_ASSET = new StellarSdk.Asset('USDC', usdcIssuer);

export { StellarSdk };
