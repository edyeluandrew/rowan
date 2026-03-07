import client from './client';

/** POST /api/v1/trader/onboarding/submit (multipart/form-data) */
export async function submitOnboarding(formData) {
  const { data } = await client.post('/api/v1/trader/onboarding/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data;
}

/** POST /api/v1/trader/onboarding/confirm-agreement */
export async function confirmAgreement(confirmed, agreementVersion) {
  const { data } = await client.post('/api/v1/trader/onboarding/confirm-agreement', {
    confirmed,
    agreementVersion,
  });
  return data;
}

/** POST /api/v1/trader/onboarding/momo/request-otp */
export async function requestMomoOtp(network, phoneNumber) {
  const { data } = await client.post('/api/v1/trader/onboarding/momo/request-otp', {
    network,
    phoneNumber,
  });
  return data;
}

/** POST /api/v1/trader/onboarding/verify-otp */
export async function verifyMomoOtp(network, phoneNumber, code) {
  const { data } = await client.post('/api/v1/trader/onboarding/verify-otp', {
    network,
    phoneNumber,
    code,
  });
  return data;
}

/** GET /api/v1/trader/onboarding/status */
export async function getOnboardingStatus() {
  const { data } = await client.get('/api/v1/trader/onboarding/status');
  return data;
}

/** GET /api/v1/trader/onboarding/agreement */
export async function getAgreement() {
  const { data } = await client.get('/api/v1/trader/onboarding/agreement');
  return data;
}
