import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL,

  // Stellar
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
    escrowPublicKey: process.env.ESCROW_PUBLIC_KEY,
    escrowSecretKey: process.env.ESCROW_SECRET_KEY,
    marketMakerPublicKey: process.env.MARKET_MAKER_PUBLIC_KEY,
    marketMakerSecretKey: process.env.MARKET_MAKER_SECRET_KEY,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Encryption (AES-256-GCM for PII like ID document numbers)
  encryptionKey: process.env.ENCRYPTION_KEY,

  // Platform
  platform: {
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 1,
    spreadPercent: parseFloat(process.env.PLATFORM_SPREAD_PERCENT) || 1.25,
    maxSlippagePercent: parseFloat(process.env.MAX_SLIPPAGE_PERCENT) || 5,
    quoteTtlSeconds: parseInt(process.env.QUOTE_TTL_SECONDS, 10) || 60,
    traderAcceptTimeoutSeconds: parseInt(process.env.TRADER_ACCEPT_TIMEOUT_SECONDS, 10) || 180,
    traderConfirmTimeoutSeconds: parseInt(process.env.TRADER_CONFIRM_TIMEOUT_SECONDS, 10) || 300,
    rateCacheTtlSeconds: parseInt(process.env.RATE_CACHE_TTL_SECONDS, 10) || 30,
    minXlmAmount: parseFloat(process.env.MIN_XLM_AMOUNT) || 1,
    // [PHASE 4] Amount mismatch tolerance (in XLM) for deposit verification
    xlmAmountMismatchTolerance: parseFloat(process.env.XLM_AMOUNT_MISMATCH_TOLERANCE) || 0.01,
    // [PHASE 1] Unified slippage tolerance (quote + execution use same value)
    quoteSlippagePercent: parseFloat(process.env.QUOTE_SLIPPAGE_PERCENT) || 0.3,
    // [PHASE 4] Redis lock TTLs for distributed lock protection
    redisLockTtlDepositSeconds: parseInt(process.env.REDIS_LOCK_DEPOSIT_TTL_SECONDS, 10) || 120,
    redisLockTtlReleaseSeconds: parseInt(process.env.REDIS_LOCK_RELEASE_TTL_SECONDS, 10) || 60,
    redisLockTtlMatchSeconds: parseInt(process.env.REDIS_LOCK_MATCH_TTL_SECONDS, 10) || 30,
    // [PHASE 4] Additional Redis TTLs for data mappings
    redisQuoteTxMapTtlSeconds: parseInt(process.env.REDIS_QUOTE_TX_MAP_TTL_SECONDS, 10) || 86400, // 24 hours
    // [PHASE 4] Additional operational timeouts
    redisLockCleanupDelayMs: parseInt(process.env.REDIS_LOCK_CLEANUP_DELAY_MS, 10) || 5000,
    orphanFiatSentMinutes: parseInt(process.env.ORPHAN_FIAT_SENT_MINUTES, 10) || 60,
    orphanMatchedMinutes: parseInt(process.env.ORPHAN_MATCHED_MINUTES, 10) || 30,
  },

  // USDC issuers (Stellar)
  usdcIssuerTestnet: process.env.USDC_ISSUER_TESTNET || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  usdcIssuerMainnet: process.env.USDC_ISSUER_MAINNET || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',

  // Stellar transaction fees (in stroops; 0 = use BASE_FEE)
  stellarMaxFee: process.env.STELLAR_MAX_FEE || '10000',

  // USDC/fiat indicative rates (override via env for live FX feed)
  usdcFiatRates: {
    UGX: parseFloat(process.env.USDC_RATE_UGX) || 3750,
    KES: parseFloat(process.env.USDC_RATE_KES) || 153,
    TZS: parseFloat(process.env.USDC_RATE_TZS) || 2650,
  },

  // CORS
  // CORS_ORIGIN is validated at startup (required env var) — no wildcard fallback
  corsOrigin: process.env.CORS_ORIGIN,

  // Rate limiting
  globalRateLimitMax: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX, 10) || 100,
  authRateLimitMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 20,

  // CoinGecko
  coingeckoApiUrl: process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3',

  // Supabase (Storage — private bucket for trader documents)
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // Africa's Talking (SMS OTP delivery)
  africasTalking: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || 'sandbox',
    senderId: process.env.AT_SENDER_ID || '',
  },

  // SMS fallback for critical notifications (L-2)
  enableSmsFallback: process.env.ENABLE_SMS_FALLBACK === 'true',

  // [PHASE 4] KYC-tiered fraud limits (per-transaction and daily, in UGX)
  kycLimits: {
    NONE: {
      perTx: parseInt(process.env.KYC_LIMIT_NONE_PER_TX) || 200000,      // ~$53
      daily: parseInt(process.env.KYC_LIMIT_NONE_DAILY) || 500000,       // ~$133
    },
    BASIC: {
      perTx: parseInt(process.env.KYC_LIMIT_BASIC_PER_TX) || 1000000,    // ~$267
      daily: parseInt(process.env.KYC_LIMIT_BASIC_DAILY) || 3000000,     // ~$800
    },
    VERIFIED: {
      perTx: parseInt(process.env.KYC_LIMIT_VERIFIED_PER_TX) || 5000000,  // ~$1,333
      daily: parseInt(process.env.KYC_LIMIT_VERIFIED_DAILY) || 15000000,  // ~$4,000
    },
  },

  // [PHASE 4] Fraud monitoring thresholds
  fraud: {
    // Concurrent open quotes threshold before blocking
    maxConcurrentQuotes: parseInt(process.env.FRAUD_MAX_CONCURRENT_QUOTES) || 3,
    // Percentage of per-tx limit that triggers "large transaction" alert (0.8 = 80%)
    largeTransactionAlertThreshold: parseFloat(process.env.FRAUD_LARGE_TX_ALERT_THRESHOLD) || 0.8,
    // Trader auto-pause threshold: failed transactions in 24h
    traderFailureThreshold: parseInt(process.env.FRAUD_TRADER_FAILURE_THRESHOLD) || 5,
    // Trader auto-suspend threshold: open disputes
    traderDisputeThreshold: parseInt(process.env.FRAUD_TRADER_DISPUTE_THRESHOLD) || 3,
  },

  // Trader Verification
  traderVerification: {
    minP2pTrades: parseInt(process.env.TRADER_MIN_P2P_TRADES, 10) || 100,
    minCompletionRate: parseFloat(process.env.TRADER_MIN_COMPLETION_RATE) || 95,
    otpTtlSeconds: parseInt(process.env.TRADER_OTP_TTL_SECONDS, 10) || 600,
    docUrlExpirySeconds: parseInt(process.env.TRADER_DOC_URL_EXPIRY_SECONDS, 10) || 900,
    agreementVersion: process.env.TRADER_AGREEMENT_VERSION || 'v1.0',
    documentBucket: process.env.TRADER_DOC_BUCKET || 'trader-documents',
  },
};

export default config;
