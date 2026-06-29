import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'
import { getTraderProfile, getTraderAd } from '../api/traders'
import useRates from '../hooks/useRates'
import {
  formatCurrency,
  formatPercent,
  formatDurationMinutes,
  formatXlmRateLine,
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
  const { allRates } = useRates()

  const [profile, setProfile] = useState(null)
  const [selectedAd, setSelectedAd] = useState(preselectedAd || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadProfile = () => {
    setLoading(true)
    setError(null)
    getTraderProfile(id)
      .then((data) => {
        setProfile(data)
        if (!preselectedAd && data.ads?.length === 1) {
          setSelectedAd(data.ads[0])
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
    navigate('/wallet/cashout', {
      state: {
        selectedAd,
        payoutSettingId: selectedAd.payoutSettingId || selectedAd.id,
        traderName: profile?.name,
        network: selectedAd.network,
      },
    })
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
  const selectedRate = selectedAd
    ? lookupNetworkRate(allRates, selectedAd.network)
    : null
  const rateLine = selectedAd ? formatXlmRateLine(selectedAd.currency, selectedRate) : null

  return (
    <div className="bg-rowan-bg min-h-screen pb-32 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold flex-1 truncate">
          {getTraderDisplayName(profile.name)}
        </h1>
        {profile.verificationStatus === 'VERIFIED' && (
          <ShieldCheck size={20} className="text-rowan-green shrink-0" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatBox label="Total Orders" value={stats.completedOrders ?? 0} />
        <StatBox label="Completion Rate" value={formatPercent(stats.completionRate) || '0.0%'} />
        <StatBox label="Avg Release Time" value={formatDurationMinutes(stats.avgReleaseMinutes) || 'Under 1 min'} />
        <StatBox label="Positive Reviews" value={formatPercent(stats.positivePercent) || '0.0%'} />
      </div>

      <div className="mb-6">
        <h2 className="text-rowan-text text-sm font-semibold mb-3">Available offers</h2>
        <div className="space-y-2">
          {profile.ads?.map((ad) => {
            const isSelected = (selectedAd?.payoutSettingId || selectedAd?.id) === ad.payoutSettingId
            const adRate = formatXlmRateLine(ad.currency, lookupNetworkRate(allRates, ad.network))
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
                  {adRate && <span className="text-rowan-muted text-xs">{adRate}</span>}
                </div>
                <p className="text-rowan-text text-sm font-medium mt-3">
                  {formatCurrency(ad.minAmount, ad.currency)}
                  {' \u2013 '}
                  {formatCurrency(ad.maxAmount, ad.currency)}
                </p>
                <p className="text-rowan-muted text-xs mt-1">
                  Available {formatCurrency(ad.availableFloat, ad.currency)}
                </p>
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
        <Button onClick={handleTrade} disabled={!selectedAd}>
          Trade with this trader
        </Button>
      </div>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 text-center">
      <p className="text-rowan-text text-xl font-bold tabular-nums">{value}</p>
      <p className="text-rowan-muted text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}
