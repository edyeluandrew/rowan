import { server as horizon, USDC_ASSET } from '../config/stellar.js';
import logger from '../utils/logger.js';

/**
 * Read USDC trustline + balance from a loaded Horizon account.
 */
export function usdcBalanceFromAccount(account) {
  if (!account?.balances) return { balance: 0, hasTrustline: false };
  const line = account.balances.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  return { balance: line ? Number(line.balance) : 0, hasTrustline: !!line };
}

/**
 * Check whether a trader Stellar address can receive USDC from escrow.
 */
export async function getTraderUsdcTrustlineStatus(stellarAddress) {
  if (!stellarAddress) {
    return { ok: false, hasTrustline: false, balance: 0, reason: 'NO_STELLAR_ADDRESS' };
  }

  try {
    const account = await horizon.loadAccount(stellarAddress);
    const { balance, hasTrustline } = usdcBalanceFromAccount(account);
    return {
      ok: true,
      hasTrustline,
      balance,
      reason: hasTrustline ? null : 'NO_USDC_TRUSTLINE',
    };
  } catch (err) {
    const notFound = err?.response?.status === 404 || /not found/i.test(err.message || '');
    logger.warn(
      `[TraderStellar] loadAccount failed for ${stellarAddress.slice(0, 8)}…: ${err.message}`
    );
    return {
      ok: false,
      hasTrustline: false,
      balance: 0,
      reason: notFound ? 'ACCOUNT_NOT_FOUND' : 'HORIZON_ERROR',
      error: err.message,
    };
  }
}

/**
 * Throws a client-safe error when the trader cannot receive USDC.
 */
export async function assertTraderCanReceiveUsdc(stellarAddress) {
  const status = await getTraderUsdcTrustlineStatus(stellarAddress);
  if (status.hasTrustline) return status;

  const err = new Error(
    'Your Stellar wallet must have a USDC trustline before you can accept cash-out requests. ' +
    'Add the USDC trustline in Wallet settings, then try again.'
  );
  err.statusCode = 400;
  err.code = status.reason || 'NO_USDC_TRUSTLINE';
  throw err;
}

export default {
  usdcBalanceFromAccount,
  getTraderUsdcTrustlineStatus,
  assertTraderCanReceiveUsdc,
};
