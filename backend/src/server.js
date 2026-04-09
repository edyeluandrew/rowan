import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import StellarSdk from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import { USDC_ASSET } from './config/stellar.js';
import db from './db/index.js';
import redis from './db/redis.js';
import { errorHandler } from './middleware/validate.js';

// Routes
import wellKnownRoutes from './routes/wellKnown.js';
import authRoutes from './routes/auth.js';
import cashoutRoutes from './routes/cashout.js';
import traderRoutes from './routes/trader.js';
import traderOnboardingRoutes from './routes/traderOnboarding.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import ratesRoutes from './routes/rates.js';
import disputesRoutes from './routes/disputes.js';

// Services
import websocket from './services/websocket.js';
import horizonWatcher from './services/horizonWatcher.js';
import './services/jobQueue.js'; // self-initializing (registers cron jobs)
import logger from './utils/logger.js';

const app = express();
const httpServer = createServer(app);

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// express-rate-limit and req.ip read the real client IP from the X-Forwarded-For
// header when the server runs behind Railway, Render, or Cloudflare. Without this
// line all rate limiting is broken in production because every request appears to
// come from the proxy IP address.
app.set('trust proxy', 1);

// ─── Middleware ──────────────────────────────────────────────
// [P8 FIX] Security headers via Helmet
app.use(helmet());

