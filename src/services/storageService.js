import crypto from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * StorageService — Supabase Storage integration for trader document files.
 *
 * Uses a PRIVATE bucket (no public URLs). All access is via time-limited
 * signed URLs generated on demand for admin review.
 *
 * Bucket: config.traderVerification.documentBucket (env: TRADER_DOC_BUCKET)
 * Files are stored as: <traderId>/<uuid>.<ext>
 *
 * The Supabase service-role key is required (not the anon key) because
 * the backend operates outside Supabase Row-Level Security.
 */

// ── Supabase client (service-role) ──────────────────────────
const supabaseUrl = config.supabase.url;
const supabaseServiceKey = config.supabase.serviceRoleKey;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('[Storage] FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  // Don't crash at import time — allow server to boot for non-storage routes.
  // Storage calls will throw at runtime if credentials are missing.
}

const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const BUCKET = config.traderVerification.documentBucket;

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Ensure the private bucket exists (idempotent — safe to call on every boot).
 * Called once during server startup.
 */
async function ensureBucket() {
  if (!supabase) return;
  try {
    const { data: existing } = await supabase.storage.getBucket(BUCKET);
    if (existing) {
      logger.info(`[Storage] Bucket "${BUCKET}" exists (private)`);
      return;
    }
  } catch {
    // getBucket may 404 — that's fine, we create below
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    ],
  });
  if (error && !error.message?.includes('already exists')) {
    logger.error(`[Storage] Failed to create bucket "${BUCKET}":`, error.message);
  } else {
    logger.info(`[Storage] Bucket "${BUCKET}" ready`);
  }
}

/**
 * Upload a file buffer to Supabase Storage and return a storage key.
 *
 * @param {Buffer} buffer - file contents
 * @param {string} originalName - original filename (for extension + MIME detection)
 * @param {string} traderId - used as folder prefix
 * @returns {Promise<string>} storageKey - unique path within the bucket
 */
async function saveFile(buffer, originalName, traderId) {
  if (!supabase) {
    throw new Error('Storage not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  const ext = path.extname(originalName).toLowerCase() || '.bin';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB`);
  }

  const MIME_MAP = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };

  const fileId = crypto.randomUUID();
  const storageKey = `${traderId}/${fileId}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, buffer, {
      contentType: MIME_MAP[ext] || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  logger.info(`[Storage] Uploaded ${storageKey} (${(buffer.length / 1024).toFixed(1)}KB)`);
  return storageKey;
}

/**
 * Generate a time-limited signed URL for an admin to view a document.
 *
 * @param {string} storageKey - the key returned by saveFile()
 * @returns {Promise<{ key: string, url: string, expiresAt: string } | null>}
 */
async function getSignedUrl(storageKey) {
  if (!storageKey || !supabase) return null;

  const expirySeconds = config.traderVerification.docUrlExpirySeconds;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, expirySeconds);

  if (error) {
    logger.error(`[Storage] Signed URL failed for ${storageKey}:`, error.message);
    return null;
  }

  return {
    key: storageKey,
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
  };
}

/**
 * Delete a file from Supabase Storage.
 *
 * @param {string} storageKey
 */
async function deleteFile(storageKey) {
  if (!storageKey || !supabase) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storageKey]);

  if (error) {
    logger.error(`[Storage] Delete failed for ${storageKey}:`, error.message);
  } else {
    logger.info(`[Storage] Deleted ${storageKey}`);
  }
}

export default {
  ensureBucket,
  saveFile,
  getSignedUrl,
  deleteFile,
};
