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
 * When ratePerUsdc is set (manual P2P buy ad), uses the trader's price.
 */
async function computeBuyQuoteFromFiat(fiatAmount, network, { ratePerUsdc = null } = {}) {
  const fiatCurrency = quoteEngine.networkToFiat(network);
  const fiatAmountNum = normalizeFiatAmount(fiatAmount, fiatCurrency);

  let usdcToFiat;
  let fiatFx;
  let rateSource;

  if (ratePerUsdc != null && Number(ratePerUsdc) > 0) {
    usdcToFiat = Number(ratePerUsdc);
    rateSource = 'TRADER_AD';
    fiatFx = {
      rate: usdcToFiat,
      fxSource: 'trader_ad',
      fxCurrency: fiatCurrency,
      fxWarning: null,
      fiatRateSource: 'TRADER_AD',
      fxProvider: 'trader_ad',
      fxFetchedAt: new Date().toISOString(),
      fxAgeSeconds: 0,
    };
  } else {
    fiatFx = await fxService.assertFiatFxAvailableForQuote(fiatCurrency);
    usdcToFiat = fiatFx.rate;
    rateSource = 'LIVE';
  }

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
    rateSource,
    quoteWarning: rateSource === 'TRADER_AD' ? null : null,
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
  const rateUgx = fiatCurrency === 'UGX' ? Math.round(userRateAfterSpread) : null;
  const feeUgx = fiatCurrency === 'UGX' ? Math.round(platformFeeNum) : null;

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
      rateUgx,
      feeUgx,
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
 * Create a locked buy quote (user pays fiat, receives USDC).
 * With payoutSettingId: manual P2P against that ad.
 * Without: Express — auto-pick best available buy ad.
 */
async function createBuyQuoteFromFiat({
  userId,
  fiatAmount,
  network,
  phoneHash,
  payoutSettingId = null,
}) {
  let resolvedPayoutSettingId = payoutSettingId || null;
  let traderName = null;

  if (!resolvedPayoutSettingId) {
    const fiatCurrency = quoteEngine.networkToFiat(network);
    const expressMatchingService = (await import('./expressMatchingService.js')).default;
    const best = await expressMatchingService.findBestBuyAdRanked({
      network,
      currency: fiatCurrency,
      fiatAmount,
      userId,
    });
    resolvedPayoutSettingId = best.payoutSettingId;
    traderName = best.traderName;
  }

  const adRateResult = await db.query(
    `SELECT rate_per_usdc FROM trader_payout_settings
     WHERE id = $1 AND is_active = TRUE AND ad_side = 'USER_BUY'`,
    [resolvedPayoutSettingId]
  );
  const ratePerUsdc = adRateResult.rows[0]?.rate_per_usdc != null
    ? parseFloat(adRateResult.rows[0].rate_per_usdc)
    : null;
  if (!ratePerUsdc || ratePerUsdc <= 0) {
    const err = new Error('Trader has not set a USDC price for this ad');
    err.statusCode = 409;
    err.code = 'TRADER_RATE_REQUIRED';
    throw err;
  }

  const computed = await computeBuyQuoteFromFiat(fiatAmount, network, { ratePerUsdc });
  const traderAdsService = (await import('./traderAdsService.js')).default;
  await traderAdsService.validateBuyAdForQuote(resolvedPayoutSettingId, {
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

  const quote = await persistBuyQuote({
    userId,
    network,
    phoneHash,
    computed,
    preferredPayoutSettingId: resolvedPayoutSettingId,
  });

  if (!traderName) {
    const nameRes = await db.query(
      `SELECT t.name FROM trader_payout_settings ps
       JOIN traders t ON t.id = ps.trader_id
       WHERE ps.id = $1`,
      [resolvedPayoutSettingId]
    );
    traderName = nameRes.rows[0]?.name || null;
  }

  return { ...quote, expressTraderName: traderName };
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
