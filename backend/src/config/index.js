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
    quoteTtlSeconds: parseInt(process.env.QUOTE_TTL_SECONDS, 10) || 180,
    traderAcceptTimeoutSeconds: parseInt(process.env.TRADER_ACCEPT_TIMEOUT_SECONDS, 10) || 180,
    traderConfirmTimeoutSeconds: parseInt(process.env.TRADER_CONFIRM_TIMEOUT_SECONDS, 10) || 300,
    rateCacheTtlSeconds: parseInt(process.env.RATE_CACHE_TTL_SECONDS, 10) || 30,
    minXlmAmount: parseFloat(process.env.MIN_XLM_AMOUNT) || 2,
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
