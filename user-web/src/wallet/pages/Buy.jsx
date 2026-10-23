import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, UserCheck, Zap } from 'lucide-react'
import useActiveTransaction from '../hooks/useActiveTransaction'
import useUserCountry from '../hooks/useUserCountry'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import { getBuyQuote } from '../api/buy'
import { hashPhoneNumber } from '../utils/crypto'
import { NETWORKS } from '../utils/constants'
import { formatUsdcRateLine } from '../utils/p2pFormat'
import { getDialCodeForCountry } from '../utils/country'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import Button from '../components/ui/Button'
import PaymentMethodPill from '../components/ui/PaymentMethodPill'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'
import { mapApiError } from '../utils/apiErrors'
import { getRatesHealth } from '../utils/quoteSafety'

/** Match backend P2P buy quote: trader price + 1% Rowan fee (no extra spread). */
const FEE_FACTOR = 0.99

function estimateUsdcFromFiat(fiatAmount, usdcToFiat) {
  if (!Number.isFinite(fiatAmount) || fiatAmount <= 0 || !Number.isFinite(usdcToFiat) || usdcToFiat <= 0) {
    return 0
  }
  return (fiatAmount * FEE_FACTOR) / usdcToFiat
}

export default function Buy() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    selectedAd,
    payoutSettingId: presetPayoutSettingId,
    traderName: presetTraderName,
    network: presetNetwork,
    traderOffers: presetOffers,
    express: expressFlag,
    prefillFiat,
    expressMatch,
  } = location.state || {}

  const { country, fiatCurrency: userFiat } = useUserCountry()
  const { hasUsdcTrustline } = useWallet()
  const { rates, refresh: refreshRates } = useRates(userFiat)
  const { activeTransaction, loading: activeLoading } = useActiveTransaction()

  const traderOffers = Array.isArray(presetOffers) ? presetOffers : []
  const offerNetworks = [...new Set(traderOffers.map((offer) => offer.network).filter(Boolean))]
  const mustPickNetwork = offerNetworks.length > 1
  const soleOffer = offerNetworks.length === 1
    ? (traderOffers.find((offer) => offer.network === offerNetworks[0]) || null)
    : null
  const [pickedOffer, setPickedOffer] = useState(null)
  const activeAd = mustPickNetwork ? pickedOffer : (selectedAd || soleOffer)
  const adNetwork = mustPickNetwork
    ? (pickedOffer?.network || null)
    : (presetNetwork || activeAd?.network || null)
  const payoutSettingId = mustPickNetwork
    ? (pickedOffer?.payoutSettingId || pickedOffer?.id || null)
    : (presetPayoutSettingId || activeAd?.payoutSettingId || activeAd?.id)
  const isAutomated = !mustPickNetwork && !payoutSettingId
  const isExpress = Boolean(expressFlag && isAutomated)
  const networkLocked = !mustPickNetwork && !!adNetwork && (!isAutomated || expressMatch)

  const [fiatAmount, setFiatAmount] = useState(prefillFiat ? String(prefillFiat) : '')
  const [network, setNetwork] = useState(mustPickNetwork ? null : adNetwork)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      navigate('/wallet/p2p', { replace: true, state: { tab: 'buy' } })
    }
  }, [activeLoading, activeTransaction, payoutSettingId, mustPickNetwork, navigate])

  const netFiat = parseFloat(fiatAmount) || 0
  const currency = network ? NETWORKS[network]?.currency : userFiat
  const minNetFiat = isAutomated ? 500 : (activeAd?.minAmount ?? null)
  const maxNetFiat = activeAd?.maxAmount ?? null
  const traderRate = activeAd?.ratePerUsdc != null ? Number(activeAd.ratePerUsdc) : null
  const availableUsdc = activeAd?.availableUsdc ?? activeAd?.available_usdc
  const liveUsdcToFiat = rates?.usdcToFiat != null ? Number(rates.usdcToFiat) : null
  const maxFiatFromUsdc =
    traderRate && availableUsdc
      ? Math.floor(Number(availableUsdc) * traderRate * FEE_FACTOR)
      : null
  const effectiveMaxFiat =
    maxNetFiat != null && maxFiatFromUsdc != null
      ? Math.min(maxNetFiat, maxFiatFromUsdc)
      : maxNetFiat ?? maxFiatFromUsdc
  const belowMin = minNetFiat != null && netFiat > 0 && netFiat < minNetFiat
  const exceedsMax = effectiveMaxFiat != null && netFiat > effectiveMaxFiat
  const phoneOk = !isAutomated || phone.replace(/\D/g, '').length >= 9

  const usdcToFiat = traderRate && traderRate > 0
    ? traderRate
    : (liveUsdcToFiat && liveUsdcToFiat > 0 ? liveUsdcToFiat : null)

  const usdcEstimate = estimateUsdcFromFiat(netFiat, usdcToFiat)
  const platformFeeFiat = netFiat > 0 ? netFiat * 0.01 : 0
  const traderRateLine = formatUsdcRateLine(currency, traderRate)

  const canProceed =
    network &&
    netFiat > 0 &&
    (isAutomated || traderRate) &&
    phoneOk &&
    !belowMin &&
    !exceedsMax &&
    !loading &&
    hasUsdcTrustline !== false

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const snap = await refreshRates()
      const health = getRatesHealth(snap?.rates, snap?.fetchedAt, snap?.error)
      if (!health.ok && isAutomated && !traderRate) {
        setError(health.message)
        return
      }

      let payoutPhone
      let phoneHash
      if (isAutomated) {
        const networkConfig = NETWORKS[network]
        const derivedCountryCode = networkConfig?.country || country
        const dialCode = getDialCodeForCountry(derivedCountryCode).replace(/\D/g, '')
        const cleanPhone = phone.replace(/\D/g, '')
        payoutPhone = `${dialCode}${cleanPhone.replace(/^0/, '')}`
        phoneHash = await hashPhoneNumber(payoutPhone)
      } else {
        phoneHash = await hashPhoneNumber('buy-placeholder')
      }

      const quote = await getBuyQuote({
        fiatAmount: netFiat,
        network,
        phoneHash,
        payoutSettingId: isAutomated ? undefined : payoutSettingId,
        payoutPhone,
      })
      navigate('/wallet/buy/confirm', {
        state: {
          quote: {
            ...quote,
            fiatCurrency: quote.fiatCurrency || currency,
          },
          network,
          traderName: presetTraderName || activeAd?.traderName || quote.traderName,
          selectedAd: isAutomated ? null : activeAd,
          express: isExpress,
          automated: Boolean(quote.automated || isAutomated),
          liveUsdcToFiat: health.ok ? health.usdcToFiat : traderRate,
          rateSnapshotAt: snap?.fetchedAt || Date.now(),
        },
      })
    } catch (err) {
      setError(mapApiError(err, 'Could not get quote'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Buy USDC</h1>
      </div>

      {isAutomated && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-text text-sm font-medium">Pay from your phone</p>
          <p className="text-rowan-muted text-xs mt-1">
            Pick a trader on P2P. They send you payment instructions.
          </p>
        </div>
      )}

      {expressMatch && !isAutomated && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 flex items-start gap-3">
          <Zap size={20} className="text-rowan-gold shrink-0 mt-0.5" />
          <p className="text-rowan-text text-sm font-medium">Express match</p>
        </div>
      )}

      {!isAutomated && (presetTraderName || activeAd?.traderName || mustPickNetwork) && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 flex items-start gap-3">
          <UserCheck size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-text text-sm font-semibold">
              {presetTraderName || activeAd?.traderName || 'Selected trader'}
            </p>
            {traderRateLine && (
              <p className="text-rowan-yellow text-xs font-medium mt-1">{traderRateLine}</p>
            )}
            {availableUsdc != null && (
              <p className="text-rowan-muted text-xs mt-1">
                {Number(availableUsdc).toFixed(2)} USDC available
              </p>
            )}
          </div>
        </div>
      )}

      <UsdcTrustlineSetup />

      <AmountInput
        fiatAmount={fiatAmount}
        onFiatAmountChange={setFiatAmount}
        currency={currency}
        cryptoEstimate={usdcEstimate}
        cryptoLabel="USDC"
        fiatSubLabel={currency || userFiat}
        platformFeeFiat={platformFeeFiat}
        maxFiat={effectiveMaxFiat}
      />

      {!isAutomated && activeAd && !traderRate && (
        <p className="text-rowan-red text-xs mt-2 text-center">
          This trader has not set a USDC price. Choose another ad in the marketplace.
        </p>
      )}

      <div className="mt-6">
        {mustPickNetwork ? (
          <NetworkSelector
            selected={network}
            onSelect={(key) => {
              setPickedOffer(traderOffers.find((offer) => offer.network === key) || null)
              setNetwork(key)
            }}
            country={country}
            networks={offerNetworks}
            prompt={`Choose ${offerNetworks.map((key) => NETWORKS[key]?.label || key).join(' or ')}`}
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
        ) : !presetTraderName ? (
          <NetworkSelector selected={network} onSelect={setNetwork} country={country} />
        ) : null}
      </div>

      {isAutomated && (
        <div className="mt-6">
          <PhoneInput phone={phone} onPhoneChange={setPhone} network={network} />
        </div>
      )}

      {belowMin && (
        <p className="text-rowan-red text-xs mt-2 text-center">
          {isAutomated ? 'Minimum is 500 UGX' : 'Amount below trader minimum'}
        </p>
      )}
      {exceedsMax && (
        <p className="text-rowan-red text-xs mt-2 text-center">Amount above trader limit</p>
      )}

      {error && (
        <p className="text-rowan-red text-sm mt-4">{error}</p>
      )}

      <Button className="w-full mt-8" disabled={!canProceed} loading={loading} onClick={handleGetQuote}>
        Get Quote
      </Button>
    </div>
  )
}
