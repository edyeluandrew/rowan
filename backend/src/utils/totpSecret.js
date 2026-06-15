import { encrypt, decrypt } from './encryption.js';
import { verifyTotpCode } from '../handlers/totp.js';

const ALLOWED_TABLES = {
  user_2fa_settings: 'user_id',
  trader_2fa_settings: 'trader_id',
  admin_2fa_settings: 'admin_id',
};

/** Encrypted secrets use iv:authTag:ciphertext (base64). Plain base32 has no colons. */
export function isEncryptedTotpSecret(stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export function packTotpSecret(plaintext) {
  if (!plaintext) return null;
  return encrypt(plaintext);
}

export function unpackTotpSecret(stored) {
  if (!stored) return null;
  if (isEncryptedTotpSecret(stored)) {
    return decrypt(stored);
  }
  return stored;
}

export function verifyTotpFromStored(storedSecret, code) {
  const secret = unpackTotpSecret(storedSecret);
  if (!secret) return false;
  return verifyTotpCode(secret, code);
}

/**
 * Lazy-upgrade plaintext TOTP secrets to encrypted at rest (one row at a time).
 */
export async function upgradeTotpSecretIfPlaintext(db, table, id, storedSecret) {
  if (!storedSecret || isEncryptedTotpSecret(storedSecret)) return;
  const idColumn = ALLOWED_TABLES[table];
  if (!idColumn) throw new Error(`Invalid 2FA table: ${table}`);
  const packed = packTotpSecret(storedSecret);
  await db.query(
    `UPDATE ${table} SET totp_secret = $1, updated_at = NOW() WHERE ${idColumn} = $2`,
    [packed, id]
  );
}

export default {
  isEncryptedTotpSecret,
  packTotpSecret,
  unpackTotpSecret,
  verifyTotpFromStored,
  upgradeTotpSecretIfPlaintext,
};
