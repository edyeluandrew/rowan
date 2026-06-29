#!/usr/bin/env node
/**
 * Phase 2H-1 runtime tests (testnet / throwaway data only).
 * Run from backend/: node scripts/phase2h1-runtime-tests.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(backendRoot, '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env not found');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function withRedisReleaseLockBypass(fn) {
  const redis = (await import('../src/db/redis.js')).default;
  const originalSet = redis.set.bind(redis);
  redis.set = async (key, ...rest) => {
    if (typeof key === 'string' && key.startsWith('lock:release:')) return 'OK';
    return originalSet(key, ...rest);
  };
  try {
    return await fn();
  } finally {
    redis.set = originalSet;
  }
}

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, err) {
  results.push({ name, ok: false, detail: err.message || String(err) });
  console.log(`FAIL  ${name} — ${err.message || err}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function cleanup(client, ids) {
  const { txIds = [], quoteIds = [] } = ids;
  for (const id of txIds) {
    await client.query('DELETE FROM audit_logs WHERE resource_id = $1', [id]).catch(() => {});
    await client.query('DELETE FROM transactions WHERE id = $1', [id]).catch(() => {});
  }
  for (const id of quoteIds) {
    await client.query('DELETE FROM quotes WHERE id = $1', [id]).catch(() => {});
  }
}

async function getActiveTraderWithPayoutSetting(client) {
  const r = await client.query(
    `SELECT t.id AS trader_id, t.float_ugx, t.float_kes, t.float_tzs,
            ps.id AS payout_setting_id, ps.reserved_float, ps.available_float
     FROM traders t
     JOIN trader_payout_settings ps ON ps.trader_id = t.id AND ps.is_active = true
     WHERE t.status = 'ACTIVE'
     LIMIT 1`
  );
  if (!r.rows[0]) throw new Error('No active trader with payout setting');
  return r.rows[0];
}

async function createThrowawayTx(client, { traderId, payoutSettingId, traderStellar, state, swap = false }) {
  const template = await client.query(
    `SELECT q.user_id, q.xlm_amount, q.fiat_amount, q.fiat_currency, q.platform_fee,
            q.network, q.phone_hash, q.escrow_address, q.market_rate, q.user_rate,
            u.stellar_address AS user_stellar,
            tx.locked_rate
     FROM transactions tx
     JOIN quotes q ON q.id = tx.quote_id
     JOIN users u ON u.id = q.user_id
     ORDER BY tx.created_at DESC
     LIMIT 1`
  );
  assert(template.rows[0], 'Need at least one existing quote/user as template');
  const t = template.rows[0];
  const memo = `ROWAN-phase2h1-${Date.now()}`;

  const quoteRes = await client.query(
    `INSERT INTO quotes (
       user_id, xlm_amount, fiat_currency, market_rate, user_rate, fiat_amount,
       platform_fee, network, phone_hash, memo, escrow_address, expires_at, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW() + INTERVAL '1 hour','PENDING')
     RETURNING id`,
    [
      t.user_id, t.xlm_amount, t.fiat_currency, t.market_rate, t.user_rate,
      t.fiat_amount, t.platform_fee, t.network, t.phone_hash, memo, t.escrow_address,
    ]
  );
  const quoteId = quoteRes.rows[0].id;

  const txRes = await client.query(
    `INSERT INTO transactions (
       id, user_id, quote_id, trader_id, payout_setting_id, state,
       xlm_amount, usdc_amount, fiat_amount, fiat_currency, network, phone_hash, locked_rate,
       stellar_swap_tx, trader_matched_at, created_at, updated_at
     ) VALUES (
       gen_random_uuid(), $1, $2, $3, $4, $5,
       $6, 1.5, $7, $8, $9, $10, $11,
       $12, NOW(), NOW(), NOW()
     ) RETURNING id`,
    [
      t.user_id,
      quoteId,
      traderId,
      payoutSettingId,
      state,
      t.xlm_amount,
      t.fiat_amount,
      t.fiat_currency,
      t.network,
      t.phone_hash,
      t.locked_rate,
      swap ? 'phase2h1-simulated-swap-tx-hash' : null,
    ]
  );

  return {
    txId: txRes.rows[0].id,
    userId: t.user_id,
    quoteId,
    userStellar: t.user_stellar,
    traderStellar,
  };
}

async function testB_declineReleasesCanonicalFloat() {
  const client = await pool.connect();
  const ids = { txIds: [], quoteIds: [] };
  try {
    const { trader_id, payout_setting_id, float_ugx, float_kes, float_tzs } =
      await getActiveTraderWithPayoutSetting(client);

    const beforePs = await client.query(
      `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
      [payout_setting_id]
    );
    const reservedBefore = parseFloat(beforePs.rows[0].reserved_float);

    const traderRow = await client.query(`SELECT stellar_address FROM traders WHERE id = $1`, [trader_id]);
    const throwaway = await createThrowawayTx(client, {
      traderId: trader_id,
      payoutSettingId: payout_setting_id,
      traderStellar: traderRow.rows[0].stellar_address,
      state: 'TRADER_MATCHED',
    });
    Object.assign(ids, { txIds: [throwaway.txId], quoteIds: [throwaway.quoteId] });

    const txRow = (await client.query(`SELECT fiat_amount FROM transactions WHERE id = $1`, [throwaway.txId])).rows[0];
    const fiatAmount = parseFloat(txRow.fiat_amount);
    await client.query(
      `UPDATE trader_payout_settings SET reserved_float = reserved_float + $1 WHERE id = $2`,
      [fiatAmount, payout_setting_id]
    );

    const release1 = await withRedisReleaseLockBypass(async () => {
      const escrowController = (await import('../src/services/escrowController.js')).default;
      const txRow = (await client.query(`SELECT * FROM transactions WHERE id = $1`, [throwaway.txId])).rows[0];
      return escrowController.releaseMatchFloatForTransaction(txRow);
    });
    assert(release1.released === true, 'First release should succeed');

    const afterPs = await client.query(
      `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
      [payout_setting_id]
    );
    assert(parseFloat(afterPs.rows[0].reserved_float) === reservedBefore, 'reserved_float should return to pre-test level');

    const afterTrader = await client.query(
      `SELECT float_ugx, float_kes, float_tzs FROM traders WHERE id = $1`,
      [trader_id]
    );
    assert(
      parseFloat(afterTrader.rows[0].float_ugx) === parseFloat(float_ugx) &&
        parseFloat(afterTrader.rows[0].float_kes) === parseFloat(float_kes) &&
        parseFloat(afterTrader.rows[0].float_tzs) === parseFloat(float_tzs),
      'Legacy traders.float_* must not change'
    );

    const release2 = await withRedisReleaseLockBypass(async () => {
      const escrowController = (await import('../src/services/escrowController.js')).default;
      const txRow = (await client.query(`SELECT * FROM transactions WHERE id = $1`, [throwaway.txId])).rows[0];
      return escrowController.releaseMatchFloatForTransaction(txRow);
    });
    assert(release2.released === false, 'Duplicate release must be no-op');

    pass('Test B — trader decline releases canonical reserved_float', `released once, legacy float untouched`);
  } catch (e) {
    fail('Test B — trader decline releases canonical reserved_float', e);
  } finally {
    await cleanup(client, ids);
    client.release();
  }
}

async function testC_rematchReservation() {
  const client = await pool.connect();
  const ids = { txIds: [], quoteIds: [] };
  try {
    const payoutSettingsService = (await import('../src/services/payoutSettingsService.js')).default;
    const escrowController = (await import('../src/services/escrowController.js')).default;

    const settings = await client.query(
      `SELECT ps.id, ps.trader_id, t.stellar_address
       FROM trader_payout_settings ps
       JOIN traders t ON t.id = ps.trader_id
       WHERE ps.is_active = true
       LIMIT 2`
    );
    assert(settings.rows.length >= 1, 'Need at least one payout setting');
    const settingA = settings.rows[0];
    const settingB = settings.rows[1] || settings.rows[0];

    const snap = async (id) => {
      const r = await client.query(
        `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
        [id]
      );
      return parseFloat(r.rows[0].reserved_float);
    };

    const rA0 = await snap(settingA.id);
    const rB0 = await snap(settingB.id);

    const throwaway = await createThrowawayTx(client, {
      traderId: settingA.trader_id,
      payoutSettingId: settingA.id,
      traderStellar: settingA.stellar_address,
      state: 'TRADER_MATCHED',
    });
    ids.txIds.push(throwaway.txId);
    ids.quoteIds.push(throwaway.quoteId);

    await payoutSettingsService.reserveFloat(settingA.id, 5000);
    assert((await snap(settingA.id)) === rA0 + 5000, 'Setting A reserved_float should increase');

    let tx = (await client.query(`SELECT * FROM transactions WHERE id = $1`, [throwaway.txId])).rows[0];
    await withRedisReleaseLockBypass(async () => {
      const escrowController = (await import('../src/services/escrowController.js')).default;
      await escrowController.releaseMatchFloatForTransaction(tx);
    });
    assert((await snap(settingA.id)) === rA0, 'Setting A reserved_float should decrease after release');

    await client.query(
      `UPDATE transactions SET trader_id = $1, payout_setting_id = $2 WHERE id = $3`,
      [settingB.trader_id, settingB.id, throwaway.txId]
    );
    await payoutSettingsService.reserveFloat(settingB.id, 5000);
    assert((await snap(settingB.id)) === rB0 + 5000, 'Setting B reserved_float should increase on rematch');

    pass('Test C — rematch reservation correctness', 'old setting released, new setting reserved');
  } catch (e) {
    fail('Test C — rematch reservation correctness', e);
  } finally {
    await cleanup(client, ids);
    client.release();
  }
}

async function testD_postSwapOrphanXlmRefund() {
  const client = await pool.connect();
  const ids = { txIds: [], quoteIds: [] };
  try {
    const { trader_id, payout_setting_id } = await getActiveTraderWithPayoutSetting(client);
    const traderRow = await client.query(`SELECT stellar_address FROM traders WHERE id = $1`, [trader_id]);

    const throwaway = await createThrowawayTx(client, {
      traderId: trader_id,
      payoutSettingId: payout_setting_id,
      traderStellar: traderRow.rows[0].stellar_address,
      state: 'TRADER_MATCHED',
      swap: true,
    });
    ids.txIds.push(throwaway.txId);
    ids.quoteIds.push(throwaway.quoteId);

    const escrowController = (await import('../src/services/escrowController.js')).default;
    const result = await escrowController.refundOrphanTransaction(
      throwaway.txId,
      'Phase2H1 test post-swap orphan'
    );

    assert(result.status !== 'refunded' || result.asset === 'XLM', 'Post-swap orphan refund must return XLM to user');
    assert(result.status !== 'blocked' || result.code !== 'NO_USDC_TRUSTLINE', 'Must not block on missing USDC trustline');

    const txAfter = (await client.query(`SELECT state, stellar_refund_tx FROM transactions WHERE id = $1`, [throwaway.txId])).rows[0];
    assert(txAfter.state !== 'REFUNDED' || txAfter.stellar_refund_tx, 'Must not mark REFUNDED without on-chain hash');

    const audit = await client.query(
      `SELECT action FROM audit_logs WHERE resource_id = $1 AND action LIKE 'orphan_%' ORDER BY created_at DESC LIMIT 1`,
      [throwaway.txId]
    );
    assert(audit.rows.length > 0, 'Orphan audit log expected');

    pass(
      'Test D — post-swap orphan XLM refund path',
      `status=${result.status}, asset=${result.asset || 'n/a'}, audit=${audit.rows[0].action}`
    );
  } catch (e) {
    fail('Test D — post-swap orphan refund logic', e);
  } finally {
    await cleanup(client, ids);
    client.release();
  }
}

async function testA_releaseBlockedOnConfirm() {
  const client = await pool.connect();
  const ids = { txIds: [], quoteIds: [] };
  let traderId;
  let originalStellar;
  try {
    const StellarSdk = (await import('@stellar/stellar-sdk')).default;
    const funded = StellarSdk.Keypair.random();
    const friendbot = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(funded.publicKey())}`);
    assert(friendbot.ok, 'Friendbot fund failed for no-trustline trader account');

    const traderRes = await client.query(
      `SELECT id, stellar_address FROM traders WHERE status = 'ACTIVE' LIMIT 1`
    );
    assert(traderRes.rows[0], 'Need active trader');
    traderId = traderRes.rows[0].id;
    originalStellar = traderRes.rows[0].stellar_address;
    const noTrustlineStellar = funded.publicKey();

    await client.query(`UPDATE traders SET stellar_address = $1 WHERE id = $2`, [noTrustlineStellar, traderId]);

    const throwaway = await createThrowawayTx(client, {
      traderId,
      payoutSettingId: null,
      traderStellar: noTrustlineStellar,
      state: 'USER_CONFIRMATION_PENDING',
      swap: true,
    });
    ids.txIds.push(throwaway.txId);
    ids.quoteIds.push(throwaway.quoteId);

    const hash = await withRedisReleaseLockBypass(async () => {
      const escrowController = (await import('../src/services/escrowController.js')).default;
      return escrowController.releaseToTrader(throwaway.txId);
    });

    assert(hash === null, 'releaseToTrader must return null when blocked');

    const txAfter = (
      await client.query(
        `SELECT state, stellar_release_tx FROM transactions WHERE id = $1`,
        [throwaway.txId]
      )
    ).rows[0];
    assert(txAfter.state === 'RELEASE_BLOCKED', `Expected RELEASE_BLOCKED, got ${txAfter.state}`);
    assert(!txAfter.stellar_release_tx, 'Must not store stellar_release_tx when blocked');

    const audit = await client.query(
      `SELECT action FROM audit_logs WHERE resource_id = $1 AND action = 'escrow_release_blocked'`,
      [throwaway.txId]
    );
    assert(audit.rows.length > 0, 'escrow_release_blocked audit expected');

    pass('Test A — release blocked on user confirmation path', 'RELEASE_BLOCKED, no false COMPLETE');
  } catch (e) {
    fail('Test A — release blocked on user confirmation path', e);
  } finally {
    if (traderId && originalStellar) {
      await client.query(`UPDATE traders SET stellar_address = $1 WHERE id = $2`, [originalStellar, traderId]).catch(() => {});
    }
    await cleanup(client, ids);
    client.release();
  }
}

async function testE_dangerousEndpointGuard() {
  try {
    const express = (await import('express')).default;
    const jwt = (await import('jsonwebtoken')).default;
    const config = (await import('../src/config/index.js')).default;
    const adminRouter = (await import('../src/routes/admin.js')).default;

    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRouter);

    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const port = server.address().port;
    const apiUrl = `http://127.0.0.1:${port}`;

    const adminLookup = await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    assert(adminLookup.rows[0], 'Need at least one admin row for JWT');
    const adminId = adminLookup.rows[0].id;
    const token = jwt.sign({ role: 'admin', sub: adminId }, config.jwt.secret, { algorithm: 'HS256' });

    const fakeTxId = '00000000-0000-4000-8000-000000000001';
    const fakeDisputeId = '00000000-0000-4000-8000-000000000002';

    const forceRefund = await fetch(`${apiUrl}/api/v1/admin/transactions/${fakeTxId}/force-refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'phase2h1-test' }),
    });
    assert(forceRefund.status === 409, `force-refund should 409, got ${forceRefund.status}`);

    const forceComplete = await fetch(`${apiUrl}/api/v1/admin/transactions/${fakeTxId}/force-complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'phase2h1-test' }),
    });
    assert(forceComplete.status === 409, `force-complete should 409, got ${forceComplete.status}`);

    const putResolve = await fetch(`${apiUrl}/api/v1/admin/disputes/${fakeDisputeId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution: 'RESOLVED_FOR_USER' }),
    });
    assert(putResolve.status === 410, `PUT dispute resolve should 410, got ${putResolve.status}`);

    const audit = await pool.query(
      `SELECT COUNT(*)::int AS n FROM audit_logs WHERE action = 'dangerous_endpoint_blocked' AND created_at > NOW() - INTERVAL '5 minutes'`
    );
    assert(audit.rows[0].n >= 3, 'Expected audit logs for blocked dangerous endpoints');

    pass('Test E — dangerous endpoint guard', `409/409/410, ${audit.rows[0].n} audit entries`);
    server.close();
  } catch (e) {
    fail('Test E — dangerous endpoint guard', e);
  }
}

console.log('Phase 2H-1 runtime tests (testnet throwaway only)\n');

await testA_releaseBlockedOnConfirm();
await testB_declineReleasesCanonicalFloat();
await testC_rematchReservation();
await testD_postSwapOrphanXlmRefund();
await testE_dangerousEndpointGuard();

console.log('\n--- Summary ---');
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`${passed} passed, ${failed} failed`);
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
}

await pool.end();
process.exit(failed > 0 ? 1 : 0);
