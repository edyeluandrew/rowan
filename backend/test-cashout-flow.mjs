import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import StellarSdk from '@stellar/stellar-sdk';

dotenv.config();

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('FAIL  Missing DATABASE_URL');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('FAIL  Missing JWT_SECRET');
  process.exit(1);
}

const FLOW_TRADER_EMAIL = process.env.TEST_TRADER_EMAIL || 'test.trader.flow@rowan.local';
const FLOW_TRADER_PASSWORD = process.env.TEST_TRADER_PASSWORD || 'TestFlow123!@#';
const FLOW_TRADER_NAME = process.env.TEST_TRADER_NAME || 'Edyelu Andrew';
const FLOW_TRADER_PHONE = process.env.TEST_TRADER_PHONE || '+256704888999';
const FLOW_TRADER_STELLAR =
  process.env.TEST_TRADER_STELLAR_ADDRESS ||
  process.env.MARKET_MAKER_PUBLIC_KEY ||
  'GCKSEJOEMXEGHE675YMWSGFI2LX7XX6DBBJ7IWN3QN2N7645EYLV2LRF';

const API_BASE = (process.env.SMOKE_API_URL || process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const DEFAULT_ESCROW = process.env.ESCROW_PUBLIC_KEY || FLOW_TRADER_STELLAR;
const RESULTS = [];
const CLEANUP = {
  userIds: [],
  quoteIds: [],
  txIds: [],
  disputeIds: [],
};

function buildDbConfig() {
  const connectionString = process.env.DATABASE_URL;
  const isLocal =
    connectionString.includes('@localhost') ||
    connectionString.includes('@127.0.0.1') ||
    connectionString.includes('localhost:5432') ||
    connectionString.includes('127.0.0.1:5432');

  return {
    connectionString,
    connectionTimeoutMillis: 10000,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  };
}

function record(status, name, detail = '') {
  RESULTS.push({ status, name, detail });
  const prefix = status === 'pass' ? 'PASS ' : status === 'skip' ? 'SKIP ' : 'FAIL ';
  console.log(`${prefix} ${name}${detail ? ` - ${detail}` : ''}`);
}

function pass(name, detail = '') {
  record('pass', name, detail);
}

function skip(name, detail = '') {
  record('skip', name, detail);
}

function fail(name, err) {
  record('fail', name, err?.message || String(err));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function uniqueLabel(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function chooseFiatAmount(minAmount, maxAmount, preferred = 25000) {
  const min = Number(minAmount) || preferred;
  const max = Number(maxAmount) || preferred;
  return Math.max(min, Math.min(preferred, max));
}

function createToken(subject, role) {
  const expiresIn =
    role === 'admin'
      ? (process.env.JWT_ADMIN_EXPIRES_IN || '1h')
      : role === 'trader'
        ? (process.env.JWT_TRADER_EXPIRES_IN || '7d')
        : (process.env.JWT_EXPIRES_IN || '7d');
  return jwt.sign(
    { sub: subject, role, deviceId: 'smoke-script' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn }
  );
}

async function fetchJson(pathname, { method = 'GET', token = null, body = null, headers = {}, timeoutMs = 30000 } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  return { status: res.status, ok: res.ok, body: json };
}

async function ensureFlowTrader(client) {
  const passwordHash = await bcrypt.hash(FLOW_TRADER_PASSWORD, 12);
  const networks = [
    { network: 'AIRTEL_UG', currency: 'UGX', country: 'UG' },
    { network: 'MTN_UG', currency: 'UGX', country: 'UG' },
  ];
  const floatAmount = 5_000_000;
  const minAmount = 20_000;
  const maxAmount = 550_000;

  const existing = await client.query(`SELECT id FROM traders WHERE email = $1`, [FLOW_TRADER_EMAIL]);
  let traderId;

  if (existing.rows[0]) {
    traderId = existing.rows[0].id;
    await client.query(
      `UPDATE traders SET
         name = $1,
         password_hash = $2,
         stellar_address = $3,
         status = 'ACTIVE',
         verification_status = 'VERIFIED',
         is_active = TRUE,
         is_suspended = FALSE,
         trust_score = 100,
         daily_limit_ugx = 100000000,
         float_ugx = $4,
         updated_at = NOW()
       WHERE id = $5`,
      [FLOW_TRADER_NAME, passwordHash, FLOW_TRADER_STELLAR, floatAmount, traderId]
    );
  } else {
    const created = await client.query(
      `INSERT INTO traders (
         name, email, password_hash, stellar_address,
         status, verification_status, is_active, is_suspended, trust_score,
         daily_limit_ugx, daily_volume, float_ugx, float_kes, float_tzs,
         networks, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         'ACTIVE', 'VERIFIED', TRUE, FALSE, 100,
         100000000, 0, $5, 0, 0,
         $6::text[], NOW(), NOW()
       ) RETURNING id`,
      [FLOW_TRADER_NAME, FLOW_TRADER_EMAIL, passwordHash, FLOW_TRADER_STELLAR, floatAmount, networks.map((n) => n.network)]
    );
    traderId = created.rows[0].id;
  }

  for (const { network, currency, country } of networks) {
    await client.query(
      `INSERT INTO trader_payout_settings (
         trader_id, country, network, currency,
         min_amount, max_amount, available_float, reserved_float, is_active,
         ad_side, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, TRUE, 'USER_SELL', NOW(), NOW())
       ON CONFLICT (trader_id, network, currency, ad_side) DO UPDATE SET
         available_float = GREATEST(trader_payout_settings.available_float, EXCLUDED.available_float),
         reserved_float = 0,
         is_active = TRUE,
         ad_side = 'USER_SELL',
         min_amount = EXCLUDED.min_amount,
         max_amount = EXCLUDED.max_amount,
         updated_at = NOW()`,
      [traderId, country, network, currency, minAmount, maxAmount, floatAmount]
    );
  }

  return traderId;
}

async function createSmokeUser(client) {
  const keypair = StellarSdk.Keypair.random();
  const phone = `+25670${String(Date.now()).slice(-7)}`;
  const phoneHash = sha256(phone);
  const result = await client.query(
    `INSERT INTO users (
       stellar_address, phone_hash, role, is_active, device_id,
       daily_limit, per_tx_limit, daily_limit_ugx, created_at, updated_at
     ) VALUES ($1, $2, 'user', TRUE, 'smoke-script', $3, $4, $5, NOW(), NOW())
     RETURNING id`,
    [keypair.publicKey(), phoneHash, 100000, 100000, 1000000000]
  );
  const userId = result.rows[0].id;
  CLEANUP.userIds.push(userId);
  return {
    id: userId,
    phone,
    phoneHash,
    token: createToken(userId, 'user'),
  };
}

async function getAdminToken(client) {
  const result = await client.query(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY created_at ASC LIMIT 1`
  );
  assert(result.rows[0], 'No active admin user found');
  return createToken(result.rows[0].id, 'admin');
}

async function getTraderToken(client, traderId) {
  const result = await client.query(
    `SELECT id FROM traders WHERE id = $1 AND is_active = TRUE AND is_suspended = FALSE`,
    [traderId]
  );
  assert(result.rows[0], 'Flow trader is not active');
  return createToken(result.rows[0].id, 'trader');
}

async function createSyntheticSellTransaction(client, {
  userId,
  phoneHash,
  traderId,
  payoutSettingId,
  network,
  fiatAmount,
  fiatCurrency,
  lockedRate,
}) {
  const quoteMemo = uniqueLabel('ROWAN-SMOKE');
  const quoteId = (
    await client.query(
      `INSERT INTO quotes (
         user_id, xlm_amount, fiat_currency, market_rate, user_rate, fiat_amount,
         platform_fee, network, phone_hash, memo, escrow_address, expires_at,
         payout_phone, payout_name, preferred_payout_setting_id, status, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, NOW() + INTERVAL '30 minutes',
         $12, $13, $14, 'PENDING', NOW()
       ) RETURNING id`,
      [
        userId,
        10,
        fiatCurrency,
        lockedRate,
        lockedRate,
        fiatAmount,
        0,
        network,
        phoneHash,
        quoteMemo,
        DEFAULT_ESCROW,
        FLOW_TRADER_PHONE,
        'Smoke Wallet User',
        payoutSettingId,
      ]
    )
  ).rows[0].id;

  CLEANUP.quoteIds.push(quoteId);

  const transactionId = (
    await client.query(
      `INSERT INTO transactions (
         quote_id, user_id, trader_id, payout_setting_id,
         xlm_amount, usdc_amount, fiat_amount, fiat_currency, network, phone_hash,
         state, locked_rate, quote_confirmed_at, escrow_locked_at, trader_matched_at,
         fiat_payout_submitted_at, stellar_deposit_tx, stellar_swap_tx,
         preferred_payout_setting_id, order_side, payout_reference,
         payout_phone, payout_name, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8, $9, $10,
         'FIAT_PAYOUT_SUBMITTED', $11, NOW(), NOW(), NOW(),
         NOW(), $12, $13,
         $14, 'SELL', $15,
         $16, $17, NOW(), NOW()
       ) RETURNING id`,
      [
        quoteId,
        userId,
        traderId,
        payoutSettingId,
        10,
        2.5,
        fiatAmount,
        fiatCurrency,
        network,
        phoneHash,
        lockedRate,
        uniqueLabel('smoke-deposit'),
        uniqueLabel('smoke-swap'),
        payoutSettingId,
        uniqueLabel('SMOKE-PAYOUT'),
        FLOW_TRADER_PHONE,
        'Smoke Wallet User',
      ]
    )
  ).rows[0].id;

  CLEANUP.txIds.push(transactionId);
  return { quoteId, transactionId };
}

async function cleanupArtifacts(client) {
  if (CLEANUP.txIds.length > 0) {
    await client.query(`DELETE FROM trader_inapp_notifications WHERE transaction_id = ANY($1::uuid[])`, [CLEANUP.txIds]).catch(() => {});
    await client.query(`DELETE FROM notifications WHERE transaction_id = ANY($1::uuid[])`, [CLEANUP.txIds]).catch(() => {});
    await client.query(`DELETE FROM audit_logs WHERE resource_id = ANY($1::uuid[])`, [CLEANUP.txIds]).catch(() => {});
  }

  if (CLEANUP.disputeIds.length > 0) {
    await client.query(`DELETE FROM audit_logs WHERE resource_id = ANY($1::uuid[])`, [CLEANUP.disputeIds]).catch(() => {});
    await client.query(`DELETE FROM disputes WHERE id = ANY($1::uuid[])`, [CLEANUP.disputeIds]).catch(() => {});
  }

  if (CLEANUP.txIds.length > 0) {
    await client.query(`DELETE FROM transactions WHERE id = ANY($1::uuid[])`, [CLEANUP.txIds]).catch(() => {});
  }

  if (CLEANUP.quoteIds.length > 0) {
    await client.query(`DELETE FROM quotes WHERE id = ANY($1::uuid[])`, [CLEANUP.quoteIds]).catch(() => {});
  }

  if (CLEANUP.userIds.length > 0) {
    await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [CLEANUP.userIds]).catch(() => {});
  }
}

async function main() {
  const client = new Client(buildDbConfig());
  console.log('\nMVP1 smoke test\n');
  console.log(`API: ${API_BASE}`);
  console.log(`Flow trader: ${FLOW_TRADER_EMAIL}\n`);

  let smokeUser = null;

  try {
    await client.connect();

    let flowTraderId = null;
    try {
      flowTraderId = await ensureFlowTrader(client);
      pass('Flow trader ready', FLOW_TRADER_EMAIL);
    } catch (err) {
      fail('Flow trader ready', err);
      throw err;
    }

    smokeUser = await createSmokeUser(client);
    const adminToken = await getAdminToken(client);
    const traderToken = await getTraderToken(client, flowTraderId);

    let configBody = null;
    try {
      const res = await fetchJson('/health');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body?.status === 'ok', 'Health body did not report ok');
      pass('Health endpoint', 'status ok');
    } catch (err) {
      fail('Health endpoint', err);
    }

    try {
      const res = await fetchJson('/api/v1/config/cashout-limits');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body?.data?.tradeTiming?.typicalCompleteMinutes != null, 'tradeTiming.typicalCompleteMinutes missing');
      configBody = res.body.data;
      pass('Cashout config', `typical trade ${res.body.data.tradeTiming.typicalCompleteMinutes} min`);
    } catch (err) {
      fail('Cashout config', err);
    }

    let sellAds = [];
    let manualSellOffer = null;
    let wrongNetwork = null;

    try {
      const res = await fetchJson('/api/v1/traders/ads?grouped=true', { token: smokeUser.token });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      sellAds = res.body?.traders || [];
      assert(sellAds.length > 0, 'No sell marketplace traders returned');
      const flattenedOffers = sellAds.flatMap((trader) =>
        (trader.offers || []).map((offer) => ({ ...offer, traderId: trader.traderId }))
      );
      manualSellOffer =
        flattenedOffers.find((offer) => offer.traderId === flowTraderId) ||
        flattenedOffers[0];
      assert(manualSellOffer, 'No sell offer found');
      wrongNetwork = flattenedOffers.find((offer) => offer.network !== manualSellOffer.network)?.network || null;
      pass('Sell marketplace grouped ads', `${sellAds.length} trader card(s)`);
    } catch (err) {
      fail('Sell marketplace grouped ads', err);
    }

    let manualSellQuote = null;
    if (manualSellOffer) {
      try {
        const fiatAmount = chooseFiatAmount(manualSellOffer.minAmount, manualSellOffer.maxAmount);
        const res = await fetchJson('/api/v1/cashout/quote', {
          method: 'POST',
          token: smokeUser.token,
          body: {
            fiatAmount,
            network: manualSellOffer.network,
            phoneHash: smokeUser.phoneHash,
            payoutPhone: smokeUser.phone,
            payoutName: 'Smoke Wallet User',
            payoutSettingId: manualSellOffer.payoutSettingId,
          },
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body?.quoteId, 'quoteId missing');
        assert(res.body?.payoutSettingId === manualSellOffer.payoutSettingId, 'Manual payoutSettingId not preserved');
        CLEANUP.quoteIds.push(res.body.quoteId);
        manualSellQuote = res.body;
        pass('Manual sell quote', `${manualSellOffer.network} via chosen trader`);
      } catch (err) {
        fail('Manual sell quote', err);
      }

      try {
        const fiatAmount = chooseFiatAmount(manualSellOffer.minAmount, manualSellOffer.maxAmount);
        const res = await fetchJson('/api/v1/cashout/quote', {
          method: 'POST',
          token: smokeUser.token,
          body: {
            fiatAmount,
            network: manualSellOffer.network,
            phoneHash: smokeUser.phoneHash,
            payoutPhone: smokeUser.phone,
            payoutName: 'Smoke Wallet User',
          },
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body?.quoteId, 'quoteId missing');
        assert(!res.body?.payoutSettingId, 'Express quote unexpectedly tied to a payout setting');
        CLEANUP.quoteIds.push(res.body.quoteId);
        pass('Express sell quote', manualSellOffer.network);
      } catch (err) {
        fail('Express sell quote', err);
      }

      if (wrongNetwork) {
        try {
          const fiatAmount = chooseFiatAmount(manualSellOffer.minAmount, manualSellOffer.maxAmount);
          const res = await fetchJson('/api/v1/cashout/quote', {
            method: 'POST',
            token: smokeUser.token,
            body: {
              fiatAmount,
              network: wrongNetwork,
              phoneHash: smokeUser.phoneHash,
              payoutPhone: smokeUser.phone,
              payoutName: 'Smoke Wallet User',
              payoutSettingId: manualSellOffer.payoutSettingId,
            },
          });
          assert(res.status >= 400, `Expected error status, got ${res.status}`);
          const errorText = `${res.body?.error || ''} ${res.body?.message || ''}`.toLowerCase();
          assert(
            errorText.includes('support this network') || errorText.includes('not support this network'),
            `Unexpected error: ${res.body?.error || JSON.stringify(res.body)}`
          );
          pass('Manual sell wrong-network guard', wrongNetwork);
        } catch (err) {
          fail('Manual sell wrong-network guard', err);
        }
      } else {
        skip('Manual sell wrong-network guard', 'No alternate active sell network available in marketplace');
      }
    }

    let buyOffer = null;
    try {
      const res = await fetchJson('/api/v1/traders/ads?side=buy&grouped=true', { token: smokeUser.token });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const buyAds = res.body?.traders || [];
      assert(buyAds.length > 0, 'No buy marketplace traders returned');
      buyOffer = buyAds.flatMap((trader) => trader.offers || [])[0];
      assert(buyOffer, 'No buy offer found');
      pass('Buy marketplace grouped ads', `${buyAds.length} trader card(s)`);
    } catch (err) {
      fail('Buy marketplace grouped ads', err);
    }

    if (buyOffer) {
      try {
        const fiatAmount = chooseFiatAmount(buyOffer.minAmount, buyOffer.maxAmount);
        const res = await fetchJson('/api/v1/buy/quote', {
          method: 'POST',
          token: smokeUser.token,
          body: {
            fiatAmount,
            network: buyOffer.network,
            phoneHash: smokeUser.phoneHash,
            payoutSettingId: buyOffer.payoutSettingId,
          },
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body?.quoteId, 'quoteId missing');
        assert(res.body?.orderSide === 'BUY', 'orderSide BUY missing');
        CLEANUP.quoteIds.push(res.body.quoteId);
        pass('Manual buy quote', `${buyOffer.network} via chosen trader`);
      } catch (err) {
        fail('Manual buy quote', err);
      }
    }

    try {
      const res = await fetchJson('/api/v1/admin/overview', { token: adminToken });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body?.stats, 'stats missing');
      assert(Array.isArray(res.body?.alerts), 'alerts missing');
      pass('Admin overview', `${res.body.alerts.length} alert(s)`);
    } catch (err) {
      fail('Admin overview', err);
    }

    try {
      const res = await fetchJson('/api/v1/admin/transactions?state=FIAT_PAYOUT_SUBMITTED&stuckPayoutOnly=true', {
        token: adminToken,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body?.transactions), 'transactions array missing');
      assert(typeof res.body?.page === 'number', 'page missing');
      assert(typeof res.body?.pages === 'number', 'pages missing');
      pass('Admin stuck payout queue', `${res.body.transactions.length} row(s)`);
    } catch (err) {
      fail('Admin stuck payout queue', err);
    }

    if (manualSellOffer && manualSellQuote) {
      try {
        const { transactionId } = await createSyntheticSellTransaction(client, {
          userId: smokeUser.id,
          phoneHash: smokeUser.phoneHash,
          traderId: flowTraderId,
          payoutSettingId: manualSellOffer.payoutSettingId,
          network: manualSellOffer.network,
          fiatAmount: manualSellQuote.fiatAmount,
          fiatCurrency: manualSellQuote.fiatCurrency,
          lockedRate: manualSellQuote.userRate,
        });

        const openRes = await fetchJson('/api/v1/disputes', {
          method: 'POST',
          token: smokeUser.token,
          body: {
            transactionId,
            reason: 'Smoke dispute: user did not receive mobile money.',
          },
        });
        assert(openRes.status === 201, `Expected 201, got ${openRes.status}`);
        assert(openRes.body?.dispute?.id, 'dispute id missing');
        const disputeId = openRes.body.dispute.id;
        CLEANUP.disputeIds.push(disputeId);
        pass('User dispute open', disputeId.slice(0, 8));

        const userDetailRes = await fetchJson(`/api/v1/disputes/${disputeId}`, { token: smokeUser.token });
        assert(userDetailRes.status === 200, `Expected 200, got ${userDetailRes.status}`);
        assert(userDetailRes.body?.dispute?.transactionState || userDetailRes.body?.dispute?.transaction_state, 'transaction state missing');
        pass('User dispute detail', userDetailRes.body.dispute.status);

        const traderRespondRes = await fetchJson(`/api/v1/trader/disputes/${disputeId}/respond`, {
          method: 'POST',
          token: traderToken,
          body: {
            responseText: 'Smoke trader response: payout reference was already sent.',
          },
        });
        assert(traderRespondRes.status === 200, `Expected 200, got ${traderRespondRes.status}`);
        assert(traderRespondRes.body?.dispute?.status === 'TRADER_RESPONDED', 'Trader response did not update dispute status');
        pass('Trader dispute response', 'TRADER_RESPONDED');

        const traderDetailRes = await fetchJson(`/api/v1/trader/disputes/${disputeId}`, { token: traderToken });
        assert(traderDetailRes.status === 200, `Expected 200, got ${traderDetailRes.status}`);
        assert(
          traderDetailRes.body?.dispute?.traderResponse || traderDetailRes.body?.dispute?.trader_response,
          'trader response text missing'
        );
        pass('Trader dispute detail contract', traderDetailRes.body.dispute.status);

        const adminDetailRes = await fetchJson(`/api/v1/admin/disputes/${disputeId}`, { token: adminToken });
        assert(adminDetailRes.status === 200, `Expected 200, got ${adminDetailRes.status}`);
        assert(Array.isArray(adminDetailRes.body?.dispute?.timeline), 'timeline missing');
        assert(Array.isArray(adminDetailRes.body?.dispute?.notes), 'notes missing');
        assert(adminDetailRes.body?.dispute?.priority, 'priority missing');
        pass('Admin dispute detail contract', adminDetailRes.body.dispute.priority);

        const adminEvidenceRes = await fetchJson(`/api/v1/admin/disputes/${disputeId}/evidence`, { token: adminToken });
        assert(adminEvidenceRes.status === 200, `Expected 200, got ${adminEvidenceRes.status}`);
        assert(Array.isArray(adminEvidenceRes.body?.evidence), 'evidence array missing');
        pass('Admin dispute evidence route', `${adminEvidenceRes.body.evidence.length} file(s)`);

        const adminListRes = await fetchJson(`/api/v1/admin/disputes?search=${encodeURIComponent(disputeId)}`, { token: adminToken });
        assert(adminListRes.status === 200, `Expected 200, got ${adminListRes.status}`);
        assert((adminListRes.body?.disputes || []).some((dispute) => dispute.id === disputeId), 'search did not return dispute');
        pass('Admin dispute search filter', 'dispute found');
      } catch (err) {
        fail('Dispute contract smoke', err);
      }
    }

    if (configBody?.tradeTiming?.typicalCompleteMinutes != null) {
      const completed = RESULTS.filter((result) => result.status === 'pass').length;
      pass('Trade timing config present', `${configBody.tradeTiming.typicalCompleteMinutes} min typical, ${completed} checks passed so far`);
    }
  } catch (err) {
    console.error(`\nFatal smoke error: ${err.message}`);
  } finally {
    await cleanupArtifacts(client).catch(() => {});
    await client.end().catch(() => {});

    const passed = RESULTS.filter((result) => result.status === 'pass').length;
    const failed = RESULTS.filter((result) => result.status === 'fail').length;
    const skipped = RESULTS.filter((result) => result.status === 'skip').length;

    console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log('Command: node test-cashout-flow.mjs');
    if (failed > 0) process.exit(1);
  }
}

main();
