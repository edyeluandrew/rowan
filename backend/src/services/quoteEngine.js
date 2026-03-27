import redis from '../db/redis.js';
import config from '../config/index.js';
import { server as horizon, USDC_ASSET, StellarSdk } from '../config/stellar.js';
import { nanoid } from 'nanoid';
import db from '../db/index.js';
import logger from '../utils/logger.js';

// ── N7 FIX: Top-level Asset reference instead of dynamic import ──
const NativeAsset = StellarSdk.Asset.native();

/**
 * Fetch the best XLM→USDC rate from the market maker's active offers.
 * Queries Horizon for all offers from the market maker account, finds the best ask price.
 * Returns null if no offers available or if market maker not configured.
 */
async function getMarketMakerRate() {
  if (!config.stellar.marketMakerPublicKey) {
    logger.debug('[QuoteEngine] Market maker not configured, skipping');
    return null;
  }

  try {
    const offers = await horizon
      .offers()
      .forAccount(config.stellar.marketMakerPublicKey)
      .call();

    // Filter for XLM→USDC offers (selling XLM, asking USDC)
    // In Stellar offers, selling_asset is what they're parting with, buying_asset is what they want
    const xlmToUsdcOffers = offers.records.filter(offer => {
      const sellingIsNative = offer.selling.asset_type === 'native';
      const buyingIsUsdc = offer.buying.asset_code === 'USDC' &&
                           offer.buying.asset_issuer === USDC_ASSET.issuer;
      return sellingIsNative && buyingIsUsdc;
    });

    if (xlmToUsdcOffers.length === 0) {
      logger.warn('[QuoteEngine] No XLM→USDC offers from market maker');
      return null;
    }

    // Find the best (lowest) price for us as a buyer
    // Price = what they're asking for 1 unit of what they're selling
    const bestOffer = xlmToUsdcOffers.reduce((best, current) => {
      const currentPrice = parseFloat(current.price);
      const bestPrice = parseFloat(best.price);
      return currentPrice < bestPrice ? current : best;
    });

    const bestRate = parseFloat(bestOffer.price);
    logger.info(`[QuoteEngine] Market maker best rate: ${bestRate} USDC/XLM (offer ID: ${bestOffer.id})`);
    return bestRate;
  } catch (err) {
    logger.warn('[QuoteEngine] Failed to fetch market maker offers:', err.message);
    return null;
  }
}

const { quoteTtlSeconds, feePercent, spreadPercent, rateCacheTtlSeconds } = config.platform;

/**
 * Fetch the live XLM rate for a given fiat currency.
 * Priority:
 * 1. Market Maker offers (if available and better/comparable)
 * 2. Stellar DEX (XLM → USDC → fiat estimate)
 * 3. Fallback: CoinGecko API
 * Cached in Redis for 30 seconds.
 */
