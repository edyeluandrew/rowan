/**
 * Quote / rates safety helpers — block locking when rates are missing or stale.
 */

/** Max age of a live rate snapshot before we force a refresh / block proceeds (ms). */
export const RATE_MAX_AGE_MS = 60_000

/** How far a locked quote rate may drift from live before user must re-quote. */
export const RATE_DRIFT_WARN_PCT = 1.5

/**
 * @param {{ usdcToFiat?: number|null }|null} rates
 * @param {number|null|undefined} fetchedAt - Date.now() when rates last loaded
 * @param {Error|string|null|undefined} error
 */
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

/**
 * Force a rates refresh, then require a healthy snapshot.
 * @param {() => Promise<void>|void} refresh
 * @param {{ getSnapshot: () => { rates: any, fetchedAt?: number|null, error?: any } }} opts
 */
export async function ensureFreshRates(refresh, getSnapshot) {
  if (typeof refresh === 'function') {
    await refresh()
  }
  // allow state to settle one tick when refresh is hook-based
  await new Promise((r) => setTimeout(r, 0))
  const snap = typeof getSnapshot === 'function' ? getSnapshot() : getSnapshot
  return getRatesHealth(snap?.rates, snap?.fetchedAt, snap?.error)
}

/**
 * Compare quote lock rate to live board rate (optional for ad-matched trades).
 * @returns {null | { drifted: true, message: string, live: number, locked: number }}
 */
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
