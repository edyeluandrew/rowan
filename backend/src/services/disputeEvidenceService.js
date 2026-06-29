import db from '../db/index.js';
import storageService from './storageService.js';
import logger from '../utils/logger.js';

const MAX_FILES_PER_PARTY = 5;

async function assertDisputeAccess(disputeId, { userId = null, traderId = null }) {
  const result = await db.query(
    `SELECT d.id, d.transaction_id, d.user_id, d.trader_id, t.state
     FROM disputes d
     JOIN transactions t ON t.id = d.transaction_id
     WHERE d.id = $1`,
    [disputeId]
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error('Dispute not found');
    err.statusCode = 404;
    throw err;
  }
  if (row.state !== 'DISPUTE_OPENED') {
    const err = new Error('Evidence can only be uploaded while a dispute is open');
    err.statusCode = 409;
    throw err;
  }
  if (userId && row.user_id !== userId) {
    const err = new Error('Not authorized for this dispute');
    err.statusCode = 403;
    throw err;
  }
  if (traderId && row.trader_id !== traderId) {
    const err = new Error('Not authorized for this dispute');
    err.statusCode = 403;
    throw err;
  }
  return row;
}

async function countEvidence(disputeId, uploaderRole) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS cnt FROM dispute_evidence
     WHERE dispute_id = $1 AND uploader_role = $2`,
    [disputeId, uploaderRole]
  );
  return result.rows[0]?.cnt || 0;
}

async function uploadEvidence(disputeId, { userId = null, traderId = null }, file) {
  const dispute = await assertDisputeAccess(disputeId, { userId, traderId });
  const uploaderRole = userId ? 'user' : 'trader';
  const uploaderId = userId || traderId;

  const existing = await countEvidence(disputeId, uploaderRole);
  if (existing >= MAX_FILES_PER_PARTY) {
    const err = new Error('Maximum evidence files reached (5 per party)');
    err.statusCode = 409;
    throw err;
  }

  const storageKey = await storageService.saveDisputeEvidence(
    file.buffer,
    file.originalname,
    disputeId,
    uploaderRole
  );
  const signed = await storageService.getSignedUrl(storageKey, 60 * 60 * 24 * 7);

  const insert = await db.query(
    `INSERT INTO dispute_evidence (dispute_id, uploader_id, uploader_role, file_url, file_name, file_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [disputeId, uploaderId, uploaderRole, storageKey, file.originalname, file.mimetype || 'application/octet-stream']
  );
  const row = insert.rows[0];

  logger.info(`[DisputeEvidence] Uploaded ${row.id} for dispute ${disputeId} (${uploaderRole})`);

  return {
    id: row.id,
    disputeId: row.dispute_id,
    uploaderId: row.uploader_id,
    uploaderRole: row.uploader_role,
    fileName: row.file_name,
    fileType: row.file_type,
    fileUrl: signed?.url || null,
    uploadedAt: row.uploaded_at,
  };
}

async function listEvidence(disputeId, { userId = null, traderId = null, admin = false } = {}) {
  if (!admin) {
    await assertDisputeAccess(disputeId, { userId, traderId });
  } else {
    const check = await db.query(`SELECT id FROM disputes WHERE id = $1`, [disputeId]);
    if (!check.rows[0]) {
      const err = new Error('Dispute not found');
      err.statusCode = 404;
      throw err;
    }
  }

  const result = await db.query(
    `SELECT id, dispute_id, uploader_id, uploader_role, file_url, file_name, file_type, uploaded_at
     FROM dispute_evidence
     WHERE dispute_id = $1
     ORDER BY uploaded_at ASC`,
    [disputeId]
  );

  const items = await Promise.all(
    result.rows.map(async (row) => {
      const signed = await storageService.getSignedUrl(row.file_url, 60 * 60 * 24 * 7);
      return {
        id: row.id,
        disputeId: row.dispute_id,
        uploaderId: row.uploader_id,
        uploaderRole: row.uploader_role,
        fileName: row.file_name,
        fileType: row.file_type,
        fileUrl: signed?.url || null,
        uploadedAt: row.uploaded_at,
      };
    })
  );

  return items;
}

export default {
  uploadEvidence,
  listEvidence,
  MAX_FILES_PER_PARTY,
};