async function getXlmRate(fiatCurrency = 'UGX') {
  const cacheKey = `rate:xlm:${fiatCurrency}`;
  const cached = await redis.get(cacheKey);
  if (cached) return parseFloat(cached);

  let rate;

  try {
    // Priority 1: Market Maker offers
    const mmRate = await getMarketMakerRate();
    if (mmRate) {
      // Convert market maker rate (USDC/XLM) to fiat currency
      const usdcToFiat = getUsdcToFiatRate(fiatCurrency);
      rate = mmRate * usdcToFiat;
      logger.info(`[QuoteEngine] Using market maker rate: ${mmRate} USDC/XLM → ${rate} ${fiatCurrency}/XLM`);
    }
  } catch (err) {
    logger.warn('[QuoteEngine] Market maker rate fetch failed:', err.message);
  }

  // Fallback to DEX if market maker unavailable
  if (!rate) {
    try {
      // Priority 2: Stellar DEX — get XLM/USDC mid-market price
      const orderbook = await horizon
        .orderbook(NativeAsset, USDC_ASSET)
        .call();

      if (orderbook.asks.length > 0 && orderbook.bids.length > 0) {
        const bestAsk = parseFloat(orderbook.asks[0].price);
        const bestBid = parseFloat(orderbook.bids[0].price);
        const xlmUsdcMid = (bestAsk + bestBid) / 2; // XLM price in USDC

        // Convert USDC → fiat using static rates (later: live FX feed)
        const usdcToFiat = getUsdcToFiatRate(fiatCurrency);
        rate = xlmUsdcMid * usdcToFiat;
        logger.info(`[QuoteEngine] Using DEX rate: ${xlmUsdcMid} USDC/XLM → ${rate} ${fiatCurrency}/XLM`);
      }
    } catch (err) {
      logger.warn('[QuoteEngine] Stellar DEX fetch failed, falling back to CoinGecko:', err.message);
    }
  }

  if (!rate) {
    // Priority 3: Fallback: CoinGecko
    try {
      const fiatLower = fiatCurrency.toLowerCase();
      const res = await fetch(
        `${config.coingeckoApiUrl}/simple/price?ids=stellar&vs_currencies=${fiatLower}`
      );
      const data = await res.json();
      rate = data?.stellar?.[fiatLower];
      logger.info(`[QuoteEngine] Using CoinGecko rate: ${rate} ${fiatCurrency}/XLM`);
    } catch (err) {
      logger.error('[QuoteEngine] CoinGecko fallback also failed:', err.message);
      throw new Error('Unable to fetch XLM rate from any source');
    }
  }

  if (!rate || rate <= 0) throw new Error('Invalid XLM rate fetched');

  // [AUDIT FIX] Cache TTL from config instead of hardcoded 30
  await redis.set(cacheKey, rate.toString(), 'EX', rateCacheTtlSeconds);
  return rate;
}

/**
 * USDC → fiat conversion rates.
 * [AUDIT FIX] Loaded from config (env-overridable) instead of hardcoded.
 * Phase 2: replace with live FX API.
 */
function getUsdcToFiatRate(fiatCurrency) {
  return config.usdcFiatRates[fiatCurrency] || config.usdcFiatRates.UGX;
}

/**
 * Convert a fiat amount to UGX equivalent using cross-rates.
 */
function fiatToUgxRate(amount, fiatCurrency) {
  if (fiatCurrency === 'UGX') return amount;
  const KES_TO_UGX = config.usdcFiatRates.UGX / config.usdcFiatRates.KES;
  const TZS_TO_UGX = config.usdcFiatRates.UGX / config.usdcFiatRates.TZS;
  if (fiatCurrency === 'KES') return amount * KES_TO_UGX;
  if (fiatCurrency === 'TZS') return amount * TZS_TO_UGX;
  return amount;
}

/**
 * Create a locked quote.
 * Returns the quote object with a 60-second TTL.
 */
async function createQuote({ userId, xlmAmount, network, phoneHash }) {
  const fiatCurrency = networkToFiat(network);
  const marketRate = await getXlmRate(fiatCurrency);

  // ── B2 FIX: traderRate is the wholesale rate (spread below market).
  // [AUDIT FIX] Spread from config instead of hardcoded 0.9875 (1.25%).
  // The USER receives fiat based on traderRate (not raw market rate).
  // The spread between marketRate and traderRate is platform revenue.
  const spreadMultiplier = 1 - (spreadPercent / 100);
  const traderRate = marketRate * spreadMultiplier;
  const userRate = traderRate; // user sees the post-spread rate

  // Fiat the user receives = XLM × userRate × (1 - platformFee)
  const grossFiat = xlmAmount * userRate;
  const platformFee = grossFiat * (feePercent / 100);
  const fiatAmount = grossFiat - platformFee;

  // Platform revenue = spread revenue + explicit fee
  const spreadRevenue = xlmAmount * (marketRate - traderRate);

  const memo = `ROWAN-qt_${nanoid(8)}`;
  const expiresAt = new Date(Date.now() + quoteTtlSeconds * 1000);

  // Persist to DB
  // ── [L-5 FIX] Also write rate_ugx, fee_ugx for multi-currency normalization ──
  const usdcToUgx = config.usdcFiatRates.UGX;
  const xlmToUsdc = marketRate / getUsdcToFiatRate(fiatCurrency);
  const rateUgx = Math.round(xlmToUsdc * usdcToUgx); // XLM price in UGX
  const feeUgx = Math.round(fiatToUgxRate(platformFee, fiatCurrency));

  // ── AUDIT FIX: Pass numeric values, not strings from .toFixed() ──
  const fiatAmountNum = parseFloat(fiatAmount.toFixed(2));
  const platformFeeNum = parseFloat(platformFee.toFixed(2));
  
  logger.info(`[QuoteEngine] Amount validation: fiatAmount=${fiatAmountNum} (type: ${typeof fiatAmountNum}, finite: ${Number.isFinite(fiatAmountNum)}), platformFee=${platformFeeNum} (type: ${typeof platformFeeNum}, finite: ${Number.isFinite(platformFeeNum)})`);
  
  if (!Number.isFinite(fiatAmountNum) || !Number.isFinite(platformFeeNum)) {
    throw new Error(`Invalid amounts calculated: fiatAmount=${fiatAmount}, platformFee=${platformFee}`);
  }

  const result = await db.query(
    `INSERT INTO quotes
       (user_id, xlm_amount, fiat_currency, market_rate, user_rate, fiat_amount,
        platform_fee, network, phone_hash, memo, escrow_address, expires_at,
        rate_ugx, fee_ugx, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDING')
     RETURNING *`,
    [
      userId, xlmAmount, fiatCurrency, marketRate, userRate,
      fiatAmountNum, platformFeeNum,
      network, phoneHash, memo,
      config.stellar.escrowPublicKey, expiresAt,
      rateUgx, feeUgx,
    ]
  );

  const quote = result.rows[0];

  // Also cache in Redis for fast lookup by memo
  await redis.set(`quote:${memo}`, JSON.stringify(quote), 'EX', quoteTtlSeconds);

  return quote;
}

