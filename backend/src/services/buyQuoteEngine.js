import redis from '../db/redis.js';
import config from '../config/index.js';
import { nanoid } from 'nanoid';
import db from '../db/index.js';
import logger from '../utils/logger.js';
import fxService from './fxService.js';
import quoteEngine from './quoteEngine.js';

const { quoteTtlSeconds, feePercent, spreadPercent } = config.platform;

function normalizeFiatAmount(amount, fiatCurrency) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid fiat amount: ${amount}`);
  if (fiatCurrency === 'KES') return parseFloat(n.toFixed(2));
  return Math.round(n);
}

/**
 * Compute USDC the user receives when paying a target fiat amount (MoMo).
 */
async function computeBuyQuoteFromFiat(fiatAmount, network) {
  const fiatCurrency = quoteEngine.networkToFiat(network);
  const fiatFx = await fxService.assertFiatFxAvailableForQuote(fiatCurrency);
  const usdcToFiat = fiatFx.rate;
  const fiatAmountNum = normalizeFiatAmount(fiatAmount, fiatCurrency);

  const spreadMultiplierUser = 1 - (spreadPercent / 100);
  const feeMultiplier = 1 - (feePercent / 100);
  const usdcAmount = (fiatAmountNum * spreadMultiplierUser * feeMultiplier) / usdcToFiat;
  const platformFeeNum = fiatAmountNum * (feePercent / 100);
  const userRateAfterSpread = fiatAmountNum / usdcAmount;

  return {
    fiatCurrency,
    fiatFx,
    fiatAmountNum,
    usdcAmount: parseFloat(usdcAmount.toFixed(7)),
    platformFeeNum,
    userRateAfterSpread,
    usdcToFiat,
    rateSource: 'LIVE',
    quoteWarning: null,
  };
}

async function persistBuyQuote({
  userId,
  network,
  phoneHash,
  computed,
  preferredPayoutSettingId,
}) {
  const {
    fiatCurrency,
    fiatFx,
    fiatAmountNum,
    usdcAmount,
    platformFeeNum,
    userRateAfterSpread,
    rateSource,
    quoteWarning,
  } = computed;

  const memo = `ROWAN-buy_${nanoid(8)}`;
  const expiresAt = new Date(Date.now() + quoteTtlSeconds * 1000);

  const result = await db.query(
    `INSERT INTO quotes
       (user_id, xlm_amount, fiat_currency, market_rate, user_rate, fiat_amount,
        platform_fee, network, phone_hash, memo, escrow_address, expires_at,
        rate_ugx, fee_ugx, status, path_xlm_needed, path_usdc_received, quote_source,
        rate_source, quote_warning, fx_source, fx_rate, fx_currency, fx_warning,
        fiat_rate_source, fx_provider, fx_fetched_at, fx_age_seconds,
        preferred_payout_setting_id, order_side)
     VALUES ($1, 0, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING', 0, $14, 'buy-fiat',
             $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'BUY')
     RETURNING *`,
    [
      userId,
      fiatCurrency,
      userRateAfterSpread,
      userRateAfterSpread,
      fiatAmountNum,
      platformFeeNum,
      network,
      phoneHash,
      memo,
      config.stellar.escrowPublicKey,
      expiresAt,
      fiatCurrency === 'UGX' ? userRateAfterSpread : null,
      fiatCurrency === 'UGX' ? platformFeeNum : null,
      usdcAmount,
      rateSource,
      quoteWarning,
      fiatFx.fxSource,
      fiatFx.rate,
      fiatFx.fxCurrency,
      fiatFx.fxWarning,
      fiatFx.fiatRateSource,
      fiatFx.fxProvider,
      fiatFx.fxFetchedAt ? new Date(fiatFx.fxFetchedAt) : null,
      fiatFx.fxAgeSeconds,
      preferredPayoutSettingId,
    ]
  );

  const quote = result.rows[0];
  await redis.set(`quote:${memo}`, JSON.stringify(quote), 'EX', quoteTtlSeconds);
  logger.info(`[BuyQuote] Quote ${quote.id} memo=${memo} fiat=${fiatAmountNum} usdc=${usdcAmount}`);
  return quote;
}

/**
 * Create a locked buy quote (user pays fiat, receives USDC). Manual P2P only.
 */
async function createBuyQuoteFromFiat({
  userId,
  fiatAmount,
  network,
  phoneHash,
  payoutSettingId,
}) {
  if (!payoutSettingId) {
    const err = new Error('payoutSettingId is required for manual P2P buy');
    err.statusCode = 400;
    err.code = 'PAYOUT_SETTING_REQUIRED';
    throw err;
  }

  const computed = await computeBuyQuoteFromFiat(fiatAmount, network);
  const traderAdsService = (await import('./traderAdsService.js')).default;
  await traderAdsService.validateBuyAdForQuote(payoutSettingId, {
    network,
    currency: computed.fiatCurrency,
    fiatAmount: computed.fiatAmountNum,
    usdcAmount: computed.usdcAmount,
    userId,
  });

  if (computed.usdcAmount < 0.01) {
    const err = new Error('Amount too small to buy USDC');
    err.statusCode = 400;
    err.code = 'AMOUNT_BELOW_MIN';
    throw err;
  }

  return persistBuyQuote({
    userId,
    network,
    phoneHash,
    computed,
    preferredPayoutSettingId: payoutSettingId,
  });
}

async function getBuyQuoteById(quoteId, userId) {
  const result = await db.query(
    `SELECT * FROM quotes WHERE id = $1 AND user_id = $2 AND order_side = 'BUY'`,
    [quoteId, userId]
  );
  return result.rows[0] || null;
}

export default {
  computeBuyQuoteFromFiat,
  createBuyQuoteFromFiat,
  getBuyQuoteById,
};
