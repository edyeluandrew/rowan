import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ArrowDownToLine, AlertTriangle, UserCheck } from 'lucide-react'
import useRates from '../hooks/useRates'
import useWallet from '../hooks/useWallet'
import useActiveTransaction from '../hooks/useActiveTransaction'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import { getQuote } from '../api/cashout'
import client from '../api/client'
import { hashPhoneNumber } from '../utils/crypto'
import { NETWORKS, COUNTRY_CODES } from '../utils/constants'
import { estimateMaxNetFiatFromUsdc } from '../utils/fiat'
import { getNetworksForCountry } from '../utils/country'
import useUserCountry from '../hooks/useUserCountry'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import PaymentMethodPill from '../components/ui/PaymentMethodPill'
import Button from '../components/ui/Button'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'

export default function Cashout() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    selectedAd,
    payoutSettingId: presetPayoutSettingId,
    traderName: presetTraderName,
    network: presetNetwork,
  } = location.state || {}
  const { isLocked } = useBiometricProtection()
  const { country, fiatCurrency: userFiat } = useUserCountry()
  const { allRates, rates } = useRates(userFiat)
  const { usdcBalance, hasUsdcTrustline } = useWallet()
  const { activeTransaction, loading: activeLoading } = useActiveTransaction()
  const adNetwork = presetNetwork || selectedAd?.network || null
  const payoutSettingId = presetPayoutSettingId || selectedAd?.payoutSettingId || selectedAd?.id
  const networkLocked = !!(payoutSettingId && adNetwork)
  const [fiatAmount, setFiatAmount] = useState('')
  const [network, setNetwork] = useState(adNetwork)
  const [phone, setPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [networkLimits, setNetworkLimits] = useState([])

  useEffect(() => {
    client.get('/api/v1/config/cashout-limits')
      .then((res) => setNetworkLimits(res.data?.data?.networkLimits || []))
      .catch(() => {})
  }, [])

  const countryNetworks = useMemo(
    () => Object.keys(getNetworksForCountry(country)),
    [country]
  )

  const netFiat = parseFloat(fiatAmount) || 0

  useEffect(() => {
    if (adNetwork) setNetwork(adNetwork)
  }, [adNetwork])

  useEffect(() => {
    if (!activeLoading && activeTransaction?.id) {
      navigate(`/wallet/transaction/${activeTransaction.id}`, { replace: true })
    }
  }, [activeLoading, activeTransaction, navigate])

  const selectedRate = network && allRates
    ? Array.isArray(allRates)
      ? allRates.find((r) => r.network === network)
      : allRates[network] != null
        ? { rate: allRates[network], fee: 0 }
        : null
    : null
  const rateValue = selectedRate?.rate || 0
  const currency = network ? NETWORKS[network]?.currency : userFiat

  const usdcToFiatRate = rates?.usdcToFiat || 0

  const walletMaxNetFiat = useMemo(() => {
    if (!usdcToFiatRate || usdcBalance == null) return null
    return estimateMaxNetFiatFromUsdc(usdcBalance, usdcToFiatRate)
  }, [usdcBalance, usdcToFiatRate])

  const selectedNetworkLimits = useMemo(
    () => networkLimits.find((l) => l.network === network),
    [networkLimits, network]
  )

  const traderMinFiat = selectedAd?.minAmount ?? null
  const traderMaxFiat = selectedAd?.maxAmount ?? null
  const traderFloatFiat = selectedAd?.availableFloat ?? selectedAd?.available_float ?? null

  const maxNetFiat = useMemo(() => {
    const caps = [
      walletMaxNetFiat,
      selectedNetworkLimits?.maxFiat,
      traderMaxFiat,
      traderFloatFiat,
    ].filter((v) => v != null && Number.isFinite(v) && v > 0)
    if (caps.length === 0) return null
    return Math.min(...caps)
  }, [walletMaxNetFiat, selectedNetworkLimits, traderMaxFiat, traderFloatFiat])

  const minNetFiat = traderMinFiat ?? selectedNetworkLimits?.minFiat ?? null

  const usdcEstimate = usdcToFiatRate > 0 && netFiat > 0
    ? (netFiat / usdcToFiatRate) * 1.03
    : 0
  const platformFeeFiat = netFiat > 0 ? netFiat * 0.01 : 0

  const exceedsWallet = maxNetFiat != null && netFiat > maxNetFiat
  const belowMin = minNetFiat != null && netFiat > 0 && netFiat < minNetFiat
  const exceedsTraderFloat =
    traderFloatFiat != null && netFiat > 0 && netFiat > traderFloatFiat

  const canProceed =
    netFiat > 0 &&
    hasUsdcTrustline !== false &&
    !exceedsWallet &&
    !belowMin &&
    !exceedsTraderFloat &&
    network &&
    phone.length >= 7 &&
    recipientName.trim().length >= 2

  if (isLocked) return <BiometricLock />
  if (activeLoading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin text-rowan-yellow w-6 h-6 border-2 border-rowan-yellow border-t-transparent rounded-full" />
      </div>
    )
  }

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig
        ? COUNTRY_CODES[networkConfig.country]?.code || '+256'
        : '+256'
      const cleanPhone = phone.replace(/\D/g, '')
      const fullPhone = `${derivedCountryCode}${cleanPhone}`
      const phoneHash = await hashPhoneNumber(fullPhone)
      const quote = await getQuote({
        fiatAmount: Math.round(netFiat),
        network,
        phoneHash,
        payoutPhone: fullPhone,
        payoutName: recipientName.trim(),
        ...(payoutSettingId ? { payoutSettingId } : {}),
      })
      navigate('/wallet/cashout/confirm', {
        state: {
          quote,
          network,
          phone: fullPhone,
          recipientName: recipientName.trim(),
          requestedFiat: Math.round(netFiat),
          selectedAd,
          traderName: presetTraderName || selectedAd?.traderName,
          payoutSettingId,
        },
      })
    } catch (err) {
      const data = err.response?.data
      if (data?.error === 'active_order_exists' && data?.transaction_id) {
        navigate(`/wallet/transaction/${data.transaction_id}`, { replace: true })
        return
      }
      setError(data?.message || data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMax = () => {
    if (maxNetFiat != null && maxNetFiat > 0) {
      setFiatAmount(String(Math.floor(maxNetFiat)))
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Sell</h1>
      </div>

      <UsdcTrustlineSetup compact />

      {(selectedAd || presetTraderName) && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <UserCheck size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-text text-sm font-medium">
              Trading with {presetTraderName || selectedAd?.traderName || 'selected trader'}
            </p>
            <p className="text-rowan-muted text-xs mt-1">
              Only this trader will handle your order — we will not switch you to another trader.
            </p>
          </div>
        </div>
      )}

      {!selectedAd && !presetTraderName && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-text text-sm font-medium">Express sell</p>
          <p className="text-rowan-muted text-xs mt-1">
            We will auto-match the best available trader for your amount and network.
          </p>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Available to cash out</p>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-rowan-text text-2xl font-bold tabular-nums">
              {walletMaxNetFiat != null && currency
                ? Math.floor(walletMaxNetFiat).toLocaleString()
                : '—'}
            </span>
            <span className="text-rowan-muted">{currency || 'UGX'}</span>
          </div>
          {maxNetFiat != null && maxNetFiat > 0 && (
            <button
              type="button"
              onClick={handleMax}
              className="text-rowan-yellow text-xs font-medium border border-rowan-yellow/40 rounded-full px-3 py-1"
            >
              Max
            </button>
          )}
        </div>
        <p className="text-rowan-muted text-xs mt-1">
          {usdcBalance != null ? `${Number(usdcBalance).toFixed(2)} USDC in wallet` : ''}
        </p>
      </div>

      <AmountInput
        fiatAmount={fiatAmount}
        onFiatAmountChange={setFiatAmount}
        currency={currency}
        cryptoEstimate={usdcEstimate}
        cryptoLabel="USDC to send (estimate)"
        platformFeeFiat={platformFeeFiat}
        maxFiat={maxNetFiat}
      />

      <div className="mt-6">
        {networkLocked && network ? (
          <div>
            <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3">
              Mobile money network
            </p>
            <div className="bg-rowan-surface border border-rowan-yellow/40 rounded-xl p-4 flex items-center justify-between">
              <PaymentMethodPill network={network} />
              <span className="text-rowan-muted text-xs">From trader ad</span>
            </div>
          </div>
        ) : (
          <NetworkSelector selected={network} onSelect={setNetwork} country={country} />
        )}
      </div>

      {networkLocked && minNetFiat != null && maxNetFiat != null && (
        <p className="text-rowan-muted text-xs mt-4 text-center">
          Order limits: {Math.ceil(minNetFiat).toLocaleString()} – {Math.floor(maxNetFiat).toLocaleString()} {currency}
        </p>
      )}

      <div className="mt-6">
        <PhoneInput
          phone={phone}
          onPhoneChange={setPhone}
          network={network}
        />
      </div>

      <div className="mt-6">
        <label className="block text-rowan-muted text-xs font-medium mb-2 uppercase tracking-wider">
          Recipient Mobile Money Name
        </label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="e.g., Edyelu Andrew"
          className="w-full bg-rowan-surface border border-rowan-border rounded-lg px-4 py-3 text-rowan-text placeholder-rowan-muted focus:outline-none focus:border-rowan-yellow"
        />
        <p className="text-rowan-muted text-xs mt-1">The mobile money account holder name</p>
      </div>

      {error && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      {(exceedsWallet || belowMin || exceedsTraderFloat) && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            {exceedsWallet && (
              <>
                <p className="text-rowan-yellow text-sm font-medium">Amount exceeds your balance</p>
                <p className="text-rowan-muted text-xs mt-1">
                  Maximum is about {Math.floor(maxNetFiat).toLocaleString()} {currency} with your current USDC.
                </p>
              </>
            )}
            {belowMin && (
              <>
                <p className="text-rowan-yellow text-sm font-medium">Amount too small</p>
                <p className="text-rowan-muted text-xs mt-1">
                  Minimum payout is {Math.ceil(minNetFiat).toLocaleString()} {currency}.
                </p>
              </>
            )}
            {exceedsTraderFloat && traderFloatFiat != null && (
              <>
                <p className="text-rowan-yellow text-sm font-medium">Amount exceeds trader float</p>
                <p className="text-rowan-muted text-xs mt-1">
                  This trader only has about {Math.floor(traderFloatFiat).toLocaleString()} {currency} available right now.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!canProceed && (
        <div className="mt-6 p-3 bg-rowan-surface rounded-lg border border-rowan-border">
          <p className="text-rowan-muted text-xs font-medium mb-2">To proceed, you need:</p>
          <ul className="text-xs space-y-1">
            <li className={netFiat > 0 && !exceedsWallet && !belowMin ? 'text-rowan-green' : 'text-rowan-muted'}>
              {netFiat > 0 && !exceedsWallet && !belowMin ? '✓' : '✗'} Valid {currency || 'fiat'} amount
            </li>
            <li className={network ? 'text-rowan-green' : 'text-rowan-muted'}>
              {network ? '✓' : '✗'} Mobile money provider selected
            </li>
            <li className={phone.length >= 7 ? 'text-rowan-green' : 'text-rowan-muted'}>
              {phone.length >= 7 ? '✓' : '✗'} Phone number: {phone.length}/7+ digits
            </li>
            <li className={recipientName.trim().length >= 2 ? 'text-rowan-green' : 'text-rowan-muted'}>
              {recipientName.trim().length >= 2 ? '✓' : '✗'} Recipient name: {recipientName.length}/2+ characters
            </li>
          </ul>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={handleGetQuote} loading={loading} disabled={!canProceed}>
          <ArrowDownToLine size={18} className="mr-2" />
          Get Quote
        </Button>
      </div>
    </div>
  )
}
