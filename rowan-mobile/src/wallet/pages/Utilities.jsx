import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Signal, Wifi, AlertTriangle } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import {
  getUtilityQuote,
  getUtilityConfig,
  getUtilityHistory,
  getUtilityBundles,
  getUtilityLimits,
  getUtilityOperators,
  getUtilityDataAvailability,
} from '../api/utilities'
import { NETWORKS } from '../utils/constants'
import { getNetworksForCountry, getDialCodeForCountry } from '../utils/country'
import { limitsFromReloadlyOperators } from '../utils/reloadlyOperatorMatch'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import DataBundlePicker from '../components/utilities/DataBundlePicker'
import Button from '../components/ui/Button'
import { mapApiError } from '../utils/apiErrors'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'

const UTILITY_META = {
  airtime: {
    subtitle: 'Pay with USDC — instant top-up',
    phoneHint: 'Phone number that receives the airtime credit',
    minLabel: 'Minimum airtime',
    maxLabel: 'Maximum airtime',
    historyTitle: 'Recent airtime',
    cta: 'Get quote',
    Icon: Signal,
  },
  data: {
    subtitle: 'Pick a data plan — pay with USDC',
    phoneHint: 'Phone number that receives the data bundle',
    minLabel: 'Minimum bundle',
    maxLabel: 'Maximum bundle',
    historyTitle: 'Recent data',
    cta: 'Get quote',
    Icon: Wifi,
  },
}

function buildFullPhone(phone, network, country) {
  const networkConfig = NETWORKS[network]
  const derivedCountryCode = networkConfig?.country || country
  const dialCode = getDialCodeForCountry(derivedCountryCode)
  const cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.startsWith('256') || cleanPhone.startsWith('254') || cleanPhone.startsWith('255') || cleanPhone.startsWith('250') || cleanPhone.startsWith('234') || cleanPhone.startsWith('233')) {
    return cleanPhone
  }
  return `${dialCode.replace(/\D/g, '')}${cleanPhone.replace(/^0/, '')}`
}

