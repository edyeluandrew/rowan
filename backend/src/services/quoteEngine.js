import redis from '../db/redis.js';
import config from '../config/index.js';
import { server as horizon, USDC_ASSET, StellarSdk } from '../config/stellar.js';
import { nanoid } from 'nanoid';
import db from '../db/index.js';
import logger from '../utils/logger.js';
import fxService from './fxService.js';

// ── N7 FIX: Top-level Asset reference instead of dynamic import ──
const NativeAsset = StellarSdk.Asset.native();

// ── PHASE 1 (SPRINT): Slippage now centralized in config ──
// Do NOT hardcode slippage here — always read from config
// const QUOTE_SLIPPAGE_PERCENT = 0.3; ← MOVED TO config.platform.quoteSlippagePercent

/**
 * [PHASE 2] Discover actual executable XLM → USDC path using Horizon strict-receive.
 * 
 * Strategy:
 * 1. Use MARKET MAKER account as source (has XLM liquidity)
 * 2. Destination is ESCROW account (where USDC is received)
 * 3. This finds real paths through Stellar's DEX/orderbook
 * 
 * Returns: { path, xlmNeeded, usdcReceived, source: 'horizon-path' } or null if no path found.
 * This is the NEW source of truth for quote generation.
 */
async function getStrictReceivePath(usdcTarget, sourceAccount = null) {
  if (!usdcTarget || usdcTarget <= 0) {
    logger.warn('[QuoteEngine] Invalid USDC target:', usdcTarget);
    return null;
  }

  try {
    // ── CRITICAL: Use market maker as SOURCE for path discovery ──
    // Market maker holds XLM and can send real payment (not self-swap)
    // Escrow is DESTINATION where USDC is received
    logger.info(`[QuoteEngine] 🔄 Discovering strict-receive path: receive ${usdcTarget} USDC`);
    logger.info(`[QuoteEngine] 📍 Network: ${config.stellar.network}, Horizon: ${config.stellar.horizonUrl}`);

    // [PHASE 2D FIX] The actual escrow swap always PAYS native XLM, so discover the
    // XLM → USDC path using `source_assets=native`. Previously this used
    // `source_account=<MM/escrow>`, which (a) returned a trivial USDC→USDC path when
    // the account already held USDC and (b) required a specific funded source. Using
    // source_assets=native finds the real XLM→USDC route regardless of who executes it.
    const horizonUrl = config.stellar.horizonUrl;
    const pathUrl = `${horizonUrl}/paths/strict-receive?` +
      `source_assets=native&` +
      `destination_asset_type=credit_alphanum4&` +
      `destination_asset_code=${USDC_ASSET.code}&` +
      `destination_asset_issuer=${encodeURIComponent(USDC_ASSET.issuer)}&` +
      `destination_amount=${usdcTarget.toFixed(7)}`;
    logger.info(`[QuoteEngine] Path params: source=native XLM, USDC issuer=${USDC_ASSET.issuer.slice(0, 8)}..., amount=${usdcTarget}`);

    logger.debug(`[QuoteEngine] 🌐 Calling Horizon path endpoint...`);
    logger.debug(`[QuoteEngine]    URL: ${pathUrl}`);

    const response = await fetch(pathUrl, { timeout: 15000 });
    
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`[QuoteEngine] ❌ Horizon path API error: HTTP ${response.status}`, { 
        body: errorBody.substring(0, 300),
        status: response.status,
        network: config.stellar.network,
        usdcCode: USDC_ASSET.code,
      });
      return null;
    }

    const pathResponse = await response.json();

    // [PHASE 2D FIX] Horizon returns path results nested under `_embedded.records`,
    // NOT a top-level `records` array. The old code read `pathResponse.records`
    // (always undefined) so EVERY quote silently fell back to indicative rates.
    const allRecords = pathResponse._embedded?.records || pathResponse.records || [];
    // Only accept paths that actually start from native XLM (defensive — avoids any
    // trivial same-asset path) and pick the cheapest source amount.
    const nativeRecords = allRecords.filter((r) => r.source_asset_type === 'native');

    if (nativeRecords.length === 0) {
      logger.warn('[QuoteEngine] ⚠️  No XLM→USDC path returned from Horizon');
      logger.warn(`[QuoteEngine] 🔍 Debug info:`, {
        network: config.stellar.network,
        usdcCode: USDC_ASSET.code,
        usdcIssuer: USDC_ASSET.issuer.slice(0, 8) + '...',
        usdcTarget,
        recordCount: allRecords.length,
      });
      logger.info(`[QuoteEngine] Possible causes: 1) Insufficient orderbook depth, 2) No XLM→USDC liquidity (sell USDC / buy XLM offers), 3) Issuer mismatch on USDC asset`);
      return null;
    }

    // Pick the path with the smallest XLM source amount (best price for receiving USDC)
    const path = nativeRecords.reduce((best, cur) =>
      parseFloat(cur.source_amount) < parseFloat(best.source_amount) ? cur : best
    );
    
    // Extract source amount (XLM needed) and destination amount (USDC received)
    const xlmNeeded = parseFloat(path.source_amount);
    const usdcReceived = parseFloat(path.destination_amount);
    
    logger.info(`[QuoteEngine] ✅ Path found: send ${xlmNeeded} XLM → receive ${usdcReceived} USDC`);
    logger.info(`[QuoteEngine] Path details:`, {
      sourceAmount: xlmNeeded,
      destAmount: usdcReceived,
      pathLength: path.path ? path.path.length : 0,
      pathAssets: path.path ? path.path.map(a => `${a.asset_code || 'XLM'}/${a.asset_issuer || 'native'}`).join(' → ') : 'direct',
    });

    return {
      path: path.path || [],  // Array of intermediate assets (may be empty for direct swap)
      xlmNeeded,
      usdcReceived,
      source: 'horizon-path',
    };
  } catch (err) {
    logger.error('[QuoteEngine] ❌ Horizon path discovery failed:', { 
      message: err.message, 
      type: err.name,
      code: err.code 
    });
    if (err.message.includes('fetch') || err.message.includes('network')) {
      logger.error('[QuoteEngine] Network error — Horizon may be unreachable');
    }
    return null;
  }
}

