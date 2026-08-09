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
    release() {
      busy = false
    },
    get busy() {
      return busy
    },
  }
}
