import { Router } from 'express';
import logger from '../../utils/logger.js';
import db from '../../db/index.js';
import yellowPayProvider from '../../services/payments/providers/yellowPayProvider.js';
import notificationService from '../../services/notificationService.js';

const router = Router();

const COMPLETED_STATUSES = new Set(['COMPLETED', 'SUCCESS', 'SUCCESSFUL', 'PAID']);
const COMPLETED_EVENTS = new Set(['payout.completed', 'collection.completed', 'payment.completed']);

function extractReference(event) {
  return event.referenceId
    || event.reference
    || event.data?.referenceId
    || event.data?.reference
    || null;
}

function isCompletionEvent(event) {
  const eventType = String(event.type || event.event || '').toLowerCase();
  const status = String(event.status || event.data?.status || '').toUpperCase();
  return COMPLETED_EVENTS.has(eventType) || COMPLETED_STATUSES.has(status);
}

/**
 * POST /api/v1/webhooks/yellowpay
 * Yellow Card / Yellow Pay settlement webhooks (C5).
 */
router.post('/yellowpay', async (req, res) => {
  const signature = req.headers['x-yellow-signature'] || req.headers['x-signature'] || '';

  if (!yellowPayProvider.verifyWebhookSignature(req.body, signature)) {
    logger.warn('[YellowPayWebhook] invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body || {};
  const eventType = event.type || event.event || 'unknown';
  const referenceId = extractReference(event);

  logger.info('[YellowPayWebhook] received', { eventType, referenceId });

  if (!referenceId) {
    return res.json({ status: 'ok', received: true, eventType, note: 'no reference' });
  }

  try {
    const txResult = await db.query(
      `SELECT id, state, user_id, fiat_amount, fiat_currency, payout_provider
       FROM transactions
       WHERE aggregator_ref = $1
       LIMIT 1`,
      [referenceId]
    );
    const tx = txResult.rows[0];

    if (!tx) {
      logger.warn('[YellowPayWebhook] no transaction for reference', { referenceId });
      return res.json({ status: 'ok', received: true, eventType, referenceId, matched: false });
    }

    if (isCompletionEvent(event) && tx.state === 'FIAT_PAYOUT_SUBMITTED') {
      await notificationService.notifyUser(tx.user_id, 'aggregator_payout_delivered', {
        transactionId: tx.id,
        provider: 'yellow_pay',
        message: 'Your mobile money payment was delivered. Please confirm receipt in Rowan.',
      }).catch(() => {});

      notificationService.createNotification(
        tx.user_id,
        'user',
        'aggregator_payout_delivered',
        'Payment delivered',
        'Yellow Pay confirmed your payout. Open Rowan and confirm you received it.',
        tx.id
      ).catch(() => {});

      logger.info('[YellowPayWebhook] payout completed for tx', { transactionId: tx.id, referenceId });
    }

    res.json({
      status: 'ok',
      received: true,
      eventType,
      referenceId,
      transactionId: tx.id,
      transactionState: tx.state,
    });
  } catch (err) {
    logger.error('[YellowPayWebhook] handler error', { message: err.message, referenceId });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
