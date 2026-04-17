import redis from '../db/redis.js';
import config from '../config/index.js';
import { server as horizon, USDC_ASSET, StellarSdk } from '../config/stellar.js';
import { nanoid } from 'nanoid';
import db from '../db/index.js';
import logger from '../utils/logger.js';

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
    const sourceAddr = sourceAccount || config.stellar.marketMakerPublicKey || config.stellar.escrowPublicKey;
    const destAddr = config.stellar.escrowPublicKey;
    
    logger.info(`[QuoteEngine] 🔄 Discovering strict-receive path: receive ${usdcTarget} USDC`);
    logger.info(`[QuoteEngine] 📍 Network: ${config.stellar.network}, Horizon: ${config.stellar.horizonUrl}`);
    
    if (!sourceAddr || !destAddr) {
      logger.error('[QuoteEngine] ❌ Missing addresses: source or escrow not configured');
      return null;
    }
    
    logger.info(`[QuoteEngine] Path approach: ${sourceAccount ? 'custom' : config.stellar.marketMakerPublicKey ? 'market-maker' : 'escrow'} account`);
    logger.info(`[QuoteEngine] Path params: source=${sourceAddr.slice(0, 8)}..., dest=${destAddr.slice(0, 8)}..., USDC issuer=${USDC_ASSET.issuer.slice(0, 8)}..., amount=${usdcTarget}`);

    // [FIX] Use Horizon REST API directly for path discovery
    // The Stellar SDK v12 Server object doesn't expose .paths() method
    // Instead, we construct the URL and call the endpoint directly
    const horizonUrl = config.stellar.horizonUrl;
    const pathUrl = `${horizonUrl}/paths/strict-receive?` +
      `source_account=${encodeURIComponent(sourceAddr)}&` +
      `destination_account=${encodeURIComponent(destAddr)}&` +
      `destination_asset_type=credit_alphanum4&` +
      `destination_asset_code=${USDC_ASSET.code}&` +
      `destination_asset_issuer=${encodeURIComponent(USDC_ASSET.issuer)}&` +
      `destination_amount=${usdcTarget.toFixed(7)}`;

    logger.debug(`[QuoteEngine] 🌐 Calling Horizon path endpoint...`);

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

    if (!pathResponse.records || pathResponse.records.length === 0) {
      logger.warn('[QuoteEngine] ⚠️  No valid path found for strict-receive (empty records)');
      logger.warn(`[QuoteEngine] 🔍 Debug info:`, {
        network: config.stellar.network,
        source: sourceAddr.slice(0, 8) + '...',
        dest: destAddr.slice(0, 8) + '...',
        usdcCode: USDC_ASSET.code,
        usdcIssuer: USDC_ASSET.issuer.slice(0, 8) + '...',
        usdcTarget,
        recordCount: pathResponse.records ? pathResponse.records.length : 'undefined',
      });
      logger.info(`[QuoteEngine] Possible causes: 1) No liquidity, 2) Market maker offline, 3) Wrong USDC issuer, 4) Accounts not funded`);
      return null;
    }

    // Take the first (best) path
    const path = pathResponse.records[0];
    
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
      const usdcToFiat = getUsdcToFiatRate(fiatCurrency);
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
        const usdcToFiat = getUsdcToFiatRate(fiatCurrency);
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
 * [PHASE 2] Create a locked quote using REAL EXECUTABLE STELLAR PATHS.
 * 
 * NEW FLOW:
 * 1. User specifies XLM amount
 * 2. Calculate fiat equivalent using legacy estimates (for display)
 * 3. Convert fiat back to USDC target (what swap must achieve)
 * 4. Discover actual XLM→USDC path (strict-receive) — THIS IS THE TRUTH
 * 5. Apply 0.3% slippage tolerance to XLM amount
 * 6. Calculate actual user-facing fiat based on REAL path
 * 7. Store path data in quote for execution alignment
 * 
 * Returns the quote object with a 60-second TTL.
 */
