import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, ShieldCheck, Clock, X } from 'lucide-react'
import { previewExpress } from '../../api/express'
import useUserCountry from '../../hooks/useUserCountry'
import useWallet from '../../hooks/useWallet'
import { NETWORKS } from '../../utils/constants'
import { getNetworksForCountry } from '../../utils/country'
import { formatPercent, formatDurationMinutes, getTraderDisplayName } from '../../utils/p2pFormat'
import NetworkSelector from '../cashout/NetworkSelector'
import Button from '../ui/Button'
import PaymentMethodPill from '../ui/PaymentMethodPill'

/**
 * Binance-style Express bottom sheet: Buy|Sell, amount, network, live best match.
 */
export default function ExpressSheet({ open, onClose, initialSide = 'buy' }) {
  const navigate = useNavigate()
  const { country, fiatCurrency } = useUserCountry()
  const { usdcBalance } = useWallet()
  const [side, setSide] = useState(initialSide === 'sell' ? 'sell' : 'buy')
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const countryNetworks = useMemo(
    () => Object.keys(getNetworksForCountry(country)),
    [country]
  )

  useEffect(() => {
    if (!open) return
    setSide(initialSide === 'sell' ? 'sell' : 'buy')
    setAmount('')
    setPreview(null)
    setError(null)
    const first = countryNetworks[0] || null
    setNetwork(first)
  }, [open, initialSide, countryNetworks])

  const currency = network ? NETWORKS[network]?.currency : fiatCurrency
  const isBuy = side === 'buy'
  const amountNum = parseFloat(amount) || 0

  const runPreview = useCallback(async () => {
    if (!network || amountNum <= 0) {
      setPreview(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const body = isBuy
        ? { side: 'buy', network, fiatAmount: amountNum }
        : { side: 'sell', network, usdcAmount: amountNum }
      const data = await previewExpress(body)
      setPreview(data)
    } catch (err) {
      setPreview(null)
      setError(err.response?.data?.error || err.message || 'No match found')
    } finally {
      setLoading(false)
    }
  }, [network, amountNum, isBuy])

  useEffect(() => {
    if (!open) return undefined
    const t = setTimeout(() => {
      runPreview()
    }, 450)
    return () => clearTimeout(t)
  }, [open, runPreview])

  if (!open) return null

  const trader = preview?.trader
  const canContinue = Boolean(preview?.available && trader?.payoutSettingId && !loading)

  const handleContinue = () => {
    if (!canContinue) return
    const ad = {
      id: trader.payoutSettingId,
      payoutSettingId: trader.payoutSettingId,
      traderId: trader.traderId,
      traderName: trader.traderName,
      trustScore: trader.trustScore,
      network: trader.network || network,
      currency: trader.currency || currency,
      minAmount: trader.minAmount,
      maxAmount: trader.maxAmount,
      ratePerUsdc: trader.ratePerUsdc,
      availableUsdc: trader.availableUsdc,
      availableFloat: trader.availableFloat,
    }

    onClose?.()

    if (isBuy) {
      navigate('/wallet/buy', {
        state: {
          selectedAd: ad,
          payoutSettingId: ad.payoutSettingId,
          traderName: trader.traderName,
          network: ad.network,
          prefillFiat: String(preview.fiatAmount),
          expressMatch: true,
        },
      })
      return
    }

    navigate('/wallet/cashout', {
      state: {
        selectedAd: ad,
        payoutSettingId: ad.payoutSettingId,
        traderName: trader.traderName,
        network: ad.network,
        prefillFiat: String(preview.estimatedFiat ?? preview.fiatAmount),
        expressMatch: true,
      },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-rowan-bg rounded-t-2xl w-full max-h-[92vh] overflow-y-auto pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-rowan-bg z-10 px-4 pt-3 pb-2 border-b border-rowan-border">
          <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-rowan-gold" />
              <h2 className="text-rowan-text text-lg font-bold">Express</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex mt-3 bg-rowan-surface border border-rowan-border rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setSide('buy'); setAmount(''); setPreview(null); setError(null) }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold min-h-11 ${
                isBuy ? 'bg-rowan-green text-white' : 'text-rowan-muted'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => { setSide('sell'); setAmount(''); setPreview(null); setError(null) }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold min-h-11 ${
                !isBuy ? 'bg-rowan-green text-white' : 'text-rowan-muted'
              }`}
            >
              Sell
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          <div>
            <label className="text-rowan-muted text-xs uppercase tracking-wider mb-2 block">
              {isBuy ? `You pay (${currency || 'fiat'})` : 'You sell (USDC)'}
            </label>
            <div className="flex items-center bg-rowan-surface border border-rowan-border rounded-xl overflow-hidden min-h-12">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={isBuy ? '0' : '0.00'}
                className="flex-1 min-w-0 bg-transparent px-4 py-3 text-rowan-text text-lg font-semibold outline-none"
              />
              <span className="pr-4 text-rowan-muted text-sm font-medium">
                {isBuy ? (currency || '') : 'USDC'}
              </span>
            </div>
            {!isBuy && usdcBalance != null && (
              <button
                type="button"
                className="text-rowan-green text-xs mt-2 min-h-9"
                onClick={() => setAmount(String(Number(usdcBalance).toFixed(2)))}
              >
                Max {Number(usdcBalance).toFixed(2)} USDC
              </button>
            )}
          </div>

          <NetworkSelector
            selected={network}
            onSelect={(n) => { setNetwork(n); setPreview(null); setError(null) }}
            country={country}
          />

          <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 min-h-[120px]">
            {loading && (
              <p className="text-rowan-muted text-sm">Finding best trader…</p>
            )}
            {!loading && error && (
              <p className="text-rowan-red text-sm">{error}</p>
            )}
            {!loading && !error && amountNum <= 0 && (
              <p className="text-rowan-muted text-sm">
                Enter an amount and payment method to see your match.
              </p>
            )}
            {!loading && !error && preview && trader && (
              <div className="space-y-3">
                <div>
                  <p className="text-rowan-muted text-xs uppercase tracking-wider">
                    {isBuy ? "You'll receive" : "You'll receive"}
                  </p>
                  <p className="text-rowan-green text-xl font-bold tabular-nums mt-1">
                    {isBuy
                      ? `${Number(preview.estimatedUsdc || preview.usdcAmount).toFixed(4)} USDC`
                      : `${Number(preview.estimatedFiat || preview.fiatAmount).toLocaleString()} ${preview.fiatCurrency}`}
                  </p>
                  {preview.userRate != null && (
                    <p className="text-rowan-muted text-xs mt-1">
                      ~{preview.fiatCurrency} {Number(preview.userRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} per USDC
                    </p>
                  )}
                </div>

                <div className="border-t border-rowan-border pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-rowan-text text-sm font-semibold truncate">
                        {getTraderDisplayName(trader.traderName)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {trader.isOnline ? (
                          <span className="text-rowan-green text-xs">Online</span>
                        ) : trader.lastSeenLabel ? (
                          <span className="text-rowan-muted text-xs">{trader.lastSeenLabel}</span>
                        ) : null}
                        <span className="text-rowan-muted text-xs">
                          Match {trader.matchScore ?? '—'}/100
                        </span>
                      </div>
                    </div>
                    <PaymentMethodPill network={trader.network || network} />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {trader.trustScore != null && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-rowan-green/15 text-rowan-green">
                        <ShieldCheck size={12} />
                        Trust {Math.round(trader.trustScore)}
                      </span>
                    )}
                    {formatPercent(trader.completionRate) && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-rowan-bg border border-rowan-border text-rowan-muted">
                        {formatPercent(trader.completionRate)} done
                      </span>
                    )}
                    {trader.completedOrders != null && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-rowan-bg border border-rowan-border text-rowan-muted">
                        {trader.completedOrders} trades
                      </span>
                    )}
                    {formatDurationMinutes(trader.avgReleaseMinutes) && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-rowan-bg border border-rowan-border text-rowan-muted">
                        <Clock size={12} />
                        {formatDurationMinutes(trader.avgReleaseMinutes)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button className="w-full" disabled={!canContinue} onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