// [AUDIT FIX] Validate critical env vars before proceeding
// [STROOPS FIX] USDC amounts stored as stroops (integers) to avoid bigint conversion errors
const requiredEnvVars = [
  { key: 'JWT_SECRET', label: 'JWT signing secret' },
  { key: 'DATABASE_URL', label: 'PostgreSQL connection string' },
  { key: 'REDIS_URL', label: 'Redis connection string' },
  { key: 'ESCROW_PUBLIC_KEY', label: 'Stellar escrow public key' },
  { key: 'ESCROW_SECRET_KEY', label: 'Stellar escrow secret key' },
  { key: 'ENCRYPTION_KEY', label: 'AES-256 encryption key for PII' },
  { key: 'CORS_ORIGIN', label: 'Comma-separated list of allowed frontend origins (no wildcards in production)' },
  { key: 'SEP10_SIGNING_KEY', label: 'SEP-10 signing public key (served in stellar.toml)' },
  { key: 'SEP10_SIGNING_SECRET', label: 'SEP-10 signing secret key (used to sign challenges)' },
  { key: 'API_URL', label: 'Public API URL (used in stellar.toml WEB_AUTH_ENDPOINT)' },
  { key: 'STELLAR_NETWORK', label: 'Stellar network (testnet or mainnet)' },
  { key: 'HORIZON_URL', label: 'Stellar Horizon API URL' },
];
const missingVars = requiredEnvVars.filter(v => !process.env[v.key]);
if (missingVars.length > 0) {
  console.error('FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`  - ${v.key}: ${v.label}`));
  console.error('Refusing to start. See .env.example for reference.');
  process.exit(1);
}

// [SEP-10] Validate that SEP10_SIGNING_KEY is a valid Stellar public key
try {
  StellarSdk.Keypair.fromPublicKey(process.env.SEP10_SIGNING_KEY);
} catch {
  console.error('FATAL: SEP10_SIGNING_KEY is not a valid Stellar public key (G...)');
  process.exit(1);
}

// [AUDIT FIX] JWT_SECRET must be at least 32 characters to resist brute-force
if (process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters long');
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

// [SEP-1] stellar.toml — must be public with CORS *, registered before app-wide CORS
app.use('/.well-known', wellKnownRoutes);

// [AUDIT FIX] CORS origin from env — supports wildcard for development.
// CORS_ORIGIN is validated at startup; parsed as comma-separated list or '*'.
const corsOrigin = process.env.CORS_ORIGIN.trim();
const corsConfig = corsOrigin === '*' 
  ? cors() // Wildcard — allows all origins
  : cors({ origin: corsOrigin.split(',').map(o => o.trim()) }); // Specific origins
app.use(corsConfig);
app.use(express.json({ limit: '100kb' }));

// Request logging (dev)
if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const redisPing = await redis.ping();
    res.json({
      status: 'ok',
      db: 'connected',
      redis: redisPing === 'PONG' ? 'connected' : 'error',
      horizon: horizonWatcher.getStatus(),
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/cashout', cashoutRoutes);
app.use('/api/v1/disputes', disputesRoutes);
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
    logger.warn('[Bootstrap] Escrow keys not set — skipping USDC trustline check');
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
      logger.info('[Bootstrap] USDC trustline already exists on escrow account');
      return;
    }

    logger.info('[Bootstrap] Creating USDC trustline on escrow account...');
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
    logger.info('[Bootstrap] USDC trustline created successfully');
  } catch (err) {
    logger.error('[Bootstrap] Failed to check/create USDC trustline', { error: err.message });
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
    logger.info('[Bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const existing = await db.query(`SELECT id FROM users WHERE email = $1 AND role = 'admin'`, [adminEmail]);
  if (existing.rows.length > 0) {
    logger.info('[Bootstrap] Admin account already exists');
    return;
  }

  const { default: bcrypt } = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const crypto = await import('crypto');
  // Admin doesn't need a real Stellar address — use a deterministic placeholder
  const adminPhoneHash = crypto.createHash('sha256').update('admin').digest('hex');
  const adminStellarPlaceholder = 'ADMIN_' + crypto.createHash('sha256').update(adminEmail).digest('hex').slice(0, 50).toUpperCase();
  await db.query(
    `INSERT INTO users (stellar_address, phone_hash, email, password_hash, role, kyc_level, created_at)
     VALUES ($4, $1, $2, $3, 'admin', 'VERIFIED', NOW())
     ON CONFLICT DO NOTHING`,
    [adminPhoneHash, adminEmail, passwordHash, adminStellarPlaceholder]
  );
  logger.info('[Bootstrap] Admin account seeded');
}

/**
 * Run pending database migrations
 * Ensures all schema updates are applied before the server starts
 */
async function runMigrations() {
  try {
    // Ensure migration tracking table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '../db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    // Get already-applied migrations
    const applied = await db.query(`SELECT filename FROM schema_migrations`);
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    let ranCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.debug(`[Migration] Skipping (already applied): ${file}`);
        continue;
      }

      logger.info(`[Migration] Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
        await db.query(sql);
        await db.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
        logger.info(`[Migration] ✓ ${file}`);
        ranCount++;
      } catch (err) {
        logger.error(`[Migration] ✗ ${file}: ${err.message}`);
        throw err;
      }
    }

    logger.info(`[Migration] Complete — ${ranCount} new, ${files.length - ranCount} skipped`);
  } catch (err) {
    logger.error('[Migration] Failed', { error: err.message });
    throw err;
  }
}

// ─── Boot ───────────────────────────────────────────────────
async function start() {
  try {
    // Verify DB connection (retry up to 3 times for Supabase cold-start wake-up)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await db.query('SELECT NOW()');
        logger.info('[DB] PostgreSQL connected (raw pool)');
        break;
      } catch (dbErr) {
        logger.warn(`[DB] Connection attempt ${attempt}/3 failed`, { error: dbErr.message });
        if (attempt === 3) throw dbErr;
        const delay = attempt * 5000;
        logger.info(`[DB] Retrying in ${delay / 1000}s (Supabase may be waking up)...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // Verify Redis
    await redis.ping();
    logger.info('[Redis] Connected');

    // Run database migrations
    await runMigrations();

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
        logger.warn(`[Bootstrap] Found ${orphanResult.rows.length} potentially orphaned transactions — orphan recovery cron will handle them`);
      }
    } catch (err) {
      logger.warn('[Bootstrap] Orphan scan skipped', { error: err.message });
    }

    // Ensure Supabase Storage bucket exists (idempotent — safe to run every boot)
    try {
      const { default: storageService } = await import('./services/storageService.js');
      await storageService.ensureBucket();
    } catch (err) {
      logger.warn('[Bootstrap] Supabase Storage bucket check skipped', { error: err.message });
    }

    // Init WebSocket
    websocket.init(httpServer);

    // Start Horizon escrow watcher
    await horizonWatcher.startWatcher();

    // Start HTTP server — bind to 0.0.0.0 so physical devices on the LAN can reach it
    httpServer.listen(config.port, '0.0.0.0', () => {
      logger.info(`[Server] Rowan Backend running on port ${config.port}`, {
        environment: config.nodeEnv,
        stellarNetwork: config.stellar.network,
        escrowAddress: config.stellar.escrowPublicKey || 'NOT SET',
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[Server] SIGTERM received, shutting down...');
  horizonWatcher.stopWatcher();
  httpServer.close();
  await db.pool.end();
  redis.disconnect();
  process.exit(0);
});

start();