/**
 * Fetch the best XLM→USDC rate from the market maker's active offers.
 * Queries Horizon for all offers from the market maker account, finds the best ask price.
 * Returns null if no offers available or if market maker not configured.
 * 
 * [DEPRECATED] Now used as fallback only. Strict-receive path is primary.
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
    logger.info(`[QuoteEngine] Market maker fallback rate: ${bestRate} USDC/XLM (offer ID: ${bestOffer.id})`);
    return bestRate;
  } catch (err) {
    logger.warn('[QuoteEngine] Failed to fetch market maker offers:', err.message);
    return null;
  }
}

const { quoteTtlSeconds, feePercent, spreadPercent, rateCacheTtlSeconds } = config.platform;

/**
 * [PHASE 2] Compute the XLM→USDC rate from a real strict-receive path.
 * This is the NEW source of truth for XLM pricing in quotes.
 * 
 * @param {number} usdcTarget - Target USDC amount needed (e.g., from fiat conversion)
 * @returns {object} { xlmRate: XLM/USDC, pathData: {...} } or null if path not found
 */
async function getXlmRateFromPath(usdcTarget) {
  try {
    const pathData = await getStrictReceivePath(usdcTarget);
    if (!pathData) {
      logger.warn('[QuoteEngine] No executable path found for USDC target:', usdcTarget);
      return null;
    }

    // Calculate the XLM/USDC rate from the path
    const xlmRate = pathData.xlmNeeded / pathData.usdcReceived;
    logger.info(`[QuoteEngine] ✅ Path-based rate: ${xlmRate} XLM/USDC (from path with ${pathData.xlmNeeded} XLM → ${pathData.usdcReceived} USDC)`);

    return {
      xlmRate,        // XLM per USDC
      pathData,       // Full path info for execution alignment
      source: 'horizon-path',
    };
  } catch (err) {
    logger.warn('[QuoteEngine] Path-based rate fetch failed:', err.message);
    return null;
  }
}

/**
 * [DEPRECATED - FALLBACK ONLY] Fetch the live XLM rate for a given fiat currency using legacy methods.
 * ONLY called if strict-receive path discovery fails.
 * Priority:
 * 1. Market Maker offers (if available and better/comparable)
 * 2. Stellar DEX (XLM → USDC → fiat estimate)
 * 3. Fallback: CoinGecko API
 * Cached in Redis for 30 seconds.
 */
