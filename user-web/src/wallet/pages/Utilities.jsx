import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Signal, Wifi, AlertTriangle } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import { getUtilityQuote, getUtilityConfig, getUtilityHistory } from '../api/utilities'
import { NETWORKS, COUNTRY_CODES } from '../utils/constants'
import { getNetworksForCountry } from '../utils/country'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import Button from '../components/ui/Button'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'

const UTILITY_META = {
  airtime: {
    title: 'Buy airtime',
    subtitle: 'Pay with USDC — instant top-up',
    phoneHint: 'Phone number that receives the airtime credit',
    minLabel: 'Minimum airtime',
    maxLabel: 'Maximum airtime',
    historyTitle: 'Recent airtime',
    cta: 'Get quote',
    Icon: Signal,
  },
  data: {
    title: 'Buy data',
    subtitle: 'Mobile data bundles paid with USDC',
    phoneHint: 'Phone number that receives the data bundle',
    minLabel: 'Minimum bundle',
    maxLabel: 'Maximum bundle',
    historyTitle: 'Recent data',
    cta: 'Get quote',
    Icon: Wifi,
  },
}

export default function Utilities({ utilityType = 'airtime' }) {
  const meta = UTILITY_META[utilityType] || UTILITY_META.airtime
  const TypeIcon = meta.Icon
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const { country, fiatCurrency } = useUserCountry()
  const { usdcAvailable, usdcBalance, hasUsdcTrustline } = useWallet()
  const spendableUsdc = usdcAvailable ?? usdcBalance
  const { rates } = useRates(fiatCurrency)
  const [fiatAmount, setFiatAmount] = useState('')
  const [network, setNetwork] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [utilityConfig, setUtilityConfig] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    getUtilityConfig()
      .then(setUtilityConfig)
      .catch(() => {})
    getUtilityHistory(5)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : []
        setHistory(list.filter((r) => (r.type || r.utility_type || 'airtime') === utilityType))
      })
      .catch(() => {})
  }, [utilityType])

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

  const walletMaxFiat = usdcToFiatRate > 0 && spendableUsdc != null
    ? spendableUsdc * usdcToFiatRate / (1 + feePercent / 100)
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
        type: utilityType,
      })

      navigate('/wallet/utilities/confirm', {
        state: {
          quote,
          network,
          phone: fullPhone,
          utilityType,
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
    <div className="px-4 pb-8">
      <p className="text-rowan-muted text-xs mb-4">{meta.subtitle}</p>

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
            {spendableUsdc != null ? Number(spendableUsdc).toFixed(2) : '—'} USDC
            {usdcAvailable != null && usdcBalance != null && usdcAvailable < usdcBalance && (
              <span className="text-rowan-muted text-sm font-normal ml-1">available</span>
            )}
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
        <p className="text-rowan-muted text-xs mt-2 px-1">{meta.phoneHint}</p>
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
            {exceedsWallet && <p>Amount exceeds your available USDC</p>}
            {belowMin && <p>{meta.minLabel} is {minFiat.toLocaleString()} {currency}</p>}
            {aboveMax && <p>{meta.maxLabel} is {maxFiat.toLocaleString()} {currency}</p>}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={handleGetQuote} loading={loading} disabled={!canProceed}>
          <TypeIcon size={18} className="mr-2" />
          {meta.cta}
        </Button>
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-rowan-text text-sm font-semibold mb-3">{meta.historyTitle}</h2>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/wallet/utilities/status/${item.id}`, { state: { quote: item } })}
                className="w-full bg-rowan-surface border border-rowan-border rounded-xl p-3 text-left"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-rowan-text text-sm font-medium">
                    {Number(item.fiatAmount).toLocaleString()} {item.fiatCurrency}
                  </span>
                  <span className={`text-xs font-medium ${
                    item.status === 'COMPLETED' ? 'text-rowan-green'
                      : item.status === 'FAILED' ? 'text-rowan-red'
                        : 'text-rowan-muted'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-rowan-muted text-xs mt-1 truncate">{item.recipientPhone}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
