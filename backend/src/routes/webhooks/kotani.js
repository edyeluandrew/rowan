import { Router } from 'express';
import logger from '../../utils/logger.js';
import db from '../../db/index.js';
import kotaniPayProvider from '../../services/payments/providers/kotaniPayProvider.js';
import notificationService from '../../services/notificationService.js';

const router = Router();

const SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PROCESSED', 'COMPLETE']);

function extractReferenceFromPayload(payload) {
  return payload?.referenceId
    || payload?.reference_id
    || null;
}

function isSuccessPayload(payload) {
  const status = String(payload?.status || '').toUpperCase();
  return SUCCESS_STATUSES.has(status);
}

/**
 * POST /api/v1/webhooks/kotani
 * Kotani Pay offramp/onramp callback (callbackUrl from create offramp).
 */
router.post('/kotani', async (req, res) => {
  const signature = req.headers['x-signature'] || req.headers['x-kotani-signature'] || '';

  if (!kotaniPayProvider.verifyWebhookSignature(req.body, signature)) {
    logger.warn('[KotaniWebhook] invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const normalized = kotaniPayProvider.normalizeWebhookPayload(req.body);
  const { eventType, payload } = normalized;
  const referenceId = extractReferenceFromPayload(payload);

  logger.info('[KotaniWebhook] received', {
    eventType,
    referenceId,
    status: payload?.status,
    signed: normalized.signed,
  });

  if (!referenceId) {
    return res.json({ status: 'ok', received: true, note: 'no reference' });
  }

  try {
    const txResult = await db.query(
      `SELECT id, state, user_id, payout_provider FROM transactions WHERE aggregator_ref = $1 LIMIT 1`,
      [referenceId]
    );
    const tx = txResult.rows[0];

    if (!tx) {
      return res.json({ status: 'ok', received: true, referenceId, matched: false });
    }

    if (isSuccessPayload(payload) && tx.state === 'FIAT_PAYOUT_SUBMITTED') {
      await notificationService.notifyUser(tx.user_id, 'aggregator_payout_delivered', {
        transactionId: tx.id,
        provider: 'kotani_pay',
        message: 'Your mobile money payment was delivered. Please confirm receipt in Rowan.',
      }).catch(() => {});

      notificationService.createNotification(
        tx.user_id,
        'user',
        'aggregator_payout_delivered',
        'Payment delivered',
        'Kotani Pay confirmed your payout. Open Rowan and confirm you received it.',
        tx.id
      ).catch(() => {});
    }

    res.json({
      status: 'ok',
      received: true,
      referenceId,
      transactionId: tx.id,
      transactionState: tx.state,
    });
  } catch (err) {
    logger.error('[KotaniWebhook] handler error', { message: err.message, referenceId });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
