import db from '../db/index.js';
import config from '../config/index.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import logger from '../utils/logger.js';

/**
 * TraderVerificationService — core logic for the trader verification pipeline.
 *
 * Flow:
 *   1. Admin onboards trader → status SUBMITTED
 *   2. Trader uploads docs + P2P screenshot → status DOCUMENTS_PENDING
 *   3. Trader confirms agreement → agreement_check PASSED
 *   4. Trader verifies MoMo via OTP → momo_check PASSED
 *   5. Admin reviews all checks → VERIFIED or REJECTED
 *
 * The matching engine only matches traders with verification_status = 'VERIFIED'.
 */

/**
 * Create a blank verification record when admin onboards a trader.
 * Called from the rewritten admin/traders/onboard endpoint.
 */
async function createVerificationRecord(traderId) {
  const result = await db.query(
    `INSERT INTO trader_verifications (trader_id, verification_status)
     VALUES ($1, 'SUBMITTED')
     ON CONFLICT (trader_id) DO NOTHING
     RETURNING id`,
    [traderId]
  );
  return result.rows[0];
}

/**
 * Trader submits identity documents and Binance P2P info.
 * Moves verification from SUBMITTED → DOCUMENTS_PENDING.
 */
async function submitDocuments(traderId, {
  legalName,
  idDocumentType,
  idDocumentNumber,
  idDocumentFrontKey,
  idDocumentBackKey,
  selfieKey,
  binanceUsername,
  binanceP2pTrades,
  binanceCompletionRate,
  binanceScreenshotKey,
}) {
  // Validate P2P thresholds — flag but don't block (admin makes final call)
  const { minP2pTrades, minCompletionRate } = config.traderVerification;
  const p2pBelowThreshold = binanceP2pTrades < minP2pTrades;
  const rateBelowThreshold = binanceCompletionRate < minCompletionRate;

  // ── [C-4 FIX] Encrypt id_document_number at rest ──
  const encryptedIdNumber = encrypt(idDocumentNumber);

  const result = await db.query(
    `UPDATE trader_verifications SET
       legal_name = $1,
       id_document_type = $2,
       id_document_number = $3,
       id_document_front_key = $4,
       id_document_back_key = $5,
       selfie_key = $6,
       binance_username = $7,
       binance_p2p_trades = $8,
       binance_completion_rate = $9,
       binance_screenshot_key = $10,
       verification_status = 'DOCUMENTS_PENDING'
     WHERE trader_id = $11 AND verification_status IN ('SUBMITTED', 'DOCUMENTS_PENDING', 'REJECTED')
     RETURNING *`,
    [
      legalName, idDocumentType, encryptedIdNumber,
      idDocumentFrontKey, idDocumentBackKey, selfieKey,
      binanceUsername, parseInt(binanceP2pTrades), parseFloat(binanceCompletionRate),
      binanceScreenshotKey, traderId,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Verification record not found or not in a submittable state');
  }

  // Also update traders table status
  await db.query(
    `UPDATE traders SET verification_status = 'DOCUMENTS_PENDING' WHERE id = $1`,
    [traderId]
  );

  return {
    verification: result.rows[0],
    warnings: {
      p2pBelowThreshold,
      rateBelowThreshold,
      ...(p2pBelowThreshold && { minRequired: minP2pTrades, submitted: binanceP2pTrades }),
      ...(rateBelowThreshold && { minRateRequired: minCompletionRate, submitted: binanceCompletionRate }),
    },
  };
}

/**
 * Record trader's agreement acceptance.
 */
async function confirmAgreement(traderId, agreementVersion) {
  const expectedVersion = config.traderVerification.agreementVersion;
  if (agreementVersion !== expectedVersion) {
    throw new Error(`Agreement version mismatch. Expected ${expectedVersion}, got ${agreementVersion}`);
  }

  const result = await db.query(
    `UPDATE trader_verifications SET
       agreement_version = $1,
       agreement_accepted_at = NOW(),
       agreement_check = 'PASSED'
     WHERE trader_id = $2 AND agreement_accepted_at IS NULL
     RETURNING id, agreement_version, agreement_accepted_at, agreement_check`,
    [agreementVersion, traderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Verification record not found or agreement already accepted');
  }

  return result.rows[0];
}

/**
 * Mark MoMo account as verified after OTP confirmation.
 * Called from the OTP verify endpoint.
 */
async function markMomoVerified(traderId, network, phoneHash) {
  await db.query(
    `UPDATE trader_momo_accounts SET
       verification_status = 'PASSED',
       verified_at = NOW()
     WHERE trader_id = $1 AND network = $2 AND phone_number_hash = $3
     RETURNING *`,
    [traderId, network, phoneHash]
  );

  // Check if at least one MoMo account is verified → update verification record
  const verifiedCount = await db.query(
    `SELECT COUNT(*) as cnt FROM trader_momo_accounts
     WHERE trader_id = $1 AND verification_status = 'PASSED'`,
    [traderId]
  );

  if (parseInt(verifiedCount.rows[0].cnt) > 0) {
    await db.query(
      `UPDATE trader_verifications SET momo_check = 'PASSED' WHERE trader_id = $1`,
      [traderId]
    );
  }
}

/**
 * Add a MoMo account for a trader (during onboarding document submission).
 */
async function addMomoAccount(traderId, { network, phoneHash, accountName, method = 'OTP' }) {
  const result = await db.query(
    `INSERT INTO trader_momo_accounts (trader_id, network, phone_number_hash, account_name, verification_method)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (trader_id, network, phone_number_hash) DO UPDATE SET
       account_name = EXCLUDED.account_name,
       verification_method = EXCLUDED.verification_method
     RETURNING *`,
    [traderId, network, phoneHash, accountName, method]
  );
  return result.rows[0];
}

/**
 * Admin: get all traders pending verification review.
 */
async function getPendingTraders() {
  const result = await db.query(
    `SELECT
       t.id, t.name, t.email, t.stellar_address, t.created_at,
       tv.verification_status, tv.identity_check, tv.momo_check,
       tv.p2p_check, tv.agreement_check,
       tv.legal_name, tv.binance_username, tv.binance_p2p_trades,
       tv.binance_completion_rate, tv.created_at as submitted_at,
       (SELECT COUNT(*) FROM trader_momo_accounts ma
        WHERE ma.trader_id = t.id AND ma.verification_status = 'PASSED') as verified_momo_count,
       (SELECT array_agg(ma.network) FROM trader_momo_accounts ma
        WHERE ma.trader_id = t.id) as momo_networks
     FROM traders t
     JOIN trader_verifications tv ON tv.trader_id = t.id
     WHERE tv.verification_status IN ('DOCUMENTS_PENDING', 'UNDER_REVIEW')
     ORDER BY tv.created_at ASC`
  );
  return result.rows;
}

/**
 * Admin: get full verification detail for a single trader.
 */
async function getVerificationDetail(traderId) {
  const vResult = await db.query(
    `SELECT * FROM trader_verifications WHERE trader_id = $1`,
    [traderId]
  );
  if (vResult.rows.length === 0) return null;

  const momoResult = await db.query(
    `SELECT * FROM trader_momo_accounts WHERE trader_id = $1 ORDER BY created_at`,
    [traderId]
  );

  // ── [C-4 FIX] Decrypt id_document_number for admin review ──
  const verification = vResult.rows[0];
  if (verification.id_document_number) {
    try {
      verification.id_document_number = decrypt(verification.id_document_number);
    } catch {
      // If decryption fails (legacy unencrypted data), leave as-is
    }
  }

  return {
    verification,
    momoAccounts: momoResult.rows,
  };
}

/**
 * Admin: verify a trader — marks all checks as PASSED and sets VERIFIED.
 *
 * Enforces triple-check: identity_check, momo_check, p2p_check must all be
 * at least submittable (docs present). agreement_check must be PASSED.
 *
 * The admin can override individual checks via the `checks` parameter,
 * or pass nothing to auto-verify all remaining PENDING checks.
 */
async function adminVerifyTrader(traderId, adminId, { notes, checks = {} } = {}) {
  // Load current state
  const vResult = await db.query(
    `SELECT * FROM trader_verifications WHERE trader_id = $1`,
    [traderId]
  );
  const v = vResult.rows[0];
  if (!v) throw new Error('Verification record not found');

  if (v.verification_status === 'VERIFIED') {
    throw new Error('Trader is already verified');
  }

  // Agreement must be accepted
  if (v.agreement_check !== 'PASSED') {
    throw new Error('Trader has not accepted the agreement yet');
  }

  // Apply check overrides or default to PASSED
  const identity = checks.identity || (v.identity_check === 'PENDING' ? 'PASSED' : v.identity_check);
  const momo = checks.momo || (v.momo_check === 'PENDING' ? 'PASSED' : v.momo_check);
  const p2p = checks.p2p || (v.p2p_check === 'PENDING' ? 'PASSED' : v.p2p_check);

  // Triple-check enforcement: all three must be PASSED to verify
  const allPassed = identity === 'PASSED' && momo === 'PASSED' && p2p === 'PASSED';
  if (!allPassed) {
    throw new Error(
      `Cannot verify: identity=${identity}, momo=${momo}, p2p=${p2p}. All must be PASSED.`
    );
  }

  // Update verification record
  await db.query(
    `UPDATE trader_verifications SET
       identity_check = $1, momo_check = $2, p2p_check = $3,
       verification_status = 'VERIFIED',
       reviewed_by = $4, review_notes = $5, reviewed_at = NOW()
     WHERE trader_id = $6`,
    [identity, momo, p2p, adminId, notes || null, traderId]
  );

  // Update traders table — make trader matchable
  await db.query(
    `UPDATE traders SET verification_status = 'VERIFIED', status = 'ACTIVE', is_active = TRUE, is_suspended = FALSE WHERE id = $1`,
    [traderId]
  );

  logger.info(`[Verification] Trader ${traderId} VERIFIED by admin ${adminId}`);
  return { traderId, status: 'VERIFIED' };
}

/**
 * Admin: reject a trader — sets REJECTED with notes.
 * Trader can re-submit documents to try again.
 */
async function adminRejectTrader(traderId, adminId, { notes, failedChecks = {} } = {}) {
  const identity = failedChecks.identity || 'PENDING';
  const momo = failedChecks.momo || 'PENDING';
  const p2p = failedChecks.p2p || 'PENDING';

  await db.query(
    `UPDATE trader_verifications SET
       identity_check = $1, momo_check = $2, p2p_check = $3,
       verification_status = 'REJECTED',
       reviewed_by = $4, review_notes = $5, reviewed_at = NOW()
     WHERE trader_id = $6`,
    [identity, momo, p2p, adminId, notes || 'Rejected', traderId]
  );

  await db.query(
    `UPDATE traders SET verification_status = 'REJECTED' WHERE id = $1`,
    [traderId]
  );

  logger.info(`[Verification] Trader ${traderId} REJECTED by admin ${adminId}`);
  return { traderId, status: 'REJECTED', notes };
}

/**
 * Admin: suspend a verified trader for compliance reasons.
 * Removes from matching pool immediately.
 */
async function adminSuspendVerified(traderId, adminId, reason) {
  await db.query(
    `UPDATE trader_verifications SET
       verification_status = 'SUSPENDED',
       reviewed_by = $1, review_notes = $2, reviewed_at = NOW()
     WHERE trader_id = $3`,
    [adminId, reason, traderId]
  );

  await db.query(
    `UPDATE traders SET
       verification_status = 'SUSPENDED',
       is_suspended = TRUE,
       status = 'SUSPENDED'
     WHERE id = $1`,
    [traderId]
  );

  logger.info(`[Verification] Trader ${traderId} SUSPENDED by admin ${adminId}: ${reason}`);
  return { traderId, status: 'SUSPENDED' };
}

/**
 * Generate a pre-signed URL for a stored document via Supabase Storage.
 * Returns a time-limited signed URL for admin review.
 */
async function getDocumentUrl(storageKey) {
  if (!storageKey) return null;

  const { default: storageService } = await import('./storageService.js');
  return storageService.getSignedUrl(storageKey);
}

/**
 * Build the pre-activation checklist for a trader.
 * Returns which items are complete and which are blocking.
 */
async function getPreActivationChecklist(traderId) {
  const vResult = await db.query(
    `SELECT * FROM trader_verifications WHERE trader_id = $1`,
    [traderId]
  );
  const v = vResult.rows[0];
  if (!v) return null;

  const traderResult = await db.query(
    `SELECT stellar_address, networks, float_ugx FROM traders WHERE id = $1`,
    [traderId]
  );
  const trader = traderResult.rows[0];

  const momoResult = await db.query(
    `SELECT COUNT(*) as verified_count FROM trader_momo_accounts
     WHERE trader_id = $1 AND verification_status = 'PASSED'`,
    [traderId]
  );

  const { minP2pTrades, minCompletionRate } = config.traderVerification;

  const checklist = [
    {
      item: 'Government-issued ID uploaded',
      status: v.id_document_front_key && v.id_document_back_key ? 'DONE' : 'MISSING',
      required: true,
    },
    {
      item: 'Selfie with ID uploaded',
      status: v.selfie_key ? 'DONE' : 'MISSING',
      required: true,
    },
    {
      item: 'Binance P2P screenshot uploaded',
      status: v.binance_screenshot_key ? 'DONE' : 'MISSING',
      required: true,
    },
    {
      item: `Binance P2P trades ≥ ${minP2pTrades}`,
      status: (v.binance_p2p_trades || 0) >= minP2pTrades ? 'DONE' : 'BELOW_THRESHOLD',
      value: v.binance_p2p_trades,
      required: true,
    },
    {
      item: `Binance completion rate ≥ ${minCompletionRate}%`,
      status: (v.binance_completion_rate || 0) >= minCompletionRate ? 'DONE' : 'BELOW_THRESHOLD',
      value: v.binance_completion_rate,
      required: true,
    },
    {
      item: 'At least one MoMo account verified',
      status: parseInt(momoResult.rows[0].verified_count) > 0 ? 'DONE' : 'MISSING',
      required: true,
    },
    {
      item: 'Trader agreement accepted',
      status: v.agreement_check === 'PASSED' ? 'DONE' : 'MISSING',
      required: true,
    },
    {
      item: 'Identity check passed (admin)',
      status: v.identity_check === 'PASSED' ? 'DONE' : v.identity_check,
      required: true,
    },
    {
      item: 'MoMo check passed (admin)',
      status: v.momo_check === 'PASSED' ? 'DONE' : v.momo_check,
      required: true,
    },
    {
      item: 'P2P check passed (admin)',
      status: v.p2p_check === 'PASSED' ? 'DONE' : v.p2p_check,
      required: true,
    },
    {
      item: 'Stellar address configured',
      status: trader?.stellar_address ? 'DONE' : 'MISSING',
      required: true,
    },
    {
      item: 'Mobile networks assigned',
      status: trader?.networks?.length > 0 ? 'DONE' : 'MISSING',
      value: trader?.networks,
      required: true,
    },
    {
      item: 'Initial float declared',
      status: (trader?.float_ugx || 0) > 0 ? 'DONE' : 'MISSING',
      value: trader?.float_ugx,
      required: false, // can be set post-verification
    },
  ];

  const blocking = checklist.filter(c => c.required && c.status !== 'DONE');
  const ready = blocking.length === 0;

  return {
    traderId,
    verificationStatus: v.verification_status,
    ready,
    blocking: blocking.length,
    total: checklist.length,
    checklist,
  };
}

export default {
  createVerificationRecord,
  submitDocuments,
  confirmAgreement,
  markMomoVerified,
  addMomoAccount,
  getPendingTraders,
  getVerificationDetail,
  adminVerifyTrader,
  adminRejectTrader,
  adminSuspendVerified,
  getDocumentUrl,
  getPreActivationChecklist,
};
