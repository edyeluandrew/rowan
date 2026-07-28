import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { getPreference, setPreference } from '../utils/storage'
import {
  COUNTRY_FIAT,
  fiatToCountry,
  getFiatForCountry,
  isSupportedCountry,
} from '../utils/country'

const COUNTRY_PREF = 'rowan_user_country'
const FIAT_PREF = 'rowan_preferred_fiat'

const UserCountryContext = createContext(null)

export async function persistUserCountry(country) {
  if (!isSupportedCountry(country)) return
  const fiat = getFiatForCountry(country)
  await setPreference(COUNTRY_PREF, country)
  await setPreference(FIAT_PREF, fiat)
}

export function UserCountryProvider({ children }) {
  const [country, setCountryState] = useState('UG')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const storedCountry = await getPreference(COUNTRY_PREF)
        if (!cancelled && isSupportedCountry(storedCountry)) {
          setCountryState(storedCountry)
          setReady(true)
          return
        }
        const storedFiat = await getPreference(FIAT_PREF)
        if (!cancelled && storedFiat && COUNTRY_FIAT[fiatToCountry(storedFiat)]) {
          setCountryState(fiatToCountry(storedFiat))
        }
      } catch {
        /* defaults */
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const setCountry = useCallback(async (code) => {
    if (!isSupportedCountry(code)) return
    setCountryState(code)
    try {
      await persistUserCountry(code)
    } catch {
      /* in-memory still updated */
    }
  }, [])

  const fiatCurrency = getFiatForCountry(country)

  const value = useMemo(
    () => ({ country, fiatCurrency, setCountry, ready }),
    [country, fiatCurrency, setCountry, ready]
  )

  return (
    <UserCountryContext.Provider value={value}>
      {children}
    </UserCountryContext.Provider>
  )
}

export default function useUserCountry() {
  const ctx = useContext(UserCountryContext)
  if (!ctx) {
    throw new Error('useUserCountry must be used within UserCountryProvider')
  }
  return ctx
}
