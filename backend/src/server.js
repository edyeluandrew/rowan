import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import StellarSdk from '@stellar/stellar-sdk';
import config from './config/index.js';
import { USDC_ASSET } from './config/stellar.js';
import db from './db/index.js';
import redis from './db/redis.js';
import { errorHandler } from './middleware/validate.js';

// Routes
import authRoutes from './routes/auth.js';
import cashoutRoutes from './routes/cashout.js';
import traderRoutes from './routes/trader.js';
import traderOnboardingRoutes from './routes/traderOnboarding.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import ratesRoutes from './routes/rates.js';

// Services
import websocket from './services/websocket.js';
import horizonWatcher from './services/horizonWatcher.js';
import './services/jobQueue.js'; // self-initializing (registers cron jobs)
import logger from './utils/logger.js';

const app = express();
const httpServer = createServer(app);

// express-rate-limit and req.ip read the real client IP from the X-Forwarded-For
// header when the server runs behind Railway, Render, or Cloudflare. Without this
// line all rate limiting is broken in production because every request appears to
// come from the proxy IP address.
app.set('trust proxy', 1);

// ─── Middleware ──────────────────────────────────────────────
// [P8 FIX] Security headers via Helmet
app.use(helmet());

// [AUDIT FIX] Validate critical env vars before proceeding
const requiredEnvVars = [
  { key: 'JWT_SECRET', label: 'JWT signing secret' },
  { key: 'DATABASE_URL', label: 'PostgreSQL connection string' },
  { key: 'REDIS_URL', label: 'Redis connection string' },
  { key: 'ESCROW_PUBLIC_KEY', label: 'Stellar escrow public key' },
  { key: 'ESCROW_SECRET_KEY', label: 'Stellar escrow secret key' },
  { key: 'ENCRYPTION_KEY', label: 'AES-256 encryption key for PII' },
  { key: 'CORS_ORIGIN', label: 'Comma-separated list of allowed frontend origins (no wildcards in production)' },
];
const missingVars = requiredEnvVars.filter(v => !process.env[v.key]);
if (missingVars.length > 0) {
  console.error('FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`  - ${v.key}: ${v.label}`));
  console.error('Refusing to start. See .env.example for reference.');
  process.exit(1);
}

// [AUDIT FIX] Global rate limiter — configurable via env
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.globalRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// [AUDIT FIX] Stricter limiter for auth endpoints — configurable via env
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// [AUDIT FIX] CORS origin from env — no wildcard fallback.
// CORS_ORIGIN is validated at startup; parsed as comma-separated list.
const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

// Request logging (dev)
if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// ─── Health check ───────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const redisPing = await redis.ping();
    res.json({
      status: 'ok',
      db: 'connected',
      redis: redisPing === 'PONG' ? 'connected' : 'error',
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/cashout', cashoutRoutes);
app.use('/api/v1/trader', traderRoutes);
app.use('/api/v1/trader/onboarding', traderOnboardingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/rates', ratesRoutes);

// ─── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ─── Global error handler ───────────────────────────────────
app.use(errorHandler);

// ─── Bootstrap helpers ──────────────────────────────────────

/**
 * [P7 FIX] Ensure the escrow account has a USDC trustline on Stellar.
 */
async function ensureUsdcTrustline() {
  const horizonUrl = config.stellar.horizonUrl;
  const escrowPub = config.stellar.escrowPublicKey;
  const escrowSecret = config.stellar.escrowSecretKey;

  if (!escrowPub || !escrowSecret) {
    console.warn('[Bootstrap] Escrow keys not set — skipping USDC trustline check');
    return;
  }

  const server = new StellarSdk.Horizon.Server(horizonUrl);
  // [AUDIT FIX] Use centralized USDC_ASSET from config instead of hardcoded issuers
  const usdcAsset = USDC_ASSET;

  try {
    const account = await server.loadAccount(escrowPub);
    const hasTrustline = account.balances.some(
      (b) => b.asset_code === usdcAsset.code && b.asset_issuer === usdcAsset.issuer
    );
    if (hasTrustline) {
      console.log('[Bootstrap] USDC trustline already exists on escrow account');
      return;
    }

    console.log('[Bootstrap] Creating USDC trustline on escrow account...');
    const keypair = StellarSdk.Keypair.fromSecret(escrowSecret);
    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase:
        config.stellar.network === 'mainnet'
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET,
    });
    txBuilder.addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }));
    txBuilder.setTimeout(30);
    const tx = txBuilder.build();
    tx.sign(keypair);
    await server.submitTransaction(tx);
    console.log('[Bootstrap] USDC trustline created successfully');
  } catch (err) {
    console.error('[Bootstrap] Failed to check/create USDC trustline:', err.message);
    // Non-fatal — don't crash the server
  }
}