export default function Utilities({ utilityType = 'airtime' }) {
  const meta = UTILITY_META[utilityType] || UTILITY_META.airtime
  const isData = utilityType === 'data'
  const TypeIcon = meta.Icon
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const { country, fiatCurrency } = useUserCountry()
  const { usdcBalance, hasUsdcTrustline } = useWallet()
  const spendableUsdc = usdcBalance
  const { rates } = useRates(fiatCurrency)
  const [fiatAmount, setFiatAmount] = useState('')
  const [network, setNetwork] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedBundle, setSelectedBundle] = useState(null)
  const [bundles, setBundles] = useState([])
  const [bundleOperatorName, setBundleOperatorName] = useState(null)
  const [bundlesLoading, setBundlesLoading] = useState(false)
  const [bundlesError, setBundlesError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [utilityConfig, setUtilityConfig] = useState(null)
  const [history, setHistory] = useState([])
  const [operatorLimits, setOperatorLimits] = useState(null)
  const [limitsLoading, setLimitsLoading] = useState(false)
  const [limitsError, setLimitsError] = useState(null)
  const [dataAvailability, setDataAvailability] = useState(null)

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

  useEffect(() => {
    if (!isData) {
      setDataAvailability(null)
      return
    }
    getUtilityDataAvailability(country)
      .then(setDataAvailability)
      .catch(() => setDataAvailability(null))
  }, [isData, country])

  const countryNetworks = useMemo(
    () => Object.keys(getNetworksForCountry(country)),
    [country]
  )

  useEffect(() => {
    if (countryNetworks.length > 0) {
      setNetwork((prev) => (countryNetworks.includes(prev) ? prev : countryNetworks[0]))
    } else {
      setNetwork('')
    }
  }, [country, countryNetworks])

  useEffect(() => {
    setSelectedBundle(null)
    setBundles([])
    setBundleOperatorName(null)
  }, [country])

  const currency = network ? NETWORKS[network]?.currency : fiatCurrency
  const usdcToFiatRate = rates?.usdcToFiat || 0
  const feePercent = utilityConfig?.feePercent ?? 1
  const minFiat = operatorLimits?.minFiatAmount ?? null
  const maxFiat = operatorLimits?.maxFiatAmount ?? null
  const fixedAmounts = operatorLimits?.denominationType === 'FIXED'
    ? (operatorLimits?.allowedAmounts || [])
    : []
  const suggestedAmounts = operatorLimits?.suggestedAmounts || []

  const phoneValid = phone.replace(/\D/g, '').length >= 9
  const fullPhone = phoneValid && network
    ? buildFullPhone(phone, network, country)
    : null

  const netFiat = isData
    ? (selectedBundle?.fiatAmount ?? 0)
    : (parseFloat(fiatAmount) || 0)

  const usdcEstimate = usdcToFiatRate > 0 && netFiat > 0
    ? (netFiat / usdcToFiatRate) * (1 + feePercent / 100)
    : 0

  const walletMaxFiat = usdcToFiatRate > 0 && spendableUsdc != null
    ? spendableUsdc * usdcToFiatRate / (1 + feePercent / 100)
    : null

  const exceedsWallet = walletMaxFiat != null && netFiat > walletMaxFiat
  const belowMin = !isData && netFiat > 0 && minFiat != null && netFiat < minFiat
  const aboveMax = !isData && maxFiat != null && netFiat > maxFiat

  const loadBundles = useCallback(async () => {
    if (!isData || !network || !fullPhone) return
    // Soft gate: only hard-stop for corridors we know are empty (e.g. KE sandbox).
    // Still attempt plan load if availability is unknown — avoid false "no plans" from
    // mock/catalog glitches that previously blocked working UG Reloadly products.
    if (dataAvailability && dataAvailability.available === false) {
      const knownEmpty = ['KE', 'TZ', 'RW'].includes(String(country).toUpperCase())
      if (knownEmpty) {
        setBundles([])
        setBundlesError(
          `Reloadly sandbox has no data bundle products for ${country} yet. `
          + 'Switch to Uganda for data tests, or use Airtime here.'
        )
        return
      }
      // UG / NG / etc: fall through and try live bundles; show banner separately.
    }
    setBundlesLoading(true)
    setBundlesError(null)
    setSelectedBundle(null)
    try {
      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig?.country || country
      const catalog = await getUtilityBundles({
        country: derivedCountryCode,
        networkCode: network,
        recipientPhone: fullPhone,
      })
      setBundles(catalog.bundles || [])
      setBundleOperatorName(catalog.operatorName || null)
    } catch (err) {
      setBundles([])
      setBundleOperatorName(null)
      const data = err.response?.data
      const hint = data?.details?.corridorsWithData?.length
        ? ` Try ${data.details.corridorsWithData.join(', ')} for data tests.`
        : ''
      setBundlesError((data?.error || err.message) + hint)
    } finally {
      setBundlesLoading(false)
    }
  }, [isData, network, fullPhone, country, dataAvailability])

  useEffect(() => {
    if (!isData) return
    if (!phoneValid || !network) {
      setBundles([])
      setSelectedBundle(null)
      setBundlesError(null)
      return
    }
    loadBundles()
  }, [isData, phoneValid, network, fullPhone, loadBundles])

  const loadOperatorLimits = useCallback(async () => {
    if (isData || !network || !fullPhone) return
    setLimitsLoading(true)
    setLimitsError(null)
    setOperatorLimits(null)
    try {
      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig?.country || country
      const limits = await getUtilityLimits({
        country: derivedCountryCode,
        networkCode: network,
        recipientPhone: fullPhone,
        type: 'airtime',
      })
      setOperatorLimits(limits)
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
        try {
          const networkConfig = NETWORKS[network]
          const derivedCountryCode = networkConfig?.country || country
          const operators = await getUtilityOperators(derivedCountryCode)
          const fallback = limitsFromReloadlyOperators(operators, network, currency)
          if (fallback) {
            setOperatorLimits(fallback)
            setLimitsError(null)
            return
          }
        } catch {
          /* use error below */
        }
      }
      setOperatorLimits(null)
      setLimitsError(err.response?.data?.error || err.message)
    } finally {
      setLimitsLoading(false)
    }
  }, [isData, network, fullPhone, country, currency])

  useEffect(() => {
    if (isData) return
    if (!phoneValid || !network) {
      setOperatorLimits(null)
      setLimitsError(null)
      return
    }
    loadOperatorLimits()
  }, [isData, phoneValid, network, fullPhone, loadOperatorLimits])

  const canProceed = isData
    ? !!selectedBundle
      && hasUsdcTrustline !== false
      && !exceedsWallet
      && network
      && phoneValid
    : netFiat > 0
      && minFiat != null
      && maxFiat != null
      && netFiat >= minFiat
      && netFiat <= maxFiat
      && hasUsdcTrustline !== false
      && !exceedsWallet
      && network
      && phoneValid
      && !limitsLoading

  if (isLocked) return <BiometricLock />

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig?.country || country

      const quote = await getUtilityQuote({
        country: derivedCountryCode,
        networkCode: network,
        recipientPhone: fullPhone,
        fiatAmount: Math.round(netFiat),
        type: utilityType,
        ...(isData && selectedBundle ? {
          operatorId: selectedBundle.operatorId,
          bundleDescription: selectedBundle.description,
        } : {}),
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
      setError(mapApiError(err))
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
            Staging mode — utilities use mock Reloadly until API keys are added.
          </p>
        </div>
      )}

      {isData && dataAvailability && !dataAvailability.available && ['KE', 'TZ', 'RW'].includes(String(country).toUpperCase()) && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-3 mb-4">
          <p className="text-rowan-yellow text-sm">
            Reloadly sandbox has no data plans for {country}. Use Airtime here, or switch to Uganda for data bundle tests.
          </p>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">USDC balance</p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-rowan-text text-2xl font-bold tabular-nums">
            {spendableUsdc != null ? Number(spendableUsdc).toFixed(2) : '—'} USDC
          </span>
          {!isData && walletMaxFiat != null && walletMaxFiat > 0 && (
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

      <div className="mt-2">
        <NetworkSelector selected={network} onSelect={setNetwork} country={country} />
      </div>

      <div className="mt-6">
        <PhoneInput phone={phone} onPhoneChange={setPhone} network={network} />
        <p className="text-rowan-muted text-xs mt-2 px-1">{meta.phoneHint}</p>
      </div>

      {isData ? (
        <div className="mt-6">
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3 px-1">
            Choose a data plan
          </p>
          {bundlesError && (
            <div className="mb-3 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-3">
              <p className="text-rowan-yellow text-sm">{bundlesError}</p>
              <button
                type="button"
                onClick={loadBundles}
                className="text-rowan-yellow text-xs underline mt-2 min-h-11"
              >
                Retry
              </button>
            </div>
          )}
          <DataBundlePicker
            bundles={bundles}
            selected={selectedBundle}
            onSelect={setSelectedBundle}
            loading={bundlesLoading}
            currency={currency}
            operatorName={bundleOperatorName}
          />
          {selectedBundle && usdcEstimate > 0 && (
            <p className="text-rowan-muted text-xs mt-3 px-1 tabular-nums">
              ≈ {usdcEstimate.toFixed(4)} USDC including {feePercent}% fee
            </p>
          )}
        </div>
      ) : (
        <>
          {limitsLoading && (
            <p className="text-rowan-muted text-xs mt-4 px-1">Loading limits from Reloadly…</p>
          )}
          {limitsError && (
            <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-3">
              <p className="text-rowan-yellow text-sm">{limitsError}</p>
              <button
                type="button"
                onClick={loadOperatorLimits}
                className="text-rowan-yellow text-xs underline mt-2 min-h-11"
              >
                Retry
              </button>
            </div>
          )}
          {operatorLimits?.operatorName && !limitsLoading && (
            <p className="text-rowan-muted text-xs mt-4 px-1">
              Limits for {operatorLimits.operatorName}
              {operatorLimits.source?.startsWith('auto-detect')
                ? ' · detected from your number'
                : ''}
            </p>
          )}
          {(fixedAmounts.length > 0 || suggestedAmounts.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2 px-1">
              {(fixedAmounts.length ? fixedAmounts : suggestedAmounts).map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setFiatAmount(String(amount))}
                  className={`text-xs font-medium rounded-full px-3 py-2 border min-h-11 ${
                    Number(fiatAmount) === amount
                      ? 'border-rowan-yellow bg-rowan-yellow/10 text-rowan-yellow'
                      : 'border-rowan-border text-rowan-muted'
                  }`}
                >
                  {Number(amount).toLocaleString()} {currency}
                </button>
              ))}
            </div>
          )}
          <AmountInput
            fiatAmount={fiatAmount}
            onFiatAmountChange={setFiatAmount}
            currency={currency}
            cryptoEstimate={usdcEstimate}
            cryptoLabel="USDC"
            platformFeeFiat={netFiat * (feePercent / 100)}
            maxFiat={Math.min(maxFiat ?? Infinity, walletMaxFiat ?? maxFiat ?? Infinity)}
          />
          {minFiat != null && maxFiat != null && (
            <p className="text-rowan-muted text-xs mt-2 px-1">
              Min {Math.ceil(minFiat).toLocaleString()} · Max {Math.floor(maxFiat).toLocaleString()} {currency}
              {utilityConfig?.limitsSource === 'reloadly' ? ' (from Reloadly)' : ''}
            </p>
          )}
        </>
      )}

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
                  <span className="text-rowan-text text-sm font-medium truncate">
                    {item.bundleDescription || item.bundle_description
                      || `${Number(item.fiatAmount).toLocaleString()} ${item.fiatCurrency}`}
                  </span>
                  <span className={`text-xs font-medium shrink-0 ${
                    item.status === 'COMPLETED' ? 'text-rowan-green'
                      : item.status === 'FAILED' ? 'text-rowan-red'
                        : 'text-rowan-muted'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-rowan-muted text-xs mt-1 truncate">
                  {item.bundleDescription || item.bundle_description
                    ? `${Number(item.fiatAmount).toLocaleString()} ${item.fiatCurrency} · ${item.recipientPhone}`
                    : item.recipientPhone}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
