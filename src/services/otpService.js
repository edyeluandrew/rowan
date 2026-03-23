import crypto from 'crypto';
import AfricasTalking from 'africastalking';
import redis from '../db/redis.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * OTP Service — generate, store, verify one-time passwords via Redis,
 * and deliver them via Africa's Talking SMS.
 *
 * Used for mobile money account ownership verification during trader onboarding.
 *
 * SMS delivery:
 *   - Production: sends via Africa's Talking SMS gateway.
 *   - Development (NODE_ENV=development): logs OTP to console AND returns
 *     it in the API response. SMS is still attempted if AT credentials exist.
 */

const OTP_PREFIX = 'otp:momo:';
const OTP_RATE_PREFIX = 'otp:rate:';
const MAX_OTP_ATTEMPTS = 3;        // max verify attempts per OTP
const OTP_COOLDOWN_SECONDS = 60;   // min gap between OTP requests

// ── Africa's Talking client ─────────────────────────────────
const atCredentials = {
  apiKey: config.africasTalking.apiKey,
  username: config.africasTalking.username,
};

const atClient = (atCredentials.apiKey && atCredentials.username)
  ? AfricasTalking(atCredentials)
  : null;

const sms = atClient?.SMS;

if (!atClient) {
  logger.warn('[OTP] Africa\'s Talking credentials not set (AT_API_KEY / AT_USERNAME). SMS delivery disabled.');
}

/**
 * Send an SMS via Africa's Talking.
 *
 * @param {string} phoneNumber - E.164 format (e.g. +256701234567)
 * @param {string} message
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
async function sendSms(phoneNumber, message) {
  if (!sms) {
    logger.warn(`[OTP] SMS skipped (no AT client): ${phoneNumber}`);
    return { sent: false, error: 'SMS provider not configured' };
  }

  try {
    const result = await sms.send({
      to: [phoneNumber],
      message,
      from: config.africasTalking.senderId || undefined, // undefined = AT shared shortcode
    });

    const recipient = result.SMSMessageData?.Recipients?.[0];
    if (recipient?.status === 'Success' || recipient?.statusCode === 101) {
      logger.info(`[OTP] SMS sent to ${phoneNumber} (msgId: ${recipient.messageId})`);
      return { sent: true, messageId: recipient.messageId };
    }

    // AT returned a non-success status
    const errMsg = recipient?.status || 'Unknown AT error';
    logger.error(`[OTP] SMS delivery failed to ${phoneNumber}: ${errMsg}`);
    return { sent: false, error: errMsg };
  } catch (err) {
    logger.error(`[OTP] SMS send error to ${phoneNumber}:`, err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Generate a 6-digit OTP, store in Redis, and deliver via SMS.
 *
 * @param {string} traderId
 * @param {string} network - mobile_network enum value
 * @param {string} phoneHash - SHA-256 of phone number
 * @param {string} phoneNumber - actual phone number in E.164 format (for SMS delivery)
 * @returns {Promise<{ sent: boolean, expiresIn: number, smsStatus: string, devOtp?: string }>}
 */
async function generateOtp(traderId, network, phoneHash, phoneNumber) {
  const key = `${OTP_PREFIX}${traderId}:${network}:${phoneHash}`;
  const rateKey = `${OTP_RATE_PREFIX}${traderId}:${network}`;

  // Rate limit: one OTP per cooldown period
  const rateLimited = await redis.get(rateKey);
  if (rateLimited) {
    const ttl = await redis.ttl(rateKey);
    throw new Error(`OTP already sent. Please wait ${ttl} seconds before requesting another.`);
  }

  // Generate 6-digit code
  const otp = crypto.randomInt(100000, 999999).toString();
  const ttl = config.traderVerification.otpTtlSeconds;

  // Store in Redis: { code, attempts }
  await redis.set(key, JSON.stringify({ code: otp, attempts: 0 }), 'EX', ttl);
  await redis.set(rateKey, '1', 'EX', OTP_COOLDOWN_SECONDS);

  // Send SMS via Africa's Talking
  const smsMessage = `Your Rowan verification code is: ${otp}. Valid for ${Math.floor(ttl / 60)} minutes. Do not share this code.`;
  const smsResult = await sendSms(phoneNumber, smsMessage);

  const isDev = config.nodeEnv === 'development';
  if (isDev) {
    logger.info(`[OTP-DEV] Trader ${traderId} | ${network} | OTP: ${otp}`);
  }

  return {
    sent: smsResult.sent || isDev, // in dev, consider it "sent" even if AT is not configured
    expiresIn: ttl,
    smsStatus: smsResult.sent ? 'delivered' : (smsResult.error || 'sms_unavailable'),
    ...(isDev && { devOtp: otp }), // expose OTP in dev mode for testing
  };
}

/**
 * Verify a submitted OTP code.
 *
 * @param {string} traderId
 * @param {string} network
 * @param {string} phoneHash
 * @param {string} code - the 6-digit code the trader entered
 * @returns {Promise<{ verified: boolean, reason?: string }>}
 */
async function verifyOtp(traderId, network, phoneHash, code) {
  const key = `${OTP_PREFIX}${traderId}:${network}:${phoneHash}`;
  const raw = await redis.get(key);

  if (!raw) {
    return { verified: false, reason: 'OTP expired or not found. Please request a new one.' };
  }

  const data = JSON.parse(raw);

  if (data.attempts >= MAX_OTP_ATTEMPTS) {
    await redis.del(key);
    return { verified: false, reason: 'Too many attempts. Please request a new OTP.' };
  }

  if (data.code !== code) {
    data.attempts += 1;
    const remainingTtl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(data), 'EX', remainingTtl > 0 ? remainingTtl : 1);
    return {
      verified: false,
      reason: `Invalid code. ${MAX_OTP_ATTEMPTS - data.attempts} attempts remaining.`,
    };
  }

  // Success — delete the OTP so it can't be reused
  await redis.del(key);
  return { verified: true };
}

export default {
  generateOtp,
  verifyOtp,
  sendSms,
};