async function getLegacyXlmRate(fiatCurrency = 'UGX') {
  const cacheKey = `rate:xlm:legacy:${fiatCurrency}`;
  const cached = await redis.get(cacheKey);
  if (cached) return parseFloat(cached);

  let rate;

  try {
    // Fallback 1: Market Maker offers
    const mmRate = await getMarketMakerRate();
    if (mmRate) {
      // Convert market maker rate (USDC/XLM) to fiat currency
      const usdcToFiat = await getUsdcToFiatRate(fiatCurrency);
      rate = mmRate * usdcToFiat;
      logger.info(`[QuoteEngine] [FALLBACK] Using market maker rate: ${mmRate} USDC/XLM → ${rate} ${fiatCurrency}/XLM`);
    }
  } catch (err) {
    logger.warn('[QuoteEngine] Market maker rate fetch failed:', err.message);
  }

  // Fallback to DEX if market maker unavailable
  if (!rate) {
    try {
      // Fallback 2: Stellar DEX — get XLM/USDC mid-market price
      const orderbook = await horizon
        .orderbook(NativeAsset, USDC_ASSET)
        .call();

      if (orderbook.asks.length > 0 && orderbook.bids.length > 0) {
        const bestAsk = parseFloat(orderbook.asks[0].price);
        const bestBid = parseFloat(orderbook.bids[0].price);
        const xlmUsdcMid = (bestAsk + bestBid) / 2; // XLM price in USDC

        // Convert USDC → fiat using static rates (later: live FX feed)
        const usdcToFiat = await getUsdcToFiatRate(fiatCurrency);
        rate = xlmUsdcMid * usdcToFiat;
        logger.info(`[QuoteEngine] [FALLBACK] Using DEX rate: ${xlmUsdcMid} USDC/XLM → ${rate} ${fiatCurrency}/XLM`);
      }
    } catch (err) {
      logger.warn('[QuoteEngine] Stellar DEX fetch failed, falling back to CoinGecko:', err.message);
    }
  }

  if (!rate) {
    // Fallback 3: CoinGecko
    try {
      const fiatLower = fiatCurrency.toLowerCase();
      const res = await fetch(
        `${config.coingeckoApiUrl}/simple/price?ids=stellar&vs_currencies=${fiatLower}`
      );
      const data = await res.json();
      rate = data?.stellar?.[fiatLower];
      logger.info(`[QuoteEngine] [FALLBACK] Using CoinGecko rate: ${rate} ${fiatCurrency}/XLM`);
    } catch (err) {
      logger.error('[QuoteEngine] CoinGecko fallback also failed:', err.message);
    }
  }

  // Ultimate fallback: Hardcoded XLM rate for testnet/development with no liquidity
  if (!rate) {
    // 1 XLM ≈ $0.27 (historical average) — apply fiat multiplier from config
    const xlmBaseUsdRate = 0.27;
    const usdcToLocalFiat = config.usdcFiatRates[fiatCurrency];
    
    if (usdcToLocalFiat) {
      rate = xlmBaseUsdRate * usdcToLocalFiat;
      logger.warn(`[QuoteEngine] ⚠️  ULTIMATE FALLBACK: Using hardcoded XLM rate ${rate} ${fiatCurrency}/XLM — network has no available liquidity`);
    } else {
      throw new Error('Unable to fetch XLM rate from any source and fiat currency not configured');
    }
  }

  if (!rate || rate <= 0) throw new Error('Invalid XLM rate fetched');

  // [AUDIT FIX] Cache TTL from config instead of hardcoded 30
  await redis.set(cacheKey, rate.toString(), 'EX', rateCacheTtlSeconds);
  return rate;
}

