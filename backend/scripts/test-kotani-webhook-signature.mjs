/**
 * Smoke test for Kotani webhook HMAC verification (matches Kotani v3 docs).
 *
 * Usage:
 *   node scripts/test-kotani-webhook-signature.mjs
 */

import crypto from 'crypto';

process.env.KOTANI_PAY_API_KEY = 'test-key';
process.env.KOTANI_PAY_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.KOTANI_PAY_MOCK_MODE = 'false';

const { verifyWebhookSignature, normalizeWebhookPayload } = await import(
  '../src/services/payments/providers/kotaniPayProvider.js'
);

const secret = process.env.KOTANI_PAY_WEBHOOK_SECRET;
const payloadWithoutSignature = {
  event: 'transaction.offramp.status.updated',
  data: { referenceId: 'REF-123', status: 'SUCCESS' },
};
const signature = `sha256=${crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payloadWithoutSignature))
  .digest('hex')}`;
const body = { ...payloadWithoutSignature, signature };

const ok = verifyWebhookSignature(body, signature);
const bad = verifyWebhookSignature(body, 'sha256=deadbeef');
const normalized = normalizeWebhookPayload(body);

console.log('valid signature:', ok === true ? 'PASS' : 'FAIL');
console.log('invalid signature:', bad === false ? 'PASS' : 'FAIL');
console.log('normalized reference:', normalized.payload.referenceId === 'REF-123' ? 'PASS' : 'FAIL');

if (ok !== true || bad !== false || normalized.payload.referenceId !== 'REF-123') {
  process.exit(1);
}

console.log('All Kotani webhook signature checks passed.');