/**
 * Look up a cached quote by its memo string.
 */
async function getQuoteByMemo(memo) {
  // Try Redis first
  const cached = await redis.get(`quote:${memo}`);
  if (cached) {
    const quote = JSON.parse(cached);
    // Ensure amounts are numbers (in case Redis stored them as strings)
    if (quote.fiat_amount) quote.fiat_amount = Number(quote.fiat_amount);
    if (quote.platform_fee) quote.platform_fee = Number(quote.platform_fee);
    if (quote.xlm_amount) quote.xlm_amount = Number(quote.xlm_amount);
    if (quote.user_rate) quote.user_rate = Number(quote.user_rate);
    if (quote.market_rate) quote.market_rate = Number(quote.market_rate);
    if (quote.rate_ugx) quote.rate_ugx = Number(quote.rate_ugx);
    if (quote.fee_ugx) quote.fee_ugx = Number(quote.fee_ugx);
    return quote;
  }

  // Fall back to DB
  const result = await db.query(
    `SELECT * FROM quotes WHERE memo = $1 AND is_used = FALSE AND expires_at > NOW()`,
    [memo]
  );
  
  if (!result.rows[0]) return null;
  
  const quote = result.rows[0];
  // ── CRITICAL FIX: PostgreSQL NUMERIC and BIGINT columns return as strings ──
  // Explicitly convert to numbers before returning
  if (quote.fiat_amount) quote.fiat_amount = Number(quote.fiat_amount);
  if (quote.platform_fee) quote.platform_fee = Number(quote.platform_fee);
  if (quote.xlm_amount) quote.xlm_amount = Number(quote.xlm_amount);
  if (quote.user_rate) quote.user_rate = Number(quote.user_rate);
  if (quote.market_rate) quote.market_rate = Number(quote.market_rate);
  if (quote.rate_ugx) quote.rate_ugx = Number(quote.rate_ugx);
  if (quote.fee_ugx) quote.fee_ugx = Number(quote.fee_ugx);
  
  return quote;
}

/**
 * Map mobile_network enum to fiat currency.
 */
function networkToFiat(network) {
  const map = {
    MPESA_KE: 'KES',
    MTN_UG: 'UGX',
    AIRTEL_UG: 'UGX',
    MTN_TZ: 'TZS',
    AIRTEL_TZ: 'TZS',
  };
  return map[network] || 'UGX';
}

export default {
  getMarketMakerRate,
  getXlmRate,
  createQuote,
  getQuoteByMemo,
  networkToFiat,
  getUsdcToFiatRate,
};
