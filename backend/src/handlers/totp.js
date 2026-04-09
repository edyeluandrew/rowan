import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generate a new TOTP secret for a trader
 * Returns both the secret and a QR code
 */
export async function generateTotpSecret(traderId, traderEmail, appName = 'Rowan OTC') {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${traderEmail})`,
    issuer: appName,
    length: 32, // Longer secret for higher security
  });

  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrCode,
    manualEntry: secret.base32, // For manual entry into authenticator
  };
}

/**
 * Verify a TOTP code
 * Uses ±1 time window for minor clock skew tolerance
 */
export function verifyTotpCode(secret, code) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1, // ±30 seconds
  });
}

/**
 * Generate backup codes (10 codes, 8 characters each)
 * Returns array of codes and hash for storage
 */
export async function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }

  // Store as hashed JSON array
  const codesHash = await bcrypt.hash(JSON.stringify(codes), 12);

  return { codes, codesHash };
}

/**
 * Verify and use a backup code for authentication
 * Returns true if valid and not yet used, false otherwise
 */
export async function verifyAndUseBackupCode(db, traderId, providedCode) {
  try {
    // Find unused backup code matching the provided code
    const result = await db.query(
      `SELECT id, code_hash FROM trader_backup_codes 
       WHERE trader_id = $1 AND used_at IS NULL 
       ORDER BY created_at ASC 
       LIMIT 100`, // Fetch up to 100 unused codes to check
      [traderId]
    );

    // Check each unused code
    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(providedCode, row.code_hash);
      if (isMatch) {
        // Mark this code as used
        await db.query(
          `UPDATE trader_backup_codes SET used_at = NOW() WHERE id = $1`,
          [row.id]
        );
        return { valid: true, codeId: row.id };
      }
    }

    return { valid: false, reason: 'Invalid backup code' };
  } catch (err) {
    throw new Error(`Backup code verification failed: ${err.message}`);
  }
}

/**
 * Hash a single backup code for storage
 */
export async function hashBackupCode(code) {
  return bcrypt.hash(code, 12);
}

/**
 * Store backup codes individually in database
 */
export async function storeBackupCodes(db, traderId, codes) {
  try {
    // Delete any existing unused backup codes
    await db.query(
      `DELETE FROM trader_backup_codes WHERE trader_id = $1 AND used_at IS NULL`,
      [traderId]
    );

    // Hash and store each code
    for (const code of codes) {
      const codeHash = await hashBackupCode(code);
      await db.query(
        `INSERT INTO trader_backup_codes (trader_id, code_hash) VALUES ($1, $2)`,
        [traderId, codeHash]
      );
    }
  } catch (err) {
    throw new Error(`Failed to store backup codes: ${err.message}`);
  }
}

/**
 * Get count of unused backup codes for a trader
 */
export async function getBackupCodeCount(db, traderId) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM trader_backup_codes 
       WHERE trader_id = $1 AND used_at IS NULL`,
      [traderId]
    );
    return result.rows[0].count;
  } catch (err) {
    return 0;
  }
}

/**
 * Log 2FA verification for audit trail
 */
export async function log2faVerification(db, traderId, type, result, failureReason = null, ipAddress = null) {
  try {
    await db.query(
      `INSERT INTO trader_2fa_verification_logs
       (trader_id, verification_type, result, failure_reason, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [traderId, type, result, failureReason, ipAddress]
    );
  } catch (err) {
    console.error('[2FA] Audit log write failed:', err.message);
    // Don't throw - logging failure shouldn't break the flow
  }
}

export default {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  log2faVerification,
};
