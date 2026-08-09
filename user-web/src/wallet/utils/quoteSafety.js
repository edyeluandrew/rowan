/**
 * Quote / rates safety helpers — block locking when rates are missing or stale.
 */

export const RATE_MAX_AGE_MS = 60_000
export const RATE_DRIFT_WARN_PCT = 1.5

export function getRatesHealth(rates, fetchedAt, error) {
  if (error) {
    return {
      ok: false,
      reason: 'rates_error',
      message: 'Live rates are unavailable. Pull to refresh or try again.',
    }
  }
  const usdcToFiat = Number(rates?.usdcToFiat)
  if (!Number.isFinite(usdcToFiat) || usdcToFiat <= 0) {
    return {
      ok: false,
      reason: 'rates_missing',
      message: 'Live rates are still loading or missing. Wait a moment and try again.',
    }
  }
  if (fetchedAt != null && Date.now() - fetchedAt > RATE_MAX_AGE_MS) {
    return {
      ok: false,
      reason: 'rates_stale',
      message: 'Rates are out of date. Refreshing — try again in a second.',
    }
  }
  return { ok: true, usdcToFiat }
}

export async function ensureFreshRates(refresh) {
  if (typeof refresh === 'function') {
    await refresh()
  }
}

export function checkRateDrift(lockedRate, liveUsdcToFiat, pct = RATE_DRIFT_WARN_PCT) {
  const locked = Number(lockedRate)
  const live = Number(liveUsdcToFiat)
  if (!Number.isFinite(locked) || locked <= 0 || !Number.isFinite(live) || live <= 0) {
    return null
  }
  const drift = Math.abs(live - locked) / locked * 100
  if (drift <= pct) return null
  return {
    drifted: true,
    live,
    locked,
    percent: drift,
    message: `The market rate moved about ${drift.toFixed(1)}% since this quote. Get a new quote for an accurate lock.`,
  }
}
