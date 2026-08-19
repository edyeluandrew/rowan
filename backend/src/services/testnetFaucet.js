import config from '../config/index.js';
import redis from '../db/redis.js';
import logger from '../utils/logger.js';
import { server, USDC_ASSET, StellarSdk, networkPassphrase } from '../config/stellar.js';

const STELLAR_G_REGEX = /^G[A-Z2-7]{55}$/;

function activationSecretKey() {
  return config.testnetFaucet.secretKey || null;
}

function nativeXlm(account) {
  const row = account?.balances?.find((b) => b.asset_type === 'native');
  return row ? parseFloat(row.balance) : 0;
}

function hasUsdcTrustline(account) {
  return !!account?.balances?.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
}

function formatXlm(amount) {
  return Number(amount).toFixed(7);
}

/**
 * Build a sponsor-signed tx the user must co-sign.
 * Reserves for the account + USDC trustline stay on Rowan (not withdrawable).
 * A tiny native pad is the user's only spendable XLM (network fees).
 */
function buildSponsoredSetupTx({ sponsorAccount, publicKey, createAccount }) {
  const feePad = config.testnetFaucet.feePadXlm || 0.05;
  const builder = new StellarSdk.TransactionBuilder(sponsorAccount, {
    fee: config.stellarMaxFee,
    networkPassphrase,
  }).addOperation(
    StellarSdk.Operation.beginSponsoringFutureReserves({
      sponsoredId: publicKey,
    })
  );

  if (createAccount) {
    builder.addOperation(
      StellarSdk.Operation.createAccount({
        destination: publicKey,
        startingBalance: formatXlm(feePad),
      })
    );
  }

  builder
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: USDC_ASSET,
        source: publicKey,
      })
    )
    .addOperation(
      StellarSdk.Operation.endSponsoringFutureReserves({
        source: publicKey,
      })
    );

  return builder.setTimeout(60).build();
}

/**
 * Prepare (or skip) wallet activation. New accounts are sponsored so the
 * reserve XLM cannot be withdrawn. Returns an XDR the user must co-sign.
 */
export async function activateWalletAccount(publicKey) {
  if (config.stellar.network !== 'testnet') {
    throw new Error('Wallet activation is not available on mainnet');
  }
  if (!STELLAR_G_REGEX.test(publicKey)) {
    throw new Error('Invalid Stellar public key');
  }

  const secret = activationSecretKey();
  if (!secret) {
    logger.warn('[WalletActivate] No WALLET_ACTIVATION_SECRET_KEY — disabled');
    return null;
  }

  let account = null;
  try {
    account = await server.loadAccount(publicKey);
  } catch (err) {
    if (err?.response?.status !== 404) throw err;
  }

  if (account && hasUsdcTrustline(account)) {
    return {
      skipped: 'ready',
      xlmAmount: nativeXlm(account),
      publicKey,
    };
  }

  if (account && !hasUsdcTrustline(account) && nativeXlm(account) >= 1.5) {
    return {
      skipped: 'self_trustline',
      xlmAmount: nativeXlm(account),
      publicKey,
    };
  }

  const lockKey = `wallet:activate:lock:${publicKey}`;
  const locked = await redis.set(lockKey, '1', 'EX', 60, 'NX');
  if (!locked) {
    throw new Error('Wallet activation is already in progress. Wait a few seconds.');
  }

  const sponsorKeypair = StellarSdk.Keypair.fromSecret(secret);
  const sponsorAccount = await server.loadAccount(sponsorKeypair.publicKey());
  const sponsorXlm = nativeXlm(sponsorAccount);
  if (sponsorXlm < 5) {
    throw new Error(
      `Activation wallet is low on XLM (${sponsorXlm.toFixed(2)}). Fund WALLET_ACTIVATION_PUBLIC_KEY with XLM.`
    );
  }

  const tx = buildSponsoredSetupTx({
    sponsorAccount,
    publicKey,
    createAccount: !account,
  });
  tx.sign(sponsorKeypair);

  logger.info(
    `[WalletActivate] Sponsored ${account ? 'trustline' : 'create+trustline'} for ${publicKey}`
  );

  return {
    publicKey,
    xdr: tx.toXDR(),
    created: !account,
    sponsored: true,
  };
}

/**
 * Send testnet USDC from the Rowan activation wallet (direct payment — no DEX).
 * Testnet only. Returns null when not configured.
 */
export async function sendTestnetUsdc(publicKey) {
  if (config.stellar.network !== 'testnet') {
    throw new Error('Testnet faucet is not available on mainnet');
  }
  if (!STELLAR_G_REGEX.test(publicKey)) {
    throw new Error('Invalid Stellar public key');
  }

  const secret = activationSecretKey();
  if (!secret) {
    logger.warn('[TestnetUsdc] No WALLET_ACTIVATION_SECRET_KEY — disabled');
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
        'Wallet is being prepared. USDC opens automatically in a moment — try again shortly.'
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

  if (!usdcLine) {
    throw new Error(
      'Wallet is being prepared. USDC opens automatically in a moment — try again shortly.'
    );
  }

  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) {
    throw new Error('Test USDC was sent recently. Wait a bit or try again later.');
  }

  const opsKeypair = StellarSdk.Keypair.fromSecret(secret);
  const opsAccount = await server.loadAccount(opsKeypair.publicKey());
  const opsUsdcLine = opsAccount.balances.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  const opsUsdc = opsUsdcLine ? parseFloat(opsUsdcLine.balance) : 0;
  if (opsUsdc < amount) {
    throw new Error(
      `Activation wallet is low (${opsUsdc.toFixed(2)} USDC). Fund it from Circle testnet.`
    );
  }

  const tx = new StellarSdk.TransactionBuilder(opsAccount, {
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

  tx.sign(opsKeypair);
  const result = await server.submitTransaction(tx);

  await redis.set(cooldownKey, result.hash, 'EX', config.testnetFaucet.cooldownSeconds);

  logger.info(`[TestnetUsdc] Sent ${amount} USDC to ${publicKey} — tx ${result.hash}`);

  return {
    usdcAmount: amount,
    publicKey,
    txHash: result.hash,
    source: 'circle_testnet_usdc',
    issuer: USDC_ASSET.issuer,
  };
}