/** USDC → fiat rate — delegates to fxService (live provider + STATIC fallback). */
async function getUsdcToFiatRate(fiatCurrency) {
  return fxService.getUsdcToFiatRate(fiatCurrency);
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
 * Compute quote amounts for a given XLM input (no DB write).
 * Used by createQuote and fiat-target binary search.
 */
async function computeQuoteFromXlm(xlmAmount, network) {
  logger.info(`[QuoteEngine] Computing quote: xlmAmount=${xlmAmount}, network=${network}`);

  const fiatCurrency = networkToFiat(network);
  const fiatFx = await fxService.assertFiatFxAvailableForQuote(fiatCurrency);
  const usdcToFiat = fiatFx.rate;

  // ── Step 1: Estimate USDC needed based on user's XLM ──
  // First, get a rough rate to understand ordering of magnitude
  let estimatedSpread = 3.0; // Default XLM/USDC rate (can be ~1-5)
  try {
    const legacyRate = await getLegacyXlmRate(fiatCurrency);
    estimatedSpread = legacyRate / usdcToFiat; // Rough XLM/USDC estimate
      logger.info(`[QuoteEngine] Legacy rate estimate: ${estimatedSpread} USDC/XLM (from market rates)`);
    } catch (err) {
      // Use default if market rates unavailable
      logger.warn('[QuoteEngine] Market rate fetch failed, using default XLM/USDC estimate of ~3.0');
  }

  // ── Step 2: Calculate USDC target needed ──
  const spreadMultiplier = 1 - (spreadPercent / 100);
  let estimatedUsdcTarget = xlmAmount * estimatedSpread; // Rough estimate
  const grossFiatEstimate = estimatedUsdcTarget * usdcToFiat;
  const platformFee = grossFiatEstimate * (feePercent / 100);
  
  // Adjust USDC target to account for fee
  const totalFiatNeeded = grossFiatEstimate / spreadMultiplier; // Undo spread to get gross
  const usdcTargetForPath = totalFiatNeeded / usdcToFiat;
  
  logger.info(`[QuoteEngine]📊 Planning path discovery: estimatedUsdcTarget=${estimatedUsdcTarget}, usdcTargetForPath=${usdcTargetForPath}`);

  const { xlmRate, pathData, rateSource, quoteWarning } = await discoverPathForUsdcTarget(
    usdcTargetForPath,
    fiatCurrency,
    xlmAmount
  );

  // ── Step 4: Apply configured SLIPPAGE TOLERANCE (PHASE 1 SPRINT) ──
  // [PHASE 1] Use slippage from config, not hardcoded constant
  const slippageMultiplier = 1 + (config.platform.quoteSlippagePercent / 100);
  const xlmWithSlippage = pathData.xlmNeeded * slippageMultiplier;
  
  logger.info(`[QuoteEngine] 📐 Slippage calculation: xlmNeeded=${pathData.xlmNeeded}, slippage=${config.platform.quoteSlippagePercent}%, xlmWithSlippage=${xlmWithSlippage}`);

  // ── Step 5: Derive fiat from path USDC (trader settlement amount) ──
  const actualUsdcReceived = pathData.usdcReceived;
  const spreadMultiplierUser = 1 - (spreadPercent / 100);
  const fiatPerXlm = (actualUsdcReceived / pathData.xlmNeeded) * usdcToFiat;
  const userRateAfterSpread = fiatPerXlm * spreadMultiplierUser;
  const grossFiatActual = actualUsdcReceived * usdcToFiat * spreadMultiplierUser;
  const platformFeeActual = grossFiatActual * (feePercent / 100);
  const fiatAmountActual = grossFiatActual - platformFeeActual;

  logger.info(`[QuoteEngine]💰 Fiat breakdown:`);
  logger.info(`  - USDC for trader (from path): ${actualUsdcReceived}`);
  logger.info(`  - Gross fiat (after spread): ${grossFiatActual}`);
  logger.info(`  - Platform fee: ${platformFeeActual}`);
  logger.info(`  - Net fiat to user: ${fiatAmountActual}`);

  // ── Normalize amounts ──
  const usdcToUgx = config.usdcFiatRates.UGX;
  const xlmToUsdc = pathData.xlmNeeded / pathData.usdcReceived;
  const rateUgx = Math.round(xlmToUsdc * usdcToUgx);
  const feeUgx = Math.round(fiatToUgxRate(platformFeeActual, fiatCurrency));

  const fiatAmountNum = parseFloat(fiatAmountActual.toFixed(2));
  const platformFeeNum = parseFloat(platformFeeActual.toFixed(2));

  logger.info(`[QuoteEngine] ✅ Amount validation: fiatAmount=${fiatAmountNum}, platformFee=${platformFeeNum}`);

  if (!Number.isFinite(fiatAmountNum) || !Number.isFinite(platformFeeNum)) {
    throw new Error(`Invalid amounts calculated: fiatAmount=${fiatAmountActual}, platformFee=${platformFeeActual}`);
  }

  // [CORRECTNESS] quote_source MUST reflect reality. If pathData was synthesised
  // from the legacy fallback (no Horizon path), stamp it 'legacy-fallback' so the
  // escrow swap layer refuses to execute against it. Only quotes backed by a real
  // Horizon-discovered path are marked 'horizon-path' and therefore executable.
  const quoteSource = pathData.source === 'horizon-path' ? 'horizon-path' : 'legacy-fallback';

  return {
    fiatCurrency,
    fiatFx,
    xlmRate,
    pathData,
    rateSource,
    quoteWarning,
    userRateAfterSpread,
    fiatAmountNum,
    platformFeeNum,
    rateUgx,
    feeUgx,
    quoteSource,
    xlmWithSlippage,
    grossFiatActual,
  };
}

async function persistQuote({
  userId,
  xlmAmount,
  network,
  phoneHash,
  payoutPhone,
  payoutName,
  computed,
  requestedNetFiat = null,
  preferredPayoutSettingId = null,
}) {
  const {
    fiatCurrency,
    fiatFx,
    xlmRate,
    pathData,
    rateSource,
    quoteWarning,
    userRateAfterSpread,
    fiatAmountNum,
    platformFeeNum,
    rateUgx,
    feeUgx,
    quoteSource,
  } = computed;

  const memo = `ROWAN-qt_${nanoid(8)}`;
  const expiresAt = new Date(Date.now() + quoteTtlSeconds * 1000);

  const result = await db.query(
    `INSERT INTO quotes
       (user_id, xlm_amount, fiat_currency, market_rate, user_rate, fiat_amount,
        platform_fee, network, phone_hash, memo, escrow_address, expires_at,
        rate_ugx, fee_ugx, status, path_xlm_needed, path_usdc_received, quote_source,
        payout_phone, payout_name, rate_source, quote_warning,
        fx_source, fx_rate, fx_currency, fx_warning, fiat_rate_source,
        fx_provider, fx_fetched_at, fx_age_seconds, preferred_payout_setting_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDING',$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
     RETURNING *`,
    [
      userId, xlmAmount, fiatCurrency, 
      xlmRate,              // market_rate = XLM/USDC from path
      userRateAfterSpread,  // user_rate = fiat rate after spread
      fiatAmountNum, platformFeeNum,
      network, phoneHash, memo,
      config.stellar.escrowPublicKey, expiresAt,
      rateUgx, feeUgx,
      pathData.xlmNeeded,        // path_xlm_needed (for execution)
      pathData.usdcReceived,     // path_usdc_received (for execution)
      quoteSource,                // 'horizon-path' (executable) | 'legacy-fallback' (non-executable)
      payoutPhone,               // payout_phone (full phone for trader)
      payoutName,                // payout_name (recipient name)
      rateSource,                 // [PHASE 2C] LIVE | FALLBACK
      quoteWarning,               // [PHASE 2C] indicative-rate warning (or null)
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

  // Also cache in Redis for fast lookup by memo
  await redis.set(`quote:${memo}`, JSON.stringify(quote), 'EX', quoteTtlSeconds);

  logger.info(
    `[QuoteEngine] ✨ Quote created: ${quote.id} (memo: ${memo}` +
    `${requestedNetFiat != null ? `, requestedFiat=${requestedNetFiat}, net=${fiatAmountNum}` : ''})`
  );

  return quote;
}

/**
 * Create a locked quote from a user-specified XLM amount.
 */
async function createQuote({ userId, xlmAmount, network, phoneHash, payoutPhone, payoutName, payoutSettingId = null }) {
  const computed = await computeQuoteFromXlm(xlmAmount, network);
  let preferredPayoutSettingId = null;
  if (payoutSettingId) {
    const traderAdsService = (await import('./traderAdsService.js')).default;
    await traderAdsService.validateAdForQuote(payoutSettingId, {
      network,
      currency: computed.fiatCurrency,
      fiatAmount: computed.fiatAmountNum,
      userId,
    });
    preferredPayoutSettingId = payoutSettingId;
  }
  return persistQuote({
    userId,
    xlmAmount,
    network,
    phoneHash,
    payoutPhone,
    payoutName,
    computed,
    preferredPayoutSettingId,
  });
}

function normalizeLockedFiatAmount(amount, fiatCurrency) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid fiat amount: ${amount}`);
  if (fiatCurrency === 'KES') return parseFloat(n.toFixed(2));
  return Math.round(n);
}

/**
 * Discover XLM→USDC path for a USDC target (trader receives this USDC from escrow).
 */
async function discoverPathForUsdcTarget(usdcTargetForPath, fiatCurrency, capReferenceXlm) {
  let pathResult = await getXlmRateFromPath(usdcTargetForPath);

  if (!pathResult) {
    logger.warn('[QuoteEngine] ⚠️  No valid path returned from Horizon — trying legacy fallback');
    try {
      const legacyRate = await getLegacyXlmRate(fiatCurrency);
      const usdcToFiat = (await fxService.assertFiatFxAvailableForQuote(fiatCurrency)).rate;
      const xlmToUsdcRate = legacyRate / usdcToFiat;
      const simulatedXlmNeeded = usdcTargetForPath / xlmToUsdcRate;
      pathResult = {
        xlmRate: xlmToUsdcRate,
        pathData: {
          xlmNeeded: simulatedXlmNeeded,
          usdcReceived: usdcTargetForPath,
          path: [],
          source: 'legacy-fallback',
        },
        source: 'legacy-fallback',
      };
    } catch (fallbackErr) {
      logger.error('[QuoteEngine] ❌ Legacy rate fallback failed:', fallbackErr.message);
      throw new Error('Unable to generate quote: Path discovery failed and no legacy rate available.');
    }
  }

  const { xlmRate, pathData } = pathResult;
  const rateSource = pathData.source === 'horizon-path' ? 'LIVE' : 'FALLBACK';
  let quoteWarning = null;
  if (rateSource === 'FALLBACK') {
    quoteWarning = 'Rate is indicative (live market liquidity was unavailable at quote time).';
    const refXlm = capReferenceXlm ?? pathData.xlmNeeded;
    if (config.stellar.isMainnet && !config.platform.allowFallbackQuotes) {
      const err = new Error('Quote temporarily unavailable: live market liquidity is required for cash-out right now. Please try again shortly.');
      err.statusCode = 503;
      err.code = 'QUOTE_UNAVAILABLE';
      throw err;
    }
    if (config.platform.allowFallbackQuotes && refXlm > config.platform.fallbackMaxXlm) {
      const err = new Error(`Quote temporarily unavailable for this amount: live liquidity is required for cash-outs above ${config.platform.fallbackMaxXlm} XLM. Please try a smaller amount or try again shortly.`);
      err.statusCode = 503;
      err.code = 'QUOTE_UNAVAILABLE_FALLBACK_CAP';
      throw err;
    }
  }

  return { xlmRate, pathData, rateSource, quoteWarning };
}

/**
 * Fiat-anchored quote: user specifies exact MoMo payout; solve XLM send + USDC for trader.
 * fiat_amount on the quote = exactly what the user entered (net UGX/KES/TZS).
 * path_usdc_received = USDC escrow swaps to and releases to the trader.
 */
async function computeQuoteFromTargetFiat(targetNetFiat, network) {
  const fiatCurrency = networkToFiat(network);
  const fiatFx = await fxService.assertFiatFxAvailableForQuote(fiatCurrency);
  const usdcToFiat = fiatFx.rate;
  const fiatAmountNum = normalizeLockedFiatAmount(targetNetFiat, fiatCurrency);

  const spreadMultiplierUser = 1 - (spreadPercent / 100);
  const feeMultiplier = 1 - (feePercent / 100);
  const grossFiatBeforeSpread = fiatAmountNum / (feeMultiplier * spreadMultiplierUser);
  const usdcTargetForPath = grossFiatBeforeSpread / usdcToFiat;

  logger.info(
    `[QuoteEngine] Fiat-anchored quote: netFiat=${fiatAmountNum} ${fiatCurrency}, ` +
    `usdcTarget=${usdcTargetForPath}`
  );

  const { xlmRate, pathData, rateSource, quoteWarning } = await discoverPathForUsdcTarget(
    usdcTargetForPath,
    fiatCurrency,
    null
  );

  const slippageMultiplier = 1 + (config.platform.quoteSlippagePercent / 100);
  const xlmWithSlippage = pathData.xlmNeeded * slippageMultiplier;
  const actualUsdcReceived = pathData.usdcReceived;
  const fiatPerXlm = (actualUsdcReceived / pathData.xlmNeeded) * usdcToFiat;
  const userRateAfterSpread = fiatPerXlm * spreadMultiplierUser;
  const grossFiatActual = actualUsdcReceived * usdcToFiat * spreadMultiplierUser;
  const platformFeeNum = parseFloat(Math.max(0, grossFiatActual - fiatAmountNum).toFixed(2));

  const usdcToUgx = config.usdcFiatRates.UGX;
  const xlmToUsdc = pathData.xlmNeeded / pathData.usdcReceived;
  const rateUgx = Math.round(xlmToUsdc * usdcToUgx);
  const feeUgx = Math.round(fiatToUgxRate(platformFeeNum, fiatCurrency));
  const quoteSource = pathData.source === 'horizon-path' ? 'horizon-path' : 'legacy-fallback';

  logger.info(`[QuoteEngine] ✅ Fiat-anchored: send ${xlmWithSlippage} XLM → ${actualUsdcReceived} USDC → ${fiatAmountNum} ${fiatCurrency} MoMo`);

  return {
    fiatCurrency,
    fiatFx,
    xlmRate,
    pathData,
    rateSource,
    quoteWarning,
    userRateAfterSpread,
    fiatAmountNum,
    platformFeeNum,
    rateUgx,
    feeUgx,
    quoteSource,
    xlmWithSlippage,
    grossFiatActual,
  };
}

/**
 * Create a locked quote from a target net fiat amount (mobile-money payout).
 * The quoted fiat_amount matches the user's input; XLM and USDC are derived from the path.
 */
async function createQuoteFromFiat({
  userId,
  targetNetFiat,
  network,
  phoneHash,
  payoutPhone,
  payoutName,
  payoutSettingId = null,
}) {
  const computed = await computeQuoteFromTargetFiat(targetNetFiat, network);
  const xlmAmount = Math.ceil(computed.xlmWithSlippage * 1e7) / 1e7;

  if (xlmAmount < config.platform.minXlmAmount) {
    const fiatCurrency = networkToFiat(network);
    const err = new Error(`Amount too small. Minimum cash-out is ${config.platform.minXlmAmount} XLM equivalent.`);
    err.statusCode = 400;
    err.code = 'AMOUNT_BELOW_MIN';
    throw err;
  }

  let preferredPayoutSettingId = null;
  if (payoutSettingId) {
    const traderAdsService = (await import('./traderAdsService.js')).default;
    await traderAdsService.validateAdForQuote(payoutSettingId, {
      network,
      currency: computed.fiatCurrency,
      fiatAmount: computed.fiatAmountNum,
      userId,
    });
    preferredPayoutSettingId = payoutSettingId;
  }

  return persistQuote({
    userId,
    xlmAmount,
    network,
    phoneHash,
    payoutPhone,
    payoutName,
    computed,
    requestedNetFiat: computed.fiatAmountNum,
    preferredPayoutSettingId,
  });
}

/**
 * [PHASE 5] Look up a cached quote by its memo string.
 * Ensures all numeric fields are properly converted from potential strings.
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
    if (quote.path_xlm_needed) quote.path_xlm_needed = Number(quote.path_xlm_needed);
    if (quote.path_usdc_received) quote.path_usdc_received = Number(quote.path_usdc_received);
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
  if (quote.path_xlm_needed) quote.path_xlm_needed = Number(quote.path_xlm_needed);
  if (quote.path_usdc_received) quote.path_usdc_received = Number(quote.path_usdc_received);
  
  logger.info(`[QuoteEngine] Retrieved quote from DB: ${quote.id} (source: ${quote.quote_source})`);
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
  getStrictReceivePath,
  getXlmRateFromPath,
  getMarketMakerRate,
  getLegacyXlmRate,
  createQuote,
  createQuoteFromFiat,
  computeQuoteFromXlm,
  computeQuoteFromTargetFiat,
  getQuoteByMemo,
  networkToFiat,
  getUsdcToFiatRate,
};
