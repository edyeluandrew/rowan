import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Signal, AlertTriangle } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import { getUtilityQuote, getUtilityConfig } from '../api/utilities'
import { NETWORKS, COUNTRY_CODES } from '../utils/constants'
import { getNetworksForCountry } from '../utils/country'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import Button from '../components/ui/Button'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'

export default function Utilities() {
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const { country, fiatCurrency } = useUserCountry()
  const { usdcBalance, hasUsdcTrustline } = useWallet()
  const { rates } = useRates(fiatCurrency)
  const [fiatAmount, setFiatAmount] = useState('')
  const [network, setNetwork] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [utilityConfig, setUtilityConfig] = useState(null)

  useEffect(() => {
    getUtilityConfig()
      .then(setUtilityConfig)
      .catch(() => {})
  }, [])

  const countryNetworks = useMemo(
    () => Object.keys(getNetworksForCountry(country)),
    [country]
  )

  useEffect(() => {
    if (!network && countryNetworks.length > 0) {
      setNetwork(countryNetworks[0])
    }
  }, [countryNetworks, network])

  const netFiat = parseFloat(fiatAmount) || 0
  const currency = network ? NETWORKS[network]?.currency : fiatCurrency
  const usdcToFiatRate = rates?.usdcToFiat || 0
  const feePercent = utilityConfig?.feePercent ?? 1
  const minFiat = utilityConfig?.minFiatAmount ?? 1000
  const maxFiat = utilityConfig?.maxFiatAmount ?? 500000

  const usdcEstimate = usdcToFiatRate > 0 && netFiat > 0
    ? (netFiat / usdcToFiatRate) * (1 + feePercent / 100)
    : 0

  const walletMaxFiat = usdcToFiatRate > 0 && usdcBalance != null
    ? usdcBalance * usdcToFiatRate / (1 + feePercent / 100)
    : null

  const exceedsWallet = walletMaxFiat != null && netFiat > walletMaxFiat
  const belowMin = netFiat > 0 && netFiat < minFiat
  const aboveMax = netFiat > maxFiat

  const canProceed =
    netFiat >= minFiat &&
    netFiat <= maxFiat &&
    hasUsdcTrustline !== false &&
    !exceedsWallet &&
    network &&
    phone.replace(/\D/g, '').length >= 9

  if (isLocked) return <BiometricLock />

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig?.country || country
      const dialCode = COUNTRY_CODES[derivedCountryCode]?.code || '+256'
      const cleanPhone = phone.replace(/\D/g, '')
      const fullPhone = cleanPhone.startsWith('256') || cleanPhone.startsWith('254')
        ? cleanPhone
        : `${dialCode.replace(/\D/g, '')}${cleanPhone.replace(/^0/, '')}`

      const quote = await getUtilityQuote({
        country: derivedCountryCode,
        networkCode: network,
        recipientPhone: fullPhone,
        fiatAmount: Math.round(netFiat),
        type: 'airtime',
      })

      navigate('/wallet/utilities/confirm', {
        state: {
          quote,
          network,
          phone: fullPhone,
          mockPurchaseAllowed: utilityConfig?.mockPurchaseAllowed,
        },
      })
    } catch (err) {
      const data = err.response?.data
      setError(data?.error || data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMax = () => {
    if (walletMaxFiat != null && walletMaxFiat > 0) {
      setFiatAmount(String(Math.min(Math.floor(walletMaxFiat), maxFiat)))
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-rowan-text text-lg font-bold">Buy airtime</h1>
          <p className="text-rowan-muted text-xs">Pay with USDC — instant top-up</p>
        </div>
      </div>

      <UsdcTrustlineSetup compact />

      {utilityConfig?.reloadlyMock && (
        <div className="bg-rowan-mint border border-rowan-green/30 rounded-xl p-3 mb-4">
          <p className="text-rowan-text text-xs">
            Staging mode — airtime uses mock Reloadly until API keys are added.
          </p>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">USDC balance</p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-rowan-text text-2xl font-bold tabular-nums">
            {usdcBalance != null ? Number(usdcBalance).toFixed(2) : '—'} USDC
          </span>
          {walletMaxFiat != null && walletMaxFiat > 0 && (
            <button
              type="button"
              onClick={handleMax}
              className="text-rowan-yellow text-xs font-medium border border-rowan-yellow/40 rounded-full px-3 py-1"
            >
              Max
            </button>
          )}
        </div>
      </div>

      <AmountInput
        fiatAmount={fiatAmount}
        onFiatAmountChange={setFiatAmount}
        currency={currency}
        cryptoEstimate={usdcEstimate}
        cryptoLabel="USDC"
        platformFeeFiat={netFiat * (feePercent / 100)}
        maxFiat={Math.min(maxFiat, walletMaxFiat ?? maxFiat)}
      />

      <p className="text-rowan-muted text-xs mt-2 px-1">
        Min {minFiat.toLocaleString()} · Max {maxFiat.toLocaleString()} {currency}
      </p>

      <div className="mt-6">
        <NetworkSelector selected={network} onSelect={setNetwork} country={country} />
      </div>

      <div className="mt-6">
        <PhoneInput phone={phone} onPhoneChange={setPhone} network={network} />
        <p className="text-rowan-muted text-xs mt-2 px-1">
          Phone number that receives the airtime credit
        </p>
      </div>

      {error && (
        <div className="mt-4 bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4">
          <p className="text-rowan-red text-sm">{error}</p>
        </div>
      )}

      {(exceedsWallet || belowMin || aboveMax) && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div className="text-rowan-yellow text-sm">
            {exceedsWallet && <p>Amount exceeds your USDC balance</p>}
            {belowMin && <p>Minimum airtime is {minFiat.toLocaleString()} {currency}</p>}
            {aboveMax && <p>Maximum airtime is {maxFiat.toLocaleString()} {currency}</p>}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={handleGetQuote} loading={loading} disabled={!canProceed}>
          <Signal size={18} className="mr-2" />
          Get quote
        </Button>
      </div>
    </div>
  )
}
