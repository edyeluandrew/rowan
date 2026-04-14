import client from './client';

/**
 * GET /api/v1/user/2fa/status
 * Check if 2FA is enabled for current wallet user
 */
export async function check2faStatus() {
  const { data } = await client.get('/api/v1/user/2fa/status');
  return data;
}

/**
 * POST /api/v1/user/2fa/setup
 * Initiate 2FA setup - get QR code and manual entry key
 */
export async function initiate2faSetup() {
  const { data } = await client.post('/api/v1/user/2fa/setup');
  return data;
}

/**
 * POST /api/v1/user/2fa/verify-setup
 * Verify the initial 2FA code and enable 2FA
 * Body: { code } - 6-digit code from authenticator
 */
export async function verifyTwoFactorSetup(code) {
  const { data } = await client.post('/api/v1/user/2fa/verify-setup', { code });
  return data;
}

/**
 * POST /api/v1/user/2fa/verify-login
 * Verify 2FA code during login (public, before full auth)
 * Body: { userId, code } or just { code } if already authenticated
 * Can be called pre-auth (userId in body) or post-auth (from token)
 */
export async function verifyTwoFactorLogin(userId, code) {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/v1/user/2fa/verify-login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Verification failed');
  }

  return await response.json();
}

/**
 * POST /api/v1/user/2fa/disable
 * Disable 2FA for wallet user
 * Body: { code } - TOTP code to verify ownership
 */
export async function disableTwoFactor(code) {
  const { data } = await client.post('/api/v1/user/2fa/disable', { code });
  return data;
}

/**
 * POST /api/v1/user/2fa/backup-codes/regenerate
 * Generate new backup codes for wallet user
 * Body: { code } - TOTP code to verify ownership
 */
export async function regenerateBackupCodes(code) {
  const { data } = await client.post('/api/v1/user/2fa/backup-codes/regenerate', { code });
  return data;
}
