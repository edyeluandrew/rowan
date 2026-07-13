import { ShieldCheck, Clock, Calendar } from 'lucide-react'
import {
  formatCurrency,
  formatPercent,
  formatUsdcRateLine,
  formatMemberSince,
  formatTradeCount,
  formatUsdcSellEstimateLine,
  formatTypicalTradeTime,
  formatAvgReleaseTime,
  getTraderDisplayName,
} from '../../utils/p2pFormat'
import { estimateMaxNetFiatFromUsdc } from '../../utils/fiat'
import PaymentMethodPill from '../ui/PaymentMethodPill'
import Button from '../ui/Button'

const ESTIMATE_USDC = 10

export default function TraderGroupCard({
  trader,
  mode = 'sell',
  usdcToFiat,
  walletBalance,
  typicalTradeMinutes,
  onTrade,
  onViewProfile,
  onPickNetwork,
  tradeDisabled = false,
}) {
  const isBuy = mode === 'buy'
  const offers = trader.offers || []
  const primaryNetwork = offers[0]?.network
  const currency = trader.currency || offers[0]?.currency

  const rateLine = isBuy
    ? formatUsdcRateLine(currency, trader.bestRatePerUsdc)
    : formatUsdcRateLine(currency, usdcToFiat)

  const estimateUsdc = walletBalance != null && Number(walletBalance) > 0
    ? Math.min(Number(walletBalance), ESTIMATE_USDC)
    : ESTIMATE_USDC
  const estimateFiat = !isBuy && usdcToFiat
    ? estimateMaxNetFiatFromUsdc(estimateUsdc, usdcToFiat)
    : null
  const estimateLine = formatUsdcSellEstimateLine(estimateUsdc, estimateFiat, currency)

  const completion = formatPercent(trader.completionRate)
  const avgReleaseLine = formatAvgReleaseTime(trader.avgReleaseMinutes)
  const typicalTradeLine = formatTypicalTradeTime(typicalTradeMinutes)
  const memberSince = formatMemberSince(trader.memberSince)
  const tradeCount = formatTradeCount(trader.completedOrders)
  const isVerified = trader.trustScore >= 80
  const canBuy = isBuy && trader.bestRatePerUsdc > 0

  const handleTradeClick = () => {
    if (tradeDisabled || (isBuy && !canBuy)) return
    if (offers.length === 1) {
      onTrade?.(offers[0], trader)
      return
    }
    onPickNetwork?.(trader)
  }

  const handleNetworkTap = (offer) => {
    if (tradeDisabled || (isBuy && !offer.ratePerUsdc)) return
    onTrade?.(offer, trader)
  }

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-rowan-text font-semibold text-base truncate">
              {getTraderDisplayName(trader.traderName)}
            </span>
            {trader.isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-rowan-green text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" aria-hidden />
                Online
              </span>
            ) : trader.lastSeenLabel ? (
              <span className="inline-flex items-center gap-1.5 text-rowan-muted text-xs">
                <span className="w-2 h-2 rounded-full bg-rowan-muted/60 shrink-0" aria-hidden />
                {trader.lastSeenLabel}
              </span>
            ) : null}
            {isVerified && (
              <ShieldCheck size={16} className="text-rowan-green shrink-0" aria-label="Verified trader" />
            )}
          </div>

          {rateLine && (
            <p className="text-rowan-green text-sm font-medium mt-1">{rateLine}</p>
          )}
          {!isBuy && estimateLine && (
            <p className="text-rowan-text text-xs mt-1">{estimateLine} <span className="text-rowan-muted">(estimate)</span></p>
          )}
          {isBuy && !canBuy && (
            <p className="text-rowan-muted text-xs mt-1">Trader has not set a USDC price</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {offers.map((offer) => (
          <button
            key={offer.payoutSettingId}
            type="button"
            disabled={tradeDisabled || (isBuy && !offer.ratePerUsdc)}
            onClick={() => handleNetworkTap(offer)}
            className="disabled:opacity-40"
          >
            <PaymentMethodPill network={offer.network} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-rowan-muted text-xs">
        {memberSince && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} className="shrink-0" />
            {memberSince}
          </span>
        )}
        {tradeCount && <span>{tradeCount}</span>}
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {completion && (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-rowan-green/15 text-rowan-green">
            {completion} completion
          </span>
        )}
        {avgReleaseLine && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-rowan-surface border border-rowan-border text-rowan-muted">
            <Clock size={12} className="shrink-0" />
            {avgReleaseLine}
          </span>
        )}
        {typicalTradeLine && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-rowan-yellow/10 border border-rowan-yellow/30 text-rowan-yellow">
            <Clock size={12} className="shrink-0" />
            {typicalTradeLine}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {trader.minAmount != null && trader.maxAmount != null && (
          <p className="text-rowan-text text-sm font-medium">
            Limits: {formatCurrency(trader.minAmount, currency)}
            {' \u2013 '}
            {formatCurrency(trader.maxAmount, currency)}
          </p>
        )}
        {(() => {
          const listedUsdc = trader.totalAvailableUsdc ?? trader.availableUsdc
          const floatFiat = trader.totalAvailableFloat ?? trader.availableFloat
          const rate = trader.bestRatePerUsdc > 0 ? trader.bestRatePerUsdc : usdcToFiat
          const usdcShown = isBuy
            ? (listedUsdc != null ? Number(listedUsdc) : null)
            : (listedUsdc != null && Number(listedUsdc) > 0
              ? Number(listedUsdc)
              : (floatFiat != null && rate > 0 ? Number(floatFiat) / Number(rate) : null))
          if (usdcShown == null || !Number.isFinite(usdcShown) || usdcShown <= 0) return null
          return (
            <p className="text-rowan-green text-xs font-medium">
              {usdcShown.toFixed(2)} USDC available
            </p>
          )
        })()}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" className="py-3" onClick={() => onViewProfile?.(trader)}>
          View profile
        </Button>
        <Button
          className="py-3"
          onClick={handleTradeClick}
          disabled={tradeDisabled || (isBuy && !canBuy)}
        >
          {isBuy ? 'Buy' : 'Sell'}
        </Button>
      </div>
    </div>
  )
}
