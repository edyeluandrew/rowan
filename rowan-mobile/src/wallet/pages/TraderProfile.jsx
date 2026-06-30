import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, ThumbsUp, ThumbsDown, RefreshCw, MoreVertical } from 'lucide-react'
import { getTraderProfile, getTraderAd } from '../api/traders'
import { blockTrader, unblockTrader } from '../api/user'
import useRates from '../hooks/useRates'
import {
  formatCurrency,
  formatPercent,
  formatDurationMinutes,
  formatXlmRateLine,
  formatUsdcRateLine,
  getTraderDisplayName,
  lookupNetworkRate,
} from '../utils/p2pFormat'
import { formatTimeAgo } from '../utils/format'
import PaymentMethodPill from '../components/ui/PaymentMethodPill'
import Button from '../components/ui/Button'

export default function TraderProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedAd = location.state?.ad
  const marketplaceMode = location.state?.mode === 'buy' ? 'buy' : 'sell'
  const isBuyMode = marketplaceMode === 'buy'
  const { allRates } = useRates()

  const [profile, setProfile] = useState(null)
  const [selectedAd, setSelectedAd] = useState(preselectedAd || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [blockConfirm, setBlockConfirm] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [toast, setToast] = useState(null)

  const loadProfile = () => {
    setLoading(true)
    setError(null)
    getTraderProfile(id)
      .then((data) => {
        setProfile(data)
        if (!preselectedAd) {
          const filtered = (data.ads || []).filter((ad) => {
            const side = ad.adSide || ad.ad_side || 'USER_SELL'
            return isBuyMode ? side === 'USER_BUY' : side === 'USER_SELL'
          })
          if (filtered.length === 1) setSelectedAd(filtered[0])
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Could not load this trader. Please try again.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProfile()
  }, [id])

  useEffect(() => {
    if (!preselectedAd?.payoutSettingId) return
    getTraderAd(preselectedAd.payoutSettingId)
      .then((ad) => setSelectedAd(ad))
      .catch(() => {})
  }, [preselectedAd?.payoutSettingId])

  const handleTrade = () => {
    if (!selectedAd) return
    if (isBuyMode || selectedAd.adSide === 'USER_BUY') {
      navigate('/wallet/buy', {
        state: {
          selectedAd,
          payoutSettingId: selectedAd.payoutSettingId || selectedAd.id,
          traderName: profile?.name,
          network: selectedAd.network,
        },
      })
      return
    }
    navigate('/wallet/cashout', {
      state: {
        selectedAd,
        payoutSettingId: selectedAd.payoutSettingId || selectedAd.id,
        traderName: profile?.name,
        network: selectedAd.network,
      },
    })
  }

  const handleBlockToggle = async () => {
    setBlocking(true)
    try {
      if (profile.isBlocked) {
        await unblockTrader(id)
        setToast('Trader unblocked')
        setProfile((p) => ({ ...p, isBlocked: false }))
      } else {
        await blockTrader(id)
        setToast('Trader blocked')
        setTimeout(() => navigate('/wallet/marketplace', { replace: true }), 1200)
      }
      setBlockConfirm(false)
      setMenuOpen(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update block status')
    } finally {
      setBlocking(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-center gap-3">
        <RefreshCw size={24} className="text-rowan-yellow animate-spin" />
        <p className="text-rowan-muted text-sm">Loading trader profile</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="bg-rowan-bg min-h-screen px-4 pt-4">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 mb-4">
          <ChevronLeft size={20} className="inline mr-1" />
          Back
        </button>
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 text-center">
          <p className="text-rowan-red text-sm">{error || 'Trader not found'}</p>
          <button type="button" onClick={loadProfile} className="text-rowan-yellow text-sm mt-3 min-h-11">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const stats = profile.stats || {}
  const reviews = profile.reviews || []
  const visibleAds = (profile.ads || []).filter((ad) => {
    const side = ad.adSide || ad.ad_side || 'USER_SELL'
    return isBuyMode ? side === 'USER_BUY' : side === 'USER_SELL'
  })

  const selectedRate = selectedAd
    ? (isBuyMode || selectedAd.adSide === 'USER_BUY')
      ? selectedAd.ratePerUsdc
      : lookupNetworkRate(allRates, selectedAd.network)
    : null
  const rateLine = selectedAd
    ? (isBuyMode || selectedAd.adSide === 'USER_BUY')
      ? formatUsdcRateLine(selectedAd.currency, selectedRate)
      : formatXlmRateLine(selectedAd.currency, selectedRate)
    : null

  return (
    <div className="bg-rowan-bg min-h-screen pb-32 px-4 pt-4">
      <div className="flex items-center gap-3 mb-2">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-rowan-text text-lg font-bold truncate">
            {getTraderDisplayName(profile.name)}
          </h1>
          {profile.isOnline ? (
            <p className="text-rowan-green text-xs font-medium">Online now</p>
          ) : profile.lastSeenLabel ? (
            <p className="text-rowan-muted text-xs">Last seen {profile.lastSeenLabel.replace(/^Active /, '')}</p>
          ) : null}
        </div>
        {profile.verificationStatus === 'VERIFIED' && (
          <ShieldCheck size={20} className="text-rowan-green shrink-0" />
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
            aria-label="More options"
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-rowan-surface border border-rowan-border rounded-xl shadow-lg z-10 min-w-[180px]">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setBlockConfirm(true) }}
                className="w-full text-left px-4 py-3 text-sm text-rowan-red min-h-11"
              >
                {profile.isBlocked ? 'Unblock this trader' : 'Block this trader'}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl px-4 py-2 mb-4">
          <p className="text-rowan-green text-sm">{toast}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatBox label="Total Orders" value={stats.completedOrders ?? 0} />
        <StatBox label="Completion Rate" value={formatPercent(stats.completionRate) || '0.0%'} />
        <StatBox label="Avg Release Time" value={formatDurationMinutes(stats.avgReleaseMinutes) || 'Under 1 min'} />
        <StatBox label="Positive Reviews" value={formatPercent(stats.positivePercent) || '0.0%'} />
        <StatBox
          label="Avg. Reply"
          value={formatDurationMinutes(stats.avgResponseMinutes) || 'Under 1 min'}
          className="col-span-2"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-rowan-text text-sm font-semibold mb-3">
          {isBuyMode ? 'USDC offers' : 'Cash-out offers'}
        </h2>
        <div className="space-y-2">
          {visibleAds.length === 0 && (
            <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 text-center">
              <p className="text-rowan-muted text-sm">No active offers in this category</p>
            </div>
          )}
          {visibleAds.map((ad) => {
            const isSelected = (selectedAd?.payoutSettingId || selectedAd?.id) === ad.payoutSettingId
            const isBuyAd = (ad.adSide || ad.ad_side) === 'USER_BUY'
            const adRate = isBuyAd
              ? formatUsdcRateLine(ad.currency, ad.ratePerUsdc)
              : formatXlmRateLine(ad.currency, lookupNetworkRate(allRates, ad.network))
            const availableUsdc = ad.availableUsdc ?? ad.available_usdc
            return (
              <button
                key={ad.payoutSettingId}
                type="button"
                onClick={() => setSelectedAd(ad)}
                className={`w-full text-left rounded-xl p-4 border ${
                  isSelected ? 'border-rowan-yellow bg-rowan-yellow/5' : 'border-rowan-border bg-rowan-surface'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <PaymentMethodPill network={ad.network} />
                  {adRate && <span className="text-rowan-yellow text-xs font-medium">{adRate}</span>}
                </div>
                <p className="text-rowan-text text-sm font-medium mt-3">
                  Limits: {formatCurrency(ad.minAmount, ad.currency)}
                  {' \u2013 '}
                  {formatCurrency(ad.maxAmount, ad.currency)}
                </p>
                {isBuyAd && availableUsdc != null && (
                  <p className="text-rowan-muted text-xs mt-1">
                    {Number(availableUsdc).toFixed(2)} USDC available
                  </p>
                )}
                {!isBuyAd && ad.availableFloat != null && (
                  <p className="text-rowan-muted text-xs mt-1">
                    {formatCurrency(ad.availableFloat, ad.currency)} float available
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedAd && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
          <h2 className="text-rowan-text text-sm font-semibold mb-2">Selected offer</h2>
          {rateLine && <p className="text-rowan-text text-sm">{rateLine}</p>}
          <p className="text-rowan-muted text-xs mt-2">
            Limits {formatCurrency(selectedAd.minAmount, selectedAd.currency)}
            {' \u2013 '}
            {formatCurrency(selectedAd.maxAmount, selectedAd.currency)}
          </p>
          {(selectedAd.adSide === 'USER_BUY' || isBuyMode) && (selectedAd.availableUsdc ?? selectedAd.available_usdc) != null && (
            <p className="text-rowan-muted text-xs mt-1">
              {(selectedAd.availableUsdc ?? selectedAd.available_usdc).toFixed(2)} USDC available
            </p>
          )}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-rowan-text text-sm font-semibold mb-3">Reviews</h2>
        {reviews.length === 0 ? (
          <div className="bg-rowan-surface border border-rowan-border rounded-xl p-6 text-center">
            <p className="text-rowan-muted text-sm">No reviews yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reviews.slice(0, 10).map((r) => (
              <div key={r.id} className="bg-rowan-surface border border-rowan-border rounded-xl p-3">
                <div className="flex items-center gap-2">
                  {r.rating === 1 ? (
                    <ThumbsUp size={14} className="text-rowan-green" />
                  ) : (
                    <ThumbsDown size={14} className="text-rowan-red" />
                  )}
                  <span className="text-rowan-muted text-xs">{formatTimeAgo(r.createdAt)}</span>
                </div>
                {r.comment && <p className="text-rowan-text text-sm mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-rowan-bg border-t border-rowan-border">
        <Button onClick={handleTrade} disabled={!selectedAd || profile.isBlocked || (isBuyMode && !selectedAd?.ratePerUsdc)}>
          {profile.isBlocked
            ? 'Trader blocked'
            : isBuyMode
              ? 'Buy USDC with this trader'
              : 'Trade with this trader'}
        </Button>
      </div>

      {blockConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setBlockConfirm(false)}>
          <div className="bg-rowan-surface rounded-t-2xl p-6 w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-rowan-text font-bold text-lg">
              {profile.isBlocked ? 'Unblock' : 'Block'} {getTraderDisplayName(profile.name)}?
            </h3>
            {!profile.isBlocked && (
              <p className="text-rowan-muted text-sm mt-3 mb-4">
                They won&apos;t appear in your marketplace or be matched to your orders.
              </p>
            )}
            <div className="flex flex-col gap-3">
              <Button variant="primary" className="bg-rowan-red" loading={blocking} onClick={handleBlockToggle}>
                {profile.isBlocked ? 'Unblock trader' : 'Block trader'}
              </Button>
              <Button variant="ghost" onClick={() => setBlockConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, className = '' }) {
  return (
    <div className={`bg-rowan-surface border border-rowan-border rounded-xl p-4 text-center ${className}`}>
      <p className="text-rowan-text text-xl font-bold tabular-nums">{value}</p>
      <p className="text-rowan-muted text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}