/**
 * [P6 FIX] Seed an admin account from environment variables if none exists.
 */
async function seedAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.log('[Bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const existing = await db.query(`SELECT id FROM users WHERE email = $1 AND role = 'admin'`, [adminEmail]);
  if (existing.rows.length > 0) {
    console.log('[Bootstrap] Admin account already exists');
    return;
  }

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const crypto = await import('crypto');
  // [M-8 FIX] Use NULL for admin stellar_address instead of 'ADMIN_PLACEHOLDER'
  const adminPhoneHash = crypto.createHash('sha256').update('admin').digest('hex');
  await db.query(
    `INSERT INTO users (stellar_address, phone_hash, email, password_hash, role, kyc_level, created_at)
     VALUES (NULL, $1, $2, $3, 'admin', 'VERIFIED', NOW())
     ON CONFLICT DO NOTHING`,
    [adminPhoneHash, adminEmail, passwordHash]
  );
  console.log('[Bootstrap] Admin account seeded');
}

// ─── Boot ───────────────────────────────────────────────────
async function start() {
  try {
    // Verify DB connection
    await db.query('SELECT NOW()');
    console.log('[DB] PostgreSQL connected (raw pool)');

    // Verify Redis
    await redis.ping();
    console.log('[Redis] Connected');

    // Bootstrap: seed admin + ensure USDC trustline + ensure storage bucket
    await seedAdminAccount();
    await ensureUsdcTrustline();

    // ── [C-3 FIX] Startup scan for orphaned transactions ──
    try {
      const orphanResult = await db.query(
        `SELECT id, state, trader_matched_at, escrow_locked_at
         FROM transactions
         WHERE state IN ('TRADER_MATCHED', 'ESCROW_LOCKED')
           AND created_at < NOW() - INTERVAL '30 minutes'`
      );
      if (orphanResult.rows.length > 0) {
        console.warn(`[Bootstrap] Found ${orphanResult.rows.length} potentially orphaned transactions — orphan recovery cron will handle them`);
      }
    } catch (err) {
      console.warn('[Bootstrap] Orphan scan skipped:', err.message);
    }

    // Ensure Supabase Storage bucket exists (idempotent — safe to run every boot)
    try {
      const { default: storageService } = await import('./services/storageService.js');
      await storageService.ensureBucket();
    } catch (err) {
      console.warn('[Bootstrap] Supabase Storage bucket check skipped:', err.message);
    }

    // Init WebSocket
    websocket.init(httpServer);

    // Start Horizon escrow watcher
    await horizonWatcher.startWatcher();

    // Start HTTP server
    httpServer.listen(config.port, () => {
      console.log(`\n[Server] Rowan Backend running on port ${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   Stellar network: ${config.stellar.network}`);
      console.log(`   Escrow address: ${config.stellar.escrowPublicKey || 'NOT SET'}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  horizonWatcher.stopWatcher();
  httpServer.close();
  await db.pool.end();
  redis.disconnect();
  process.exit(0);
});

start();
