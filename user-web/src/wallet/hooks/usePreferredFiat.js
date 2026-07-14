import useUserCountry from './useUserCountry'
import { fiatToCountry } from '../utils/country'

/**
 * @deprecated Use useUserCountry — kept for compatibility.
 */
export default function usePreferredFiat() {
  const { country, fiatCurrency, setCountry, ready } = useUserCountry()

  const setPreferredFiat = async (fiat) => {
    await setCountry(fiatToCountry(fiat))
  }

  return {
    preferredFiat: fiatCurrency,
    setPreferredFiat,
    ready,
    country,
  }
}
