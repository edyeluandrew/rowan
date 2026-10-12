/** Partner on/off-ramp host. The customer wallet stays on rowanpay.app. */
export const PARTNER_HOST = 'partners.rowanpay.app'

export function isPartnerHost(hostname) {
  const host = hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  return host === PARTNER_HOST
}
