/**
 * Single-flight guard for pay / confirm handlers.
 * Prevents double-tap from starting two on-chain payments.
 */
export function createSubmitGuard() {
  let busy = false
  return {
    tryStart() {
      if (busy) return false
      busy = true
      return true
    },
    /** Call only on failure (not after successful navigate). */
    release() {
      busy = false
    },
    get busy() {
      return busy
    },
  }
}
