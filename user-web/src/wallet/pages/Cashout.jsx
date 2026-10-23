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
import { NETWORKS } from '../utils/constants'
import { netFiatFromUsdcSell, usdcForNetFiat } from '../utils/fiat'
import { sanitizeAmount } from '../utils/sanitizeAmount'
import { getDialCodeForCountry } from '../utils/country'
import useUserCountry from '../hooks/useUserCountry'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import PaymentMethodPill from '../components/ui/PaymentMethodPill'
import Button from '../components/ui/Button'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'
import { mapApiError } from '../utils/apiErrors'
import { getRatesHealth } from '../utils/quoteSafety'
import { formatUsdcRateLine } from '../utils/p2pFormat'

export default function Cashout() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    selectedAd,
    payoutSettingId: presetPayoutSettingId,
    traderName: presetTraderName,
    network: presetNetwork,
    traderOffers: presetOffers,
    prefillFiat,
    expressMatch,
  } = location.state || {}
  const { isLocked } = useBiometricProtection()
  const { country, fiatCurrency: userFiat } = useUserCountry()
  const { refresh: refreshRates } = useRates(userFiat)
  const { usdcBalance, hasUsdcTrustline } = useWallet()
  const { activeTransaction, loading: activeLoading } = useActiveTransaction()
  const traderOffers = Array.isArray(presetOffers) ? presetOffers : []
  const mustPickNetwork = traderOffers.length > 0
  const [pickedOffer, setPickedOffer] = useState(null)
  const activeAd = mustPickNetwork ? pickedOffer : selectedAd
  const adNetwork = mustPickNetwork
    ? (pickedOffer?.network || null)
    : (presetNetwork || selectedAd?.network || null)
  const payoutSettingId = mustPickNetwork
    ? (pickedOffer?.payoutSettingId || pickedOffer?.id || null)
    : (presetPayoutSettingId || selectedAd?.payoutSettingId || selectedAd?.id)
  const networkLocked = !mustPickNetwork && !!(payoutSettingId && adNetwork)
  const openedRate = Number(selectedAd?.ratePerUsdc || selectedAd?.rate_per_usdc || 0)
  const [usdcAmount, setUsdcAmount] = useState(() => {
    if (!prefillFiat || !(openedRate > 0)) return ''
    const usdc = usdcForNetFiat(prefillFiat, openedRate)
    return usdc > 0 ? String(Number(usdc.toFixed(4))) : ''
  })
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

  useEffect(() => {
    if (mustPickNetwork || !adNetwork) return
    setNetwork(adNetwork)
  }, [adNetwork, mustPickNetwork])

  useEffect(() => {
    if (!activeLoading && activeTransaction?.id) {
      navigate(`/wallet/transaction/${activeTransaction.id}`, { replace: true })
    }
  }, [activeLoading, activeTransaction, navigate])

  useEffect(() => {
    if (activeLoading || activeTransaction?.id) return
    if (!payoutSettingId && !mustPickNetwork) {
      navigate('/wallet/p2p', { replace: true, state: { tab: 'sell' } })
    }
  }, [activeLoading, activeTransaction, payoutSettingId, mustPickNetwork, navigate])

  const currency = network ? NETWORKS[network]?.currency : userFiat

  const traderRate = Number(activeAd?.ratePerUsdc || activeAd?.rate_per_usdc || 0)
  const traderRateLine = formatUsdcRateLine(currency, activeAd?.ratePerUsdc ?? activeAd?.rate_per_usdc)

  const usdcToSell = parseFloat(usdcAmount) || 0
  const receiveFiat = traderRate > 0
    ? (currency === 'KES'
        ? Number(netFiatFromUsdcSell(usdcToSell, traderRate).toFixed(2))
        : Math.round(netFiatFromUsdcSell(usdcToSell, traderRate)))
    : 0

  const selectedNetworkLimits = useMemo(
    () => networkLimits.find((l) => l.network === network),
    [networkLimits, network]
  )

  const traderMinFiat = activeAd?.minAmount ?? null
  const traderMaxFiat = activeAd?.maxAmount ?? null
  const traderFloatFiat = activeAd?.availableFloat ?? activeAd?.available_float ?? null

  const maxUsdc = useMemo(() => {
    const caps = []
    if (usdcBalance != null && Number(usdcBalance) > 0) caps.push(Number(usdcBalance))
    const room = (fiat) => (traderRate > 0 && Number(fiat) > 0 ? usdcForNetFiat(fiat, traderRate) : null)
    ;[traderFloatFiat, traderMaxFiat, selectedNetworkLimits?.maxFiat].forEach((fiat) => {
      const cap = room(fiat)
      if (cap != null && cap > 0) caps.push(cap)
    })
    if (caps.length === 0) return null
    return Math.min(...caps)
  }, [usdcBalance, traderRate, traderFloatFiat, traderMaxFiat, selectedNetworkLimits])

  const minFiat = traderMinFiat ?? selectedNetworkLimits?.minFiat ?? null
  const minUsdc = traderRate > 0 && Number(minFiat) > 0 ? usdcForNetFiat(minFiat, traderRate) : null

  const exceedsWallet = usdcBalance != null && usdcToSell > Number(usdcBalance) + 1e-6
  const belowMin = minUsdc != null && usdcToSell > 0 && usdcToSell + 1e-6 < minUsdc
  const exceedsTraderFloat =
    traderFloatFiat != null && receiveFiat > 0 && receiveFiat > Number(traderFloatFiat)

  const canProceed =
    usdcToSell > 0 &&
    receiveFiat > 0 &&
    hasUsdcTrustline !== false &&
    !exceedsWallet &&
    !belowMin &&
    !exceedsTraderFloat &&
    network &&
    traderRate > 0 &&
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
      const snap = await refreshRates()
      const health = getRatesHealth(snap?.rates, snap?.fetchedAt, snap?.error)
      const hasTraderRate = activeAd?.ratePerUsdc != null || activeAd?.rate_per_usdc != null
      if (!health.ok && !hasTraderRate) {
        setError(health.message)
        return
      }

      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig?.country || country
      const dialCode = getDialCodeForCountry(derivedCountryCode).replace(/\D/g, '')
      const cleanPhone = phone.replace(/\D/g, '')
      const fullPhone = `${dialCode}${cleanPhone.replace(/^0/, '')}`
      const phoneHash = await hashPhoneNumber(fullPhone)
      const quote = await getQuote({
        fiatAmount: receiveFiat,
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
          requestedFiat: receiveFiat,
          selectedAd: activeAd,
          traderName: presetTraderName || activeAd?.traderName,
          payoutSettingId,
          liveUsdcToFiat: health.ok ? health.usdcToFiat : null,
          rateSnapshotAt: snap?.fetchedAt || Date.now(),
        },
      })
    } catch (err) {
      const data = err.response?.data
      if (data?.error === 'active_order_exists' && data?.transaction_id) {
        navigate(`/wallet/transaction/${data.transaction_id}`, { replace: true })
        return
      }
      setError(mapApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleMax = () => {
    if (maxUsdc != null && maxUsdc > 0) {
      setUsdcAmount(String(Number(maxUsdc.toFixed(4))))
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

      {(activeAd || presetTraderName || mustPickNetwork) && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <UserCheck size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-text text-sm font-medium">
              Trading with {presetTraderName || activeAd?.traderName || 'selected trader'}
            </p>
            {traderRateLine && (
              <p className="text-rowan-yellow text-xs font-medium mt-1">{traderRateLine}</p>
            )}
          </div>
        </div>
      )}

      {!activeAd && !presetTraderName && !mustPickNetwork && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-text text-sm font-medium">Cash out to your phone</p>
          <p className="text-rowan-muted text-xs mt-1">
            A trader sends mobile money to your MTN or Airtel number.
          </p>
        </div>
      )}

      {expressMatch && (activeAd || presetTraderName) && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-text text-sm font-medium">Express match</p>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <label htmlFor="sell-usdc" className="text-rowan-muted text-xs uppercase tracking-wider">
            USDC to sell
          </label>
          <span className="text-rowan-muted text-xs tabular-nums">
            Balance {Number(usdcBalance || 0).toFixed(4)}
          </span>
        </div>
        <div className="flex min-h-14 items-center rounded-2xl border border-rowan-border bg-rowan-bg focus-within:border-rowan-yellow">
          <input
            id="sell-usdc"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={usdcAmount}
            onChange={(e) => setUsdcAmount(sanitizeAmount(e.target.value, { decimals: 4 }))}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-2xl font-semibold tabular-nums text-rowan-text outline-none placeholder:text-rowan-muted/40"
          />
          <span className="pr-4 text-sm font-semibold text-rowan-muted">USDC</span>
        </div>
        {maxUsdc != null && maxUsdc > 0 && (
          <button
            type="button"
            onClick={handleMax}
            className="mt-3 text-rowan-yellow text-xs font-medium border border-rowan-yellow/40 rounded-full px-3 py-1"
          >
            Max
          </button>
        )}
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
        <p className="text-rowan-muted text-xs uppercase tracking-wider">You'll receive</p>
        <p className="text-rowan-text text-3xl font-bold tabular-nums mt-1">
          {receiveFiat > 0 ? Number(receiveFiat).toLocaleString('en-US') : '0'}
          <span className="text-base font-semibold text-rowan-muted ml-2">{currency || userFiat}</span>
        </p>
        <p className="text-rowan-muted text-xs mt-2">
          {mustPickNetwork && !network
            ? 'Choose MTN or Airtel to see what you will receive.'
            : (traderRateLine || 'This trader has not set a USDC price yet')}
        </p>
        {receiveFiat > 0 && (
          <p className="text-rowan-muted text-xs mt-1">
            The 1% fee is inside the USDC you sell. This is the mobile money you get.
          </p>
        )}
      </div>

      <div className="mt-6">
        {mustPickNetwork ? (
          <NetworkSelector
            selected={network}
            onSelect={(key) => {
              setPickedOffer(traderOffers.find((offer) => offer.network === key) || null)
              setNetwork(key)
            }}
            country={country}
            networks={traderOffers.map((offer) => offer.network)}
            prompt="Choose the network you want to receive on"
          />
        ) : networkLocked && network ? (
          <div>
            <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3">
              Mobile money network
            </p>
            <div className="bg-rowan-surface border border-rowan-yellow/40 rounded-xl p-4">
              <PaymentMethodPill network={network} />
            </div>
          </div>
        ) : (
          <NetworkSelector selected={network} onSelect={setNetwork} country={country} />
        )}
      </div>

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
      </div>

      {error && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      {(exceedsWallet || belowMin || exceedsTraderFloat) && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            {exceedsWallet && (
              <p className="text-rowan-yellow text-sm font-medium">Amount exceeds your balance</p>
            )}
            {belowMin && (
              <p className="text-rowan-yellow text-sm font-medium">Amount too small</p>
            )}
            {exceedsTraderFloat && (
              <p className="text-rowan-yellow text-sm font-medium">Amount exceeds trader capacity</p>
            )}
          </div>
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