async function createQuote({ userId, xlmAmount, network, phoneHash }) {
  logger.info(`[QuoteEngine] 🔄 Creating quote: xlmAmount=${xlmAmount}, network=${network}`);

  const fiatCurrency = networkToFiat(network);
  const usdcToFiat = getUsdcToFiatRate(fiatCurrency);

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

  // ── Step 3: DISCOVER ACTUAL EXECUTABLE PATH ──
  // Attempt to use market maker's configured liquidity via Horizon path discovery
  // This requires active offers in the market maker account (set up in Stellar Lab)
  let pathResult = await getXlmRateFromPath(usdcTargetForPath);
  
  if (!pathResult) {
    logger.warn('[QuoteEngine] ⚠️  Path discovery failed (market maker has no active offers)');
    logger.warn('[QuoteEngine] 💡 To enable path discovery:');
    logger.warn('[QuoteEngine]    1. Go to https://laboratory.stellar.org/');
    logger.warn('[QuoteEngine]    2. Create an offer: Sell XLM → Buy USDC');
    logger.warn('[QuoteEngine]    3. Set price to match your configured rates');
    logger.info('[QuoteEngine] 📌 Falling back to direct rate calculation (from config)...');
    
    // FALLBACK: Calculate quote using configured rates directly
    // This is acceptable for controlled trading environments where rates are stable
    try {
      const legacyRate = await getLegacyXlmRate(fiatCurrency); // XLM/fiat rate
      const xlmToUsdcRate = legacyRate / usdcToFiat; // Convert to XLM/USDC
      
      // Use direct rate calculation
      const simulatedUsdcNeeded = usdcTargetForPath;
      const simulatedXlmNeeded = simulatedUsdcNeeded * xlmToUsdcRate;
      
      pathResult = {
        xlmRate: xlmToUsdcRate,
        pathData: {
          xlmNeeded: simulatedXlmNeeded,
          usdcReceived: simulatedUsdcNeeded,
          path: [],
          source: 'legacy-fallback',
        },
        source: 'legacy-fallback',
      };
      
      logger.warn('[QuoteEngine] ⚠️  Using FALLBACK legacy rate: ' + xlmToUsdcRate + ' XLM/USDC');
      logger.warn('[QuoteEngine] ⚠️  Quotes may be less accurate than usual. Please restore Horizon path discovery.');
    } catch (fallbackErr) {
      logger.error('[QuoteEngine] ❌ Legacy rate fallback also failed:', fallbackErr.message);
      throw new Error('Unable to generate quote: Path discovery failed and no legacy rate available. Please ensure escrow account is properly configured with USDC trustline.');
    }
  }

  const { xlmRate, pathData } = pathResult;
  
  // ── Step 4: Apply configured SLIPPAGE TOLERANCE (PHASE 1 SPRINT) ──
  // [PHASE 1] Use slippage from config, not hardcoded constant
  const slippageMultiplier = 1 + (config.platform.quoteSlippagePercent / 100);
  const xlmWithSlippage = pathData.xlmNeeded * slippageMultiplier;
  
  logger.info(`[QuoteEngine] 📐 Slippage calculation: xlmNeeded=${pathData.xlmNeeded}, slippage=${config.platform.quoteSlippagePercent}%, xlmWithSlippage=${xlmWithSlippage}`);

  // ── Step 5: Derive actual fiat from REAL path ──
  const actualUsdcReceived = pathData.usdcReceived;
  const userRate = actualUsdcReceived * usdcToFiat; // XLM → fiat rate (before spread)
  
  // Apply spread to user-facing rate
  const spreadMultiplierUser = 1 - (spreadPercent / 100);
  const userRateAfterSpread = userRate * spreadMultiplierUser;
  
  // Calculate user's actual fiat
  const grossFiatActual = pathData.xlmNeeded * userRateAfterSpread;
  const platformFeeActual = grossFiatActual * (feePercent / 100);
  const fiatAmountActual = grossFiatActual - platformFeeActual;
  
  logger.info(`[QuoteEngine]💰 Fiat breakdown:`);
  logger.info(`  - USDC received (from path): ${actualUsdcReceived}`);
  logger.info(`  - Gross fiat (before spread): ${grossFiatActual}`);
  logger.info(`  - Platform fee: ${platformFeeActual}`);
  logger.info(`  - Net fiat to user: ${fiatAmountActual}`);

  // ── Step 6: Build memo and expiry ──
  const memo = `ROWAN-qt_${nanoid(8)}`;
  const expiresAt = new Date(Date.now() + quoteTtlSeconds * 1000);

  // ── Step 7: Normalize amounts for DB ──
  const usdcToUgx = config.usdcFiatRates.UGX;
  const xlmToUsdc = pathData.xlmNeeded / pathData.usdcReceived; // Actual rate from path
  const rateUgx = Math.round(xlmToUsdc * usdcToUgx); // XLM price in UGX
  const feeUgx = Math.round(fiatToUgxRate(platformFeeActual, fiatCurrency));

  // ── Step 8: Ensure numeric values ──
  const fiatAmountNum = parseFloat(fiatAmountActual.toFixed(2));
  const platformFeeNum = parseFloat(platformFeeActual.toFixed(2));
  
  logger.info(`[QuoteEngine] ✅ Amount validation: fiatAmount=${fiatAmountNum}, platformFee=${platformFeeNum}`);
  
  if (!Number.isFinite(fiatAmountNum) || !Number.isFinite(platformFeeNum)) {
    throw new Error(`Invalid amounts calculated: fiatAmount=${fiatAmountActual}, platformFee=${platformFeeActual}`);
  }

  // ── Step 9: PERSIST TO DB with path data (PHASE 5) ──
  const result = await db.query(
    `INSERT INTO quotes
       (user_id, xlm_amount, fiat_currency, market_rate, user_rate, fiat_amount,
        platform_fee, network, phone_hash, memo, escrow_address, expires_at,
        rate_ugx, fee_ugx, status, path_xlm_needed, path_usdc_received, quote_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDING',$15,$16,'horizon-path')
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
    ]
  );

  const quote = result.rows[0];

  // Also cache in Redis for fast lookup by memo
  await redis.set(`quote:${memo}`, JSON.stringify(quote), 'EX', quoteTtlSeconds);

  logger.info(`[QuoteEngine] ✨ Quote created: ${quote.id} (memo: ${memo})`);

  return quote;
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
  getQuoteByMemo,
  networkToFiat,
  getUsdcToFiatRate,
};
