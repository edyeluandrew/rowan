import crypto from 'crypto';
import config from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 256-bit key from the ENCRYPTION_KEY env var.
 * Uses SHA-256 to normalize any length key into exactly 32 bytes.
 */
function getKey() {
  const raw = config.encryptionKey;
  if (!raw) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string: iv:authTag:ciphertext
 */
export function encrypt(plaintext) {
  if (!plaintext) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack as iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input format: iv:authTag:ciphertext (all base64)
 */
export function decrypt(encryptedString) {
  if (!encryptedString) return null;
  const key = getKey();
  const parts = encryptedString.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export default { encrypt, decrypt };
