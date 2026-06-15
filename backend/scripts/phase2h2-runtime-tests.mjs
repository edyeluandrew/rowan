#!/usr/bin/env node
/**
 * Phase 2H-2 runtime security tests (testnet / throwaway only).
 * Run: node scripts/phase2h2-runtime-tests.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(backendRoot, '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const results = [];
const pass = (n, d = '') => { results.push({ n, ok: true, d }); console.log(`PASS  ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, e) => { results.push({ n, ok: false, d: e.message || String(e) }); console.log(`FAIL  ${n} — ${e.message || e}`); };
const assert = (c, m) => { if (!c) throw new Error(m); };

async function createThrowawayPostSwapQuote(client) {
  const template = await client.query(
    `SELECT q.user_id, q.xlm_amount, q.fiat_currency, q.market_rate, q.user_rate,
            q.fiat_amount, q.platform_fee, q.network, q.phone_hash, q.escrow_address,
            tx.locked_rate
     FROM transactions tx
     JOIN quotes q ON q.id = tx.quote_id
     ORDER BY tx.created_at DESC
     LIMIT 1`
  );
  assert(template.rows[0], 'need template quote');
  const t = template.rows[0];
  const memo = `ROWAN-phase2h2-${Date.now()}`;

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
       user_id, quote_id, state, xlm_amount, usdc_amount, fiat_amount, fiat_currency,
       network, phone_hash, locked_rate, stellar_swap_tx, created_at, updated_at
     ) VALUES ($1,$2,'ESCROW_LOCKED',$3,1.5,$4,$5,$6,$7,$8,$9,NOW(),NOW())
     RETURNING id`,
    [
      t.user_id, quoteId, t.xlm_amount, t.fiat_amount, t.fiat_currency,
      t.network, t.phone_hash, t.locked_rate, 'phase2h2-test-swap-hash',
    ]
  );

  return { quoteId, txId: txRes.rows[0].id };
}

async function testB_totpEncryption() {
  try {
    const { packTotpSecret, isEncryptedTotpSecret, unpackTotpSecret } = await import('../src/utils/totpSecret.js');
    const plain = 'JBSWY3DPEHPK3PXP';
    const packed = packTotpSecret(plain);
    assert(isEncryptedTotpSecret(packed), 'packed secret should look encrypted');
    assert(!packed.includes(plain), 'plaintext must not appear in stored value');
    assert(unpackTotpSecret(packed) === plain, 'round-trip decrypt');
    assert(unpackTotpSecret(plain) === plain, 'legacy plaintext still verifies');
    pass('Test B — TOTP encryption', 'encrypt/decrypt + legacy plaintext compat');
  } catch (e) {
    fail('Test B — TOTP encryption', e);
  }
}

async function testC_cashoutStatusAuth() {
  try {
    const userA = (await pool.query(`SELECT id FROM users ORDER BY created_at DESC LIMIT 1`)).rows[0];
    const userB = (await pool.query(`SELECT id FROM users WHERE id != $1 LIMIT 1`, [userA.id])).rows[0];
    assert(userA && userB, 'need two users');

    const tpl = await pool.query(
      `SELECT q.*, tx.id AS tx_id FROM transactions tx JOIN quotes q ON q.id = tx.quote_id WHERE tx.user_id = $1 LIMIT 1`,
      [userA.id]
    );
    assert(tpl.rows[0], 'need sample tx for user A');
    const t = tpl.rows[0];

    const cashoutRouter = (await import('../src/routes/cashout.js')).default;
    const config = (await import('../src/config/index.js')).default;
    const { authUser } = await import('../src/middleware/auth.js');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/cashout', cashoutRouter);

    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/cashout/status/${t.tx_id}`;

    const noAuth = await fetch(base);
    assert(noAuth.status === 401, `unauth should 401, got ${noAuth.status}`);

    const tokenA = jwt.sign({ sub: userA.id, role: 'user' }, config.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' });
    const okA = await fetch(base, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert(okA.status === 200, `owner should 200, got ${okA.status}`);
    const bodyA = await okA.json();
    assert(bodyA.id === t.tx_id, 'owner gets own tx');
    assert(bodyA.payout_reference === undefined, 'no payout_reference leak');

    const tokenB = jwt.sign({ sub: userB.id, role: 'user' }, config.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' });
    const okB = await fetch(base, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert(okB.status === 404, `other user should 404, got ${okB.status}`);

    server.close();
    pass('Test C — cashout status auth', '401 unauth, 200 owner, 404 other user, sanitized');
  } catch (e) {
    fail('Test C — cashout status auth', e);
  }
}

async function testD_adminRefundGuard() {
  const client = await pool.connect();
  let quoteId = null;
  try {
    const adminRouter = (await import('../src/routes/admin.js')).default;
    const config = (await import('../src/config/index.js')).default;
    const adminId = (await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)).rows[0]?.id;
    assert(adminId, 'need admin');

    const fixture = await createThrowawayPostSwapQuote(client);
    quoteId = fixture.quoteId;

    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRouter);
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const token = jwt.sign({ sub: adminId, role: 'admin' }, config.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' });

    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/refund/${quoteId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'phase2h2 test' }),
    });
    assert(r.status === 409, `post-swap refund should 409, got ${r.status}`);
    const body = await r.json();
    assert(body.useInstead?.includes('refund-retry'), 'response redirects to escrow refund-retry');

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE action = 'dangerous_endpoint_blocked' ORDER BY created_at DESC LIMIT 1`
    );
    assert(audit.rows[0]?.action === 'dangerous_endpoint_blocked', 'audit log for blocked endpoint');

    server.close();
    pass('Test D — admin refund guard', '409 on post-swap + audit');
  } catch (e) {
    fail('Test D — admin refund guard', e);
  } finally {
    if (quoteId) {
      await client.query(`DELETE FROM transactions WHERE quote_id = $1`, [quoteId]);
      await client.query(`DELETE FROM quotes WHERE id = $1`, [quoteId]);
    }
    client.release();
  }
}

async function testA_admin2faFlow() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  let prior2fa = null;
  let admin = null;

  try {
    const { packTotpSecret, isEncryptedTotpSecret, verifyTotpFromStored } = await import('../src/utils/totpSecret.js');
    admin = (await pool.query(
      `SELECT id, email FROM users WHERE role = 'admin' AND email = $1 LIMIT 1`,
      [adminEmail || '']
    )).rows[0] || (await pool.query(`SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`)).rows[0];
    assert(admin, 'need admin user');

    prior2fa = (await pool.query(`SELECT * FROM admin_2fa_settings WHERE admin_id = $1`, [admin.id])).rows[0];

    const secret = 'JBSWY3DPEHPK3PXPTESTADMIN2H2';
    const packed = packTotpSecret(secret);
    await pool.query(`DELETE FROM admin_2fa_settings WHERE admin_id = $1`, [admin.id]);
    await pool.query(
      `INSERT INTO admin_2fa_settings (admin_id, totp_secret, is_enabled, enabled_at) VALUES ($1, $2, TRUE, NOW())`,
      [admin.id, packed]
    );

    const settings = (await pool.query(`SELECT totp_secret FROM admin_2fa_settings WHERE admin_id = $1`, [admin.id])).rows[0];
    assert(isEncryptedTotpSecret(settings.totp_secret), 'admin secret encrypted in DB');

    const speakeasy = (await import('speakeasy')).default;
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    assert(verifyTotpFromStored(settings.totp_secret, code), 'valid TOTP verifies');
    assert(!verifyTotpFromStored(settings.totp_secret, '000000'), 'wrong TOTP fails');

    if (adminEmail && adminPassword) {
      const authRouter = (await import('../src/routes/auth.js')).default;
      const adminRouter = (await import('../src/routes/admin.js')).default;
      const config = (await import('../src/config/index.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/api/v1/auth', authRouter);
      app.use('/api/v1/admin', adminRouter);
      const server = app.listen(0);
      await new Promise((r) => server.once('listening', r));
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;

      const loginRes = await fetch(`${base}/api/v1/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      assert(loginRes.status === 200, `login step should 200, got ${loginRes.status}`);
      const loginBody = await loginRes.json();
      assert(loginBody.requiresTwoFactorVerification === true, '2FA gate active');
      assert(loginBody.adminId === admin.id, 'returns adminId');
      assert(!loginBody.token, 'no token before TOTP');

      const badTotp = await fetch(`${base}/api/v1/auth/admin/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: admin.id, code: '000000' }),
      });
      assert(badTotp.status === 401, `wrong TOTP should 401, got ${badTotp.status}`);

      const goodTotp = await fetch(`${base}/api/v1/auth/admin/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: admin.id, code }),
      });
      assert(goodTotp.status === 200, `valid TOTP should 200, got ${goodTotp.status}`);
      const totpBody = await goodTotp.json();
      assert(totpBody.token, 'token issued after 2FA');

      const meRes = await fetch(`${base}/api/v1/admin/metrics`, {
        headers: { Authorization: `Bearer ${totpBody.token}` },
      });
      assert(meRes.status === 200, `protected admin route should 200, got ${meRes.status}`);

      const audits = await pool.query(
        `SELECT action FROM audit_logs WHERE admin_id = $1 AND action IN ('admin_login_started','admin_2fa_required','admin_2fa_success','admin_2fa_failed')
         ORDER BY created_at DESC LIMIT 10`,
        [admin.id]
      );
      const actions = new Set(audits.rows.map((r) => r.action));
      assert(actions.has('admin_2fa_required') || actions.has('admin_login_started'), 'login audit exists');
      assert(actions.has('admin_2fa_failed'), 'failed TOTP audit exists');
      assert(actions.has('admin_2fa_success'), 'success TOTP audit exists');

      server.close();
      pass('Test A — admin 2FA flow', 'HTTP gate + TOTP + protected route + audits');
    } else {
      pass('Test A — admin 2FA crypto path', 'encrypted storage + verify (set ADMIN_EMAIL/PASSWORD for HTTP flow)');
    }
  } catch (e) {
    fail('Test A — admin 2FA flow', e);
  } finally {
    if (admin?.id) {
      await pool.query(`DELETE FROM admin_2fa_settings WHERE admin_id = $1`, [admin.id]);
      if (prior2fa) {
        await pool.query(
          `INSERT INTO admin_2fa_settings (admin_id, totp_secret, is_enabled, enabled_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [prior2fa.admin_id, prior2fa.totp_secret, prior2fa.is_enabled, prior2fa.enabled_at]
        );
      }
    }
  }
}

async function testE_rateLimitsConfigured() {
  try {
    const config = (await import('../src/config/index.js')).default;
    assert(config.rateLimits.adminLoginMax > 0, 'admin login limit');
    assert(config.rateLimits.twoFactorVerifyMax > 0, '2fa verify limit');
    assert(config.rateLimits.cashoutStatusMax > 0, 'cashout status limit');
    assert(config.rateLimits.sensitiveActionMax > 0, 'sensitive action limit');
    assert(config.jwt.adminExpiresIn, 'admin JWT TTL configured');
    assert(config.jwt.traderExpiresIn, 'trader JWT TTL configured');
    pass('Test E — rate limits / JWT config', `adminTTL=${config.jwt.adminExpiresIn}, traderTTL=${config.jwt.traderExpiresIn}`);
  } catch (e) {
    fail('Test E — rate limits / JWT config', e);
  }
}

console.log('Phase 2H-2 runtime security tests\n');
await testA_admin2faFlow();
await testB_totpEncryption();
await testC_cashoutStatusAuth();
await testD_adminRefundGuard();
await testE_rateLimitsConfigured();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- Summary ---\n${results.length - failed} passed, ${failed} failed`);
await pool.end();
process.exit(failed ? 1 : 0);
