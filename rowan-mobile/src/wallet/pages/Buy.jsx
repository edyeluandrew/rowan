import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Coins, UserCheck } from 'lucide-react'
import useActiveTransaction from '../hooks/useActiveTransaction'
import useUserCountry from '../hooks/useUserCountry'
import useWallet from '../hooks/useWallet'
import { getBuyQuote } from '../api/buy'
import { hashPhoneNumber } from '../utils/crypto'
import { NETWORKS } from '../utils/constants'
import { formatUsdcRateLine } from '../utils/p2pFormat'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import Button from '../components/ui/Button'
import PaymentMethodPill from '../components/ui/PaymentMethodPill'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'

/** Match backend buy quote fee/spread for indicative USDC estimate */
const FEE_FACTOR = 0.99
const SPREAD_FACTOR = 0.99

function estimateUsdcFromFiat(fiatAmount, usdcToFiat) {
  if (!Number.isFinite(fiatAmount) || fiatAmount <= 0 || !Number.isFinite(usdcToFiat) || usdcToFiat <= 0) {
    return 0
  }
  return (fiatAmount * FEE_FACTOR * SPREAD_FACTOR) / usdcToFiat
}

export default function Buy() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    selectedAd,
    payoutSettingId: presetPayoutSettingId,
    traderName: presetTraderName,
    network: presetNetwork,
  } = location.state || {}

  const { country, fiatCurrency: userFiat } = useUserCountry()
  const { hasUsdcTrustline } = useWallet()
  const { activeTransaction, loading: activeLoading } = useActiveTransaction()

  const adNetwork = presetNetwork || selectedAd?.network || null
  const [fiatAmount, setFiatAmount] = useState('')
  const [network, setNetwork] = useState(adNetwork)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const payoutSettingId = presetPayoutSettingId || selectedAd?.payoutSettingId || selectedAd?.id
  const networkLocked = !!adNetwork

  useEffect(() => {
    if (!payoutSettingId) {
      navigate('/wallet/marketplace', { replace: true, state: { tab: 'buy' } })
    }
  }, [payoutSettingId, navigate])

  useEffect(() => {
    if (adNetwork) setNetwork(adNetwork)
  }, [adNetwork])

  useEffect(() => {
    if (!activeLoading && activeTransaction?.id) {
      navigate(`/wallet/transaction/${activeTransaction.id}`, { replace: true })
    }
  }, [activeLoading, activeTransaction, navigate])

  const netFiat = parseFloat(fiatAmount) || 0
  const currency = network ? NETWORKS[network]?.currency : userFiat
  const minNetFiat = selectedAd?.minAmount ?? null
  const maxNetFiat = selectedAd?.maxAmount ?? null
  const traderRate = selectedAd?.ratePerUsdc != null ? Number(selectedAd.ratePerUsdc) : null
  const availableUsdc = selectedAd?.availableUsdc ?? selectedAd?.available_usdc
  const maxFiatFromUsdc =
    traderRate && availableUsdc
      ? Math.floor(Number(availableUsdc) * traderRate * FEE_FACTOR * SPREAD_FACTOR)
      : null
  const effectiveMaxFiat =
    maxNetFiat != null && maxFiatFromUsdc != null
      ? Math.min(maxNetFiat, maxFiatFromUsdc)
      : maxNetFiat ?? maxFiatFromUsdc
  const belowMin = minNetFiat != null && netFiat > 0 && netFiat < minNetFiat
  const exceedsMax = effectiveMaxFiat != null && netFiat > effectiveMaxFiat

  const usdcToFiat = traderRate && traderRate > 0 ? traderRate : null

  const usdcEstimate = estimateUsdcFromFiat(netFiat, usdcToFiat)
  const platformFeeFiat = netFiat > 0 ? netFiat * 0.01 : 0
  const traderRateLine = formatUsdcRateLine(currency, traderRate)

  const canProceed =
    payoutSettingId &&
    network &&
    netFiat > 0 &&
    traderRate &&
    !belowMin &&
    !exceedsMax &&
    !loading &&
    hasUsdcTrustline !== false

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const phoneHash = await hashPhoneNumber('buy-placeholder')
      const quote = await getBuyQuote({
        fiatAmount: netFiat,
        network,
        phoneHash,
        payoutSettingId,
      })
      navigate('/wallet/buy/confirm', {
        state: {
          quote: {
            ...quote,
            fiatCurrency: quote.fiatCurrency || currency,
          },
          network,
          traderName: presetTraderName || selectedAd?.traderName,
          selectedAd,
        },
      })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not get quote')
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

      {(presetTraderName || selectedAd?.traderName) && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 flex items-start gap-3">
          <UserCheck size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-text text-sm font-semibold">Trader</p>
            <p className="text-rowan-muted text-sm">{presetTraderName || selectedAd?.traderName}</p>
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

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 flex items-start gap-3">
        <Coins size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-sm">
          Pay mobile money, receive USDC in your wallet after the trader confirms payment.
        </p>
      </div>

      <UsdcTrustlineSetup />

      <AmountInput
        fiatAmount={fiatAmount}
        onFiatAmountChange={setFiatAmount}
        currency={currency}
        cryptoEstimate={usdcEstimate}
        cryptoLabel="USDC you'll receive (estimate at trader price)"
        fiatSubLabel={`${currency || userFiat} you'll pay via MoMo`}
        platformFeeFiat={platformFeeFiat}
        maxFiat={effectiveMaxFiat}
      />

      {!traderRate && (
        <p className="text-rowan-red text-xs mt-2 text-center">
          This trader has not set a USDC price. Choose another ad in the marketplace.
        </p>
      )}

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

      {minNetFiat != null && effectiveMaxFiat != null && (
        <p className="text-rowan-muted text-xs mt-4 text-center">
          Order limits: {minNetFiat.toLocaleString()} – {effectiveMaxFiat.toLocaleString()} {currency}
        </p>
      )}
      {belowMin && <p className="text-rowan-red text-xs mt-2 text-center">Amount below trader minimum</p>}
      {exceedsMax && (
        <p className="text-rowan-red text-xs mt-2 text-center">
          Amount above trader limit{maxFiatFromUsdc != null && maxFiatFromUsdc < (maxNetFiat ?? Infinity)
            ? ' or available USDC'
            : ''}
        </p>
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
