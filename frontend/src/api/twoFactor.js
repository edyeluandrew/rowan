import client from './client';

/**
 * GET /api/v1/auth/2fa/status
 * Check if 2FA is enabled for current trader
 */
export async function check2faStatus() {
  const { data } = await client.get('/api/v1/auth/2fa/status');
  return data;
}

/**
 * POST /api/v1/auth/2fa/setup
 * Initiate 2FA setup - get QR code and manual entry key
 */
export async function initiate2faSetup() {
  const { data } = await client.post('/api/v1/auth/2fa/setup');
  return data;
}

/**
 * POST /api/v1/auth/2fa/verify-setup
 * Verify the initial 2FA code and enable 2FA
 * Body: { code } - 6-digit code from authenticator
 */
export async function verifyTwoFactorSetup(code) {
  const { data } = await client.post('/api/v1/auth/2fa/verify-setup', { code });
  return data;
}

/**
 * POST /api/v1/trader/auth/2fa/verify-login
 * Verify 2FA code during login (public, before full auth)
 * Body: { traderId, code }
 */
export async function verifyTwoFactorLogin(traderId, code) {
  // This uses the client without requiring an existing token
  // Handle it specially since it's a pre-auth endpoint
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/v1/auth/2fa/verify-login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderId, code }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw { response: { data: error, status: response.status } };
  }
  
  return response.json();
}

/**
 * POST /api/v1/auth/2fa/disable
 * Disable 2FA (requires current TOTP code)
 * Body: { code } - current 6-digit code
 */
export async function disableTwoFactor(code) {
  const { data } = await client.post('/api/v1/auth/2fa/disable', { code });
  return data;
}

/**
 * POST /api/v1/auth/2fa/backup-codes/regenerate
 * Regenerate backup codes (requires current TOTP code)
 * Body: { code } - current 6-digit code
 */
export async function regenerateBackupCodes(code) {
  const { data } = await client.post('/api/v1/auth/2fa/backup-codes/regenerate', { code });
  return data;
}
