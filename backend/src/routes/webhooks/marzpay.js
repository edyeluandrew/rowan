import { Router } from 'express';
import logger from '../../utils/logger.js';
import db from '../../db/index.js';
import marzPayProvider from '../../services/payments/providers/marzPayProvider.js';
import { getSendMoney, marzPayIsMock } from '../../services/utilities/marzPayClient.js';
import escrowController from '../../services/escrowController.js';
import notificationService from '../../services/notificationService.js';

const router = Router();

function extractReference(event) {
  return event.transaction?.reference
    || event.reference
    || event.data?.transaction?.reference
    || event.data?.reference
    || null;
}

function extractProviderUuid(event) {
  return event.transaction?.uuid
    || event.data?.transaction?.uuid
    || null;
}

function eventTypeOf(event) {
  return String(event.event_type || event.type || event.event || '').toLowerCase();
}

function statusOf(event) {
  return String(
    event.transaction?.status
    || event.data?.transaction?.status
    || event.status
    || ''
  ).toLowerCase();
}

async function independentlyConfirm(providerUuid, ourRef) {
  if (marzPayIsMock()) return true;
  const id = providerUuid || ourRef;
  if (!id) return false;
  try {
    const body = await getSendMoney(id);
    const status = String(
      body?.data?.transaction?.status
      || body?.data?.status
      || body?.status
      || ''
    ).toLowerCase();
    return ['completed', 'success', 'successful'].includes(status);
  } catch (err) {
    logger.warn('[MarzPayWebhook] status poll failed', { id, message: err.message });
    return false;
  }
}

/**
 * POST /api/v1/webhooks/marzpay
 * Disbursement callbacks. Collections are ignored in this phase.
 */
router.post('/marzpay', async (req, res) => {
  const rawBody = req.rawBody
    || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  const timestamp = req.headers['x-marzpay-timestamp'] || '';
  const signatureHeader = req.headers['x-marzpay-signature'] || '';

  if (!marzPayProvider.verifyWebhookSignature({ rawBody, timestamp, signatureHeader })) {
    logger.warn('[MarzPayWebhook] invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const eventType = eventTypeOf(event);
  const referenceId = extractReference(event);
  const providerUuid = extractProviderUuid(event);

  logger.info('[MarzPayWebhook] received', { eventType, referenceId, providerUuid });

  if (eventType.startsWith('collection.')) {
    return res.json({ status: 'ok', received: true, eventType, ignored: 'onramp_not_enabled' });
  }

  if (!referenceId && !providerUuid) {
    return res.json({ status: 'ok', received: true, eventType, note: 'no reference' });
  }

  try {
    const txResult = await db.query(
      `SELECT id, state, user_id, payout_provider, stellar_release_tx
       FROM transactions
       WHERE payout_provider = 'marz_pay'
         AND (aggregator_ref = $1 OR payout_reference = $2 OR aggregator_ref = $2 OR payout_reference = $1)
       LIMIT 1`,
      [referenceId || '', providerUuid || '']
    );
    const tx = txResult.rows[0];

    if (!tx) {
      logger.warn('[MarzPayWebhook] no transaction for reference', { referenceId, providerUuid });
      return res.json({ status: 'ok', received: true, eventType, referenceId, matched: false });
    }

    const failed = eventType === 'disbursement.failed'
      || ['failed', 'cancelled', 'canceled'].includes(statusOf(event));
    const completed = eventType === 'disbursement.completed'
      || ['completed', 'success', 'successful'].includes(statusOf(event));

    if (failed && ['FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING', 'ESCROW_LOCKED'].includes(tx.state)) {
      const refund = await escrowController.refundOrphanTransaction(
        tx.id,
        'MarzPay disbursement failed'
      );
      notificationService.notifyUser(tx.user_id, 'aggregator_payout_failed', {
        transactionId: tx.id,
        provider: 'marz_pay',
        message: 'The mobile money payout could not be completed. Your USDC is being returned.',
      }).catch(() => {});
      logger.info('[MarzPayWebhook] disbursement failed — refund', {
        transactionId: tx.id,
        refund: refund?.status,
      });
      return res.json({ status: 'ok', received: true, eventType, transactionId: tx.id, refund: refund?.status });
    }

    if (completed && !tx.stellar_release_tx) {
      const confirmed = await independentlyConfirm(providerUuid, referenceId);
      if (!confirmed) {
        logger.warn('[MarzPayWebhook] completed event but status poll did not confirm', {
          transactionId: tx.id,
        });
        return res.status(503).json({ error: 'Status not independently confirmed' });
      }

      await escrowController.releaseToMarzPaySettlement(tx.id);

      notificationService.notifyUser(tx.user_id, 'aggregator_payout_delivered', {
        transactionId: tx.id,
        provider: 'marz_pay',
        message: 'Your mobile money was sent. USDC has been settled with MarzPay.',
      }).catch(() => {});

      notificationService.createNotification(
        tx.user_id,
        'user',
        'aggregator_payout_delivered',
        'Payment sent',
        'MarzPay confirmed your cash-out. The USDC has been settled.',
        tx.id
      ).catch(() => {});

      logger.info('[MarzPayWebhook] disbursement completed and settled', { transactionId: tx.id });
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
    logger.error('[MarzPayWebhook] handler error', { message: err.message, referenceId });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
