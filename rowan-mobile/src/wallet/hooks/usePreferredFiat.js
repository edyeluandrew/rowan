import { useState, useEffect, useCallback } from 'react'
import { getPreference, setPreference } from '../utils/storage'
import { FIAT_CURRENCIES } from '../utils/fiat'

const PREF_KEY = 'rowan_preferred_fiat'

/**
 * Persisted display currency for Home balance (UGX / KES / TZS).
 */
export default function usePreferredFiat() {
  const [preferredFiat, setPreferredFiatState] = useState('UGX')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const stored = await getPreference(PREF_KEY)
        if (stored && FIAT_CURRENCIES.includes(stored)) {
          setPreferredFiatState(stored)
        }
      } catch {
        /* use default */
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const setPreferredFiat = useCallback(async (code) => {
    if (!FIAT_CURRENCIES.includes(code)) return
    setPreferredFiatState(code)
    try {
      await setPreference(PREF_KEY, code)
    } catch {
      /* preference write failed — in-memory still updated */
    }
  }, [])

  return { preferredFiat, setPreferredFiat, ready }
}
