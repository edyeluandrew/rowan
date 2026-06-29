import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { listTraderAds } from '../api/traders'
import useActiveTransaction from '../hooks/useActiveTransaction'
import TraderAdCard from '../components/marketplace/TraderAdCard'
import MarketplaceSkeleton from '../components/marketplace/MarketplaceSkeleton'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import { getNetworksForCountry } from '../utils/country'
import { NETWORKS } from '../utils/constants'
import { lookupNetworkRate } from '../utils/p2pFormat'
import Button from '../components/ui/Button'

export default function Marketplace() {
  const navigate = useNavigate()
  const { country, fiatCurrency } = useUserCountry()
  const countryNetworks = useMemo(() => Object.keys(getNetworksForCountry(country)), [country])
  const { activeTransaction, hasActiveOrder } = useActiveTransaction()
  const { allRates } = useRates(fiatCurrency)
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [network, setNetwork] = useState(null)
  const [minAmount, setMinAmount] = useState('')
  const touchStartY = useRef(0)
  const pulling = useRef(false)

  const loadAds = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const params = { currency: fiatCurrency }
      if (network) {
        params.network = network
      }
      if (minAmount) params.minAmount = parseFloat(minAmount)
      const res = await listTraderAds(params)
      setAds(res.ads || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load traders. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [network, minAmount, fiatCurrency])

  useEffect(() => {
    loadAds()
  }, [loadAds])

  const handleTouchStart = (e) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY
      pulling.current = true
    }
  }

  const handleTouchMove = (e) => {
    if (!pulling.current || refreshing) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 80) {
      pulling.current = false
      loadAds(true)
    }
  }

  const handleTouchEnd = () => {
    pulling.current = false
  }

  const handleTrade = (ad) => {
    if (hasActiveOrder) return
    navigate('/wallet/cashout', {
      state: {
        selectedAd: ad,
        payoutSettingId: ad.payoutSettingId || ad.id,
        traderName: ad.traderName,
        network: ad.network,
      },
    })
  }

  const handleViewProfile = (ad) => {
    navigate(`/wallet/traders/${ad.traderId}`, { state: { ad } })
  }

  return (
    <div
      className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold flex-1 text-center pr-11">Choose a Trader</h1>
      </div>

      <p className="text-rowan-muted text-sm text-center mb-5">
        Pick a verified trader or use auto match from Cash Out.
      </p>

      {hasActiveOrder && activeTransaction && (
        <div className="bg-rowan-yellow rounded-xl p-4 mb-4">
          <p className="text-rowan-bg text-sm font-semibold">
            You have an active order. Complete it before starting a new trade.
          </p>
          <Button
            className="mt-3 bg-rowan-bg text-rowan-text hover:bg-rowan-bg/90"
            onClick={() => navigate(`/wallet/transaction/${activeTransaction.id}`)}
          >
            View Active Order
          </Button>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 space-y-4">
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Network</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNetwork(null)}
              className={`rounded-full px-4 py-2 text-sm font-medium min-h-11 ${
                !network
                  ? 'bg-rowan-yellow text-rowan-bg'
                  : 'bg-rowan-bg border border-rowan-border text-rowan-muted'
              }`}
            >
              All
            </button>
            {countryNetworks.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setNetwork(key)}
                className={`rounded-full px-4 py-2 text-sm font-medium min-h-11 ${
                  network === key
                    ? 'bg-rowan-yellow text-rowan-bg'
                    : 'bg-rowan-bg border border-rowan-border text-rowan-muted'
                }`}
              >
                {NETWORKS[key]?.label?.replace(' MoMo', '') || key}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="min-amount" className="text-rowan-muted text-xs uppercase tracking-wider">
            Minimum amount
          </label>
          <input
            id="min-amount"
            type="number"
            inputMode="numeric"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="Enter amount in local currency"
            className="w-full mt-2 bg-rowan-bg border border-rowan-border rounded-xl px-4 py-3 text-rowan-text text-sm min-h-11"
          />
        </div>
      </div>

      {refreshing && (
        <div className="flex items-center justify-center gap-2 text-rowan-muted text-xs mb-3">
          <RefreshCw size={14} className="animate-spin" />
          Refreshing
        </div>
      )}

      {loading && <MarketplaceSkeleton />}

      {!loading && error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 text-center">
          <p className="text-rowan-red text-sm">{error}</p>
          <button
            type="button"
            onClick={() => loadAds(true)}
            className="text-rowan-yellow text-sm font-medium mt-3 min-h-11"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && ads.length === 0 && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-8 text-center">
          <p className="text-rowan-text text-sm font-medium">No traders available right now.</p>
          <p className="text-rowan-muted text-xs mt-2">Try adjusting your filters.</p>
          <Button className="mt-4" variant="ghost" onClick={() => loadAds(true)}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>
      )}

      {!loading && !error && ads.length > 0 && (
        <div className="space-y-3">
          {ads.map((ad) => (
            <TraderAdCard
              key={ad.payoutSettingId || ad.id}
              ad={ad}
              xlmRate={lookupNetworkRate(allRates, ad.network)}
              onTrade={handleTrade}
              onViewProfile={handleViewProfile}
              tradeDisabled={hasActiveOrder}
            />
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button variant="ghost" onClick={() => navigate('/wallet/cashout')} disabled={hasActiveOrder}>
          Use auto match instead
        </Button>
      </div>
    </div>
  )
}
