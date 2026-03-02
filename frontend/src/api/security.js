import client from './client';

/** POST /api/v1/trader/auth/change-password */
export async function changePassword(currentPassword, newPassword, confirmPassword) {
  const { data } = await client.post('/api/v1/trader/auth/change-password', {
    currentPassword,
    newPassword,
    confirmPassword,
  });
  return data;
}

/** POST /api/v1/trader/auth/forgot-password */
export async function forgotPassword(email) {
  const { data } = await client.post('/api/v1/trader/auth/forgot-password', { email });
  return data;
}

/** POST /api/v1/trader/auth/reset-password */
export async function resetPassword(email, otp, newPassword, confirmPassword) {
  const { data } = await client.post('/api/v1/trader/auth/reset-password', {
    email,
    otp,
    newPassword,
    confirmPassword,
  });
  return data;
}

/** GET /api/v1/trader/auth/sessions */
export async function getSessions() {
  const { data } = await client.get('/api/v1/trader/auth/sessions');
  return data;
}

/** DELETE /api/v1/trader/auth/sessions/:sessionId */
export async function revokeSession(sessionId) {
  const { data } = await client.delete(`/api/v1/trader/auth/sessions/${sessionId}`);
  return data;
}

/** DELETE /api/v1/trader/auth/sessions/all */
export async function revokeAllSessions() {
  const { data } = await client.delete('/api/v1/trader/auth/sessions/all');
  return data;
}
