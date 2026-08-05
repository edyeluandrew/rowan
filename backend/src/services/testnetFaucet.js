import config from '../config/index.js';
import redis from '../db/redis.js';
import logger from '../utils/logger.js';
import { server, USDC_ASSET, StellarSdk, networkPassphrase } from '../config/stellar.js';

const STELLAR_G_REGEX = /^G[A-Z2-7]{55}$/;

function faucetSecretKey() {
  return config.testnetFaucet.secretKey || config.stellar.marketMakerSecretKey || null;
}

/**
 * Send testnet USDC from the Rowan faucet wallet (direct payment — no DEX).
 * Testnet only. Returns null when faucet is not configured.
 */
export async function sendTestnetUsdc(publicKey) {
  if (config.stellar.network !== 'testnet') {
    throw new Error('Testnet faucet is not available on mainnet');
  }
  if (!STELLAR_G_REGEX.test(publicKey)) {
    throw new Error('Invalid Stellar public key');
  }

  const secret = faucetSecretKey();
  if (!secret) {
    logger.warn('[TestnetFaucet] No TESTNET_FAUCET_SECRET_KEY or MARKET_MAKER_SECRET_KEY — faucet disabled');
    return null;
  }

  const amount = config.testnetFaucet.amount;
  const cooldownKey = `testnet:faucet:${publicKey}`;

  let account;
  try {
    account = await server.loadAccount(publicKey);
  } catch (err) {
    if (err?.response?.status === 404) {
      throw new Error(
        'Stellar account not activated yet. Fund with Friendbot (Receive → Set up network fees) before requesting test USDC.'
      );
    }
    throw err;
  }

  const usdcLine = account.balances.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  const currentUsdc = usdcLine ? parseFloat(usdcLine.balance) : 0;

  if (currentUsdc >= config.testnetFaucet.minBalanceToSkip) {
    return {
      skipped: 'already_has_usdc',
      usdcAmount: currentUsdc,
      publicKey,
    };
  }

  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) {
    throw new Error('Test USDC was sent recently. Wait a bit or use Get test USDC again later.');
  }

  const faucetKeypair = StellarSdk.Keypair.fromSecret(secret);
  const faucetAccount = await server.loadAccount(faucetKeypair.publicKey());
  const faucetUsdcLine = faucetAccount.balances.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  const faucetUsdc = faucetUsdcLine ? parseFloat(faucetUsdcLine.balance) : 0;
  if (faucetUsdc < amount) {
    throw new Error(
      `Testnet treasury is low (${faucetUsdc.toFixed(2)} USDC). Ops: npm run script:treasury-prepare → Circle → sweep`
    );
  }

  const tx = new StellarSdk.TransactionBuilder(faucetAccount, {
    fee: config.stellarMaxFee,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: publicKey,
        asset: USDC_ASSET,
        amount: amount.toFixed(7),
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(faucetKeypair);
  const result = await server.submitTransaction(tx);

  await redis.set(cooldownKey, result.hash, 'EX', config.testnetFaucet.cooldownSeconds);

  logger.info(`[TestnetFaucet] Sent ${amount} USDC (issuer ${USDC_ASSET.issuer}) to ${publicKey} — tx ${result.hash}`);

  return {
    usdcAmount: amount,
    publicKey,
    txHash: result.hash,
    source: 'circle_testnet_usdc',
    issuer: USDC_ASSET.issuer,
  };
}
