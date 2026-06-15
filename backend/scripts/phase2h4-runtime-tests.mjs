#!/usr/bin/env node
/**
 * Phase 2H-4 runtime tests — live fiat FX provider (testnet only).
 * Run: node scripts/phase2h4-runtime-tests.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

function loadEnv() {
  for (const line of fs.readFileSync(path.join(backendRoot, '.env'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq);
    let v = t.slice(eq + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();
process.env.STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const results = [];
const pass = (n, d = '') => { results.push({ n, ok: true, d }); console.log(`PASS  ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, e) => { results.push({ n, ok: false, d: e.message || String(e) }); console.log(`FAIL  ${n} — ${e.message || e}`); };
const assert = (c, m) => { if (!c) throw new Error(m); };

async function runMigration029() {
  const sql = fs.readFileSync(path.join(backendRoot, 'src/db/migrations/029_fx_provider_metadata.sql'), 'utf8');
  await pool.query(sql);
}

async function testA_providerConfig() {
  try {
    const config = (await import('../src/config/index.js')).default;
    const fx = await import('../src/services/fxService.js');
    fx.__testResetFxState();

    assert(config.coingeckoApiUrl, 'CoinGecko URL configured');
    assert(config.fiatFx.provider, 'fiat FX provider configured');
    assert(config.fiatFx.enabled !== false, 'live FX enabled by default');

    const health = await fx.getFiatFxHealth();
    assert(health.configured_provider === config.fiatFx.provider, 'health shows configured provider');
    assert(health.coingecko_role === 'crypto-xlm-fallback-only', 'CoinGecko role documented');
    assert(health.live_fx_enabled === true, 'live FX enabled in health');

    fx.__testResetFxState();
    fx.__testSetProviderOverride(() => null);
    const ugx = await fx.getUsdcToFiat('UGX');
    assert(ugx.fxSource !== 'LIVE', `disabled fetch must not fake LIVE, got ${ugx.fxSource}`);
    assert(ugx.fxSource === 'STATIC', 'testnet falls back to STATIC when provider disabled');

    fx.__testResetFxState();
    pass('Test A — provider config detection', `provider=${health.configured_provider}, coingecko=${!!config.coingeckoApiUrl}`);
  } catch (e) {
    fail('Test A — provider config detection', e);
  }
}

async function testB_liveRateFetch() {
  try {
    const fx = await import('../src/services/fxService.js');
    fx.__testResetFxState();
    await fx.refreshFiatFxRates();

    for (const ccy of ['UGX', 'KES', 'TZS']) {
      const row = await fx.getUsdcToFiat(ccy);
      assert(row.fxSource === 'LIVE', `${ccy} should be LIVE, got ${row.fxSource}`);
      assert(Number.isFinite(row.rate) && row.rate > 0, `${ccy} rate numeric`);
      assert(row.fxProvider, `${ccy} has provider`);
      assert(row.fxFetchedAt, `${ccy} has fetched_at`);
      assert(row.fxAgeSeconds != null && row.fxAgeSeconds >= 0, `${ccy} has age`);
      assert(row.fiatRateSource.includes(':'), `${ccy} fiat_rate_source set`);
    }

    const bad = await fx.getUsdcToFiat('USD');
    assert(bad.fxSource === 'UNAVAILABLE', 'unsupported currency returns UNAVAILABLE');

    pass('Test B — live rate fetch', 'UGX/KES/TZS LIVE with metadata');
  } catch (e) {
    fail('Test B — live rate fetch', e);
  }
}

async function testC_quoteFxMetadata() {
  try {
    await runMigration029();
    const fx = await import('../src/services/fxService.js');
    fx.__testResetFxState();
    await fx.refreshFiatFxRates();
    const fiatFx = await fx.assertFiatFxAvailableForQuote('UGX');
    assert(fiatFx.fxSource === 'LIVE', 'quote gate uses LIVE FX');
    assert(fiatFx.fxProvider, 'fxProvider on gate result');

    const user = (await pool.query(`SELECT id FROM users WHERE role = 'user' LIMIT 1`)).rows[0];
    assert(user, 'need a user row for quote test');

    const usdcAmount = 2.5;
    const fiatAmount = parseFloat((usdcAmount * fiatFx.rate).toFixed(2));
    const inserted = await pool.query(
      `INSERT INTO quotes
         (user_id, xlm_amount, fiat_currency, market_rate, user_rate, fiat_amount,
          platform_fee, network, phone_hash, memo, escrow_address, expires_at, status,
          fx_source, fx_rate, fx_currency, fx_warning, fiat_rate_source,
          fx_provider, fx_fetched_at, fx_age_seconds, rate_source, quote_source)
       VALUES ($1, 5, 'UGX', 3, $2, $3, 0.1, 'MTN_UG', 'phase2h4-hash', $4,
               'GTEST', NOW() + INTERVAL '1 hour', 'PENDING',
               $5, $6, $7, $8, $9, $10, $11, $12, 'LIVE', 'horizon-path')
       RETURNING *`,
      [
        user.id,
        fiatFx.rate * 0.99,
        fiatAmount,
        `ROWAN-2h4-${Date.now()}`,
        fiatFx.fxSource,
        fiatFx.rate,
        fiatFx.fxCurrency,
        fiatFx.fxWarning,
        fiatFx.fiatRateSource,
        fiatFx.fxProvider,
        fiatFx.fxFetchedAt ? new Date(fiatFx.fxFetchedAt) : null,
        fiatFx.fxAgeSeconds,
      ],
    );
    const quote = inserted.rows[0];
    assert(quote.fx_source === 'LIVE', 'fx_source stored LIVE');
    assert(quote.fx_provider, 'fx_provider stored');
    assert(Number(quote.fx_rate) === fiatFx.rate, 'fx_rate stored');
    assert(Math.abs(Number(quote.fiat_amount) - fiatAmount) < 0.02, 'fiat uses FX rate');

    await pool.query(`DELETE FROM quotes WHERE id = $1`, [quote.id]);
    pass('Test C — quote FX metadata', `fx=${quote.fx_source}, provider=${quote.fx_provider}, rate=${Number(quote.fx_rate).toFixed(2)}`);
  } catch (e) {
    fail('Test C — quote FX metadata', e);
  }
}

async function testD_providerFailure() {
  try {
    const fx = await import('../src/services/fxService.js');
    fx.__testResetFxState();

    const freshAt = new Date().toISOString();
    await fx.__testSetProviderOverride(async () => ({
      provider: 'test-mock',
      fetchedAt: freshAt,
      fetchedAtUnix: Math.floor(Date.now() / 1000),
      rates: {
        UGX: { rate: 3800, fiatRateSource: 'mock:UGX' },
        KES: { rate: 130, fiatRateSource: 'mock:KES' },
        TZS: { rate: 2700, fiatRateSource: 'mock:TZS' },
      },
    }));
    await fx.refreshFiatFxRates();
    const live = await fx.getUsdcToFiat('UGX');
    assert(live.fxSource === 'LIVE', 'mock fetch LIVE');

    fx.__testSetProviderOverride(async () => { throw new Error('simulated provider outage'); });
    const cached = await fx.getUsdcToFiat('UGX');
    assert(cached.fxSource === 'LIVE', 'fresh cache still LIVE after provider fail');
    assert(cached.fxAgeSeconds < 3600, 'cache age fresh');

    const staleAt = new Date(Date.now() - 7200 * 1000).toISOString();
    fx.__testResetFxState();
    fx.__testSetProviderOverride(async () => ({
      provider: 'test-mock',
      fetchedAt: staleAt,
      fetchedAtUnix: Math.floor(Date.parse(staleAt) / 1000),
      rates: { UGX: { rate: 3800, fiatRateSource: 'mock:UGX' } },
    }));
    await fx.refreshFiatFxRates();
    fx.__testSetProviderOverride(async () => { throw new Error('simulated provider outage'); });

    const stale = await fx.getUsdcToFiat('UGX');
    assert(stale.fxSource !== 'LIVE' || (stale.fxAgeSeconds != null && stale.fxAgeSeconds > 3600),
      'stale cache not labeled fresh LIVE when beyond max age');
    assert(['FALLBACK', 'STATIC', 'UNAVAILABLE'].includes(stale.fxSource),
      `stale path explicit: ${stale.fxSource}`);

    fx.__testResetFxState();
    pass('Test D — provider failure behavior', `cached=${cached.fxSource}, stale=${stale.fxSource}`);
  } catch (e) {
    fail('Test D — provider failure behavior', e);
  }
}

async function testE_adminHealth() {
  try {
    const fx = await import('../src/services/fxService.js');
    fx.__testResetFxState();
    await fx.refreshFiatFxRates();

    const { getFiatFxHealth } = fx;
    const fiatOnly = await getFiatFxHealth();
    assert(fiatOnly.configured_provider, 'fiatFx provider in health');
    assert(fiatOnly.currencies?.UGX?.fxSource, 'per-currency source');
    assert(fiatOnly.currencies?.UGX?.fxFetchedAt, 'per-currency fetched_at');

    pass('Test E — admin health/rates', `fiat=${fiatOnly.currencies.UGX.fxSource}, provider=${fiatOnly.configured_provider}`);
  } catch (e) {
    fail('Test E — admin health/rates', e);
  }
}

async function testF_mainnetSafety() {
  try {
    const config = (await import('../src/config/index.js')).default;
    const fx = await import('../src/services/fxService.js');

    const saved = {
      isMainnet: config.stellar.isMainnet,
      allowStatic: config.platform.allowStaticFiatRates,
      allowStale: config.fiatFx.allowStaleRates,
      enabled: config.fiatFx.enabled,
    };

    config.stellar.isMainnet = true;
    config.platform.allowStaticFiatRates = false;
    config.fiatFx.allowStaleRates = false;
    config.fiatFx.enabled = false;
    fx.__testResetFxState();

    let blockedStatic = false;
    try {
      await fx.assertFiatFxAvailableForQuote('UGX');
    } catch (e) {
      blockedStatic = e.code === 'FIAT_FX_STATIC_BLOCKED' || e.code === 'FIAT_FX_UNAVAILABLE';
    }
    assert(blockedStatic, 'mainnet blocks STATIC/unavailable without allow');

    config.fiatFx.enabled = true;
    fx.__testSetProviderOverride(async () => ({
      provider: 'test-mock',
      fetchedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
      fetchedAtUnix: Math.floor((Date.now() - 7200 * 1000) / 1000),
      rates: { UGX: { rate: 3800, fiatRateSource: 'mock:UGX' } },
    }));
    await fx.refreshFiatFxRates();

    let blockedStale = false;
    try {
      await fx.assertFiatFxAvailableForQuote('UGX');
    } catch (e) {
      blockedStale = e.code === 'FIAT_FX_STALE' || e.code === 'FIAT_FX_UNAVAILABLE';
    }
    assert(blockedStale, 'mainnet blocks stale FX');

    const health = await fx.getFiatFxHealth();
    assert(health.criticals.length > 0, 'mainnet sim reports CRITICALs');

    config.stellar.isMainnet = saved.isMainnet;
    config.platform.allowStaticFiatRates = saved.allowStatic;
    config.fiatFx.allowStaleRates = saved.allowStale;
    config.fiatFx.enabled = saved.enabled;
    fx.__testResetFxState();

    pass('Test F — mainnet safety', 'STATIC/stale blocked, criticals raised');
  } catch (e) {
    fail('Test F — mainnet safety', e);
  }
}

console.log('Phase 2H-4 runtime tests (testnet)\n');
await testA_providerConfig();
await testB_liveRateFetch();
await testC_quoteFxMetadata();
await testD_providerFailure();
await testE_adminHealth();
await testF_mainnetSafety();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- Summary ---\n${results.length - failed} passed, ${failed} failed`);
await pool.end();
process.exit(failed ? 1 : 0);
