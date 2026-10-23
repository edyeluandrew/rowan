import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { RefreshCw, Zap } from 'lucide-react'
import { listTraderAds, listBuyAds } from '../api/traders'
import useActiveTransaction from '../hooks/useActiveTransaction'
import TraderGroupCard from '../components/marketplace/TraderGroupCard'
import ExpressSheet from '../components/marketplace/ExpressSheet'
import MarketplaceSkeleton from '../components/marketplace/MarketplaceSkeleton'
import MarketplaceEmpty from '../components/marketplace/MarketplaceEmpty'
import useRates from '../hooks/useRates'
import useWallet from '../hooks/useWallet'
import useUserCountry from '../hooks/useUserCountry'
import { getNetworksForCountry } from '../utils/country'
import { NETWORKS, QUOTE_REFRESH_INTERVAL } from '../utils/constants'
import Button from '../components/ui/Button'
import { sanitizeAmount } from '../utils/sanitizeAmount'
import client from '../api/client'

function mergeSilentTraders(previous, incoming) {
  const incomingById = new Map((incoming || []).map((trader) => [trader.traderId, trader]))
  const seen = new Set()
  const ids = []
  for (const trader of [...(previous || []), ...(incoming || [])]) {
    if (!trader?.traderId || seen.has(trader.traderId)) continue
    seen.add(trader.traderId)
    ids.push(trader.traderId)
  }
  return ids.map((id) => {
    const next = incomingById.get(id)
    const prior = (previous || []).find((trader) => trader.traderId === id)
    if (!next) return prior
    if (!prior?.offers?.length) return next
    const freshByNetwork = new Map((next.offers || []).map((offer) => [offer.network, offer]))
    const seenNetworks = new Set()
    const offers = []
    for (const offer of [...prior.offers, ...(next.offers || [])]) {
      if (!offer?.network || seenNetworks.has(offer.network)) continue
      seenNetworks.add(offer.network)
      offers.push(freshByNetwork.get(offer.network) || offer)
    }
    return { ...next, offers }
  })
}

/**
 * P2P hub — Buy/Sell toggle + Express; sticky controls, scrollable trader list.
 */
export default function P2pHub() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialTab = location.state?.tab === 'sell' ? 'sell' : 'buy'
  const [tab, setTab] = useState(initialTab)
  const { country, fiatCurrency } = useUserCountry()
  const countryNetworks = useMemo(() => Object.keys(getNetworksForCountry(country)), [country])
  const { activeTransaction, hasActiveOrder } = useActiveTransaction()
  const { rates } = useRates(fiatCurrency)
  const { usdcBalance } = useWallet()
  const [traders, setTraders] = useState([])
  const [expressOpen, setExpressOpen] = useState(false)
  const [typicalTradeMinutes, setTypicalTradeMinutes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [network, setNetwork] = useState(null)
  const [minAmount, setMinAmount] = useState('')
  const [debouncedMinAmount, setDebouncedMinAmount] = useState('')
  const adsCache = useRef({})
  const loadSeq = useRef(0)

  useEffect(() => {
    if (location.state?.tab === 'buy' || location.state?.tab === 'sell') {
      setTab(location.state.tab)
    }
  }, [location.state?.tab])

  useEffect(() => {
    setNetwork(null)
  }, [country, tab])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMinAmount(minAmount), 400)
    return () => clearTimeout(timer)
  }, [minAmount])

  const loadAds = useCallback(async (isRefresh = false, { silent = false } = {}) => {
    const cacheKey = `${tab}|${fiatCurrency}|${network || ''}|${debouncedMinAmount || ''}`
    const cached = adsCache.current[cacheKey]
    const seq = ++loadSeq.current
    if (cached && !isRefresh) {
      setTraders(cached)
      setLoading(false)
    }
    if (isRefresh && !silent) setRefreshing(true)
    else if (!cached && !isRefresh) setLoading(true)
    if (!isRefresh) setError(null)
    try {
      const params = { currency: fiatCurrency }
      if (network) params.network = network
      if (debouncedMinAmount) params.minAmount = parseFloat(debouncedMinAmount)
      const res = tab === 'buy' ? await listBuyAds(params) : await listTraderAds(params)
      if (seq !== loadSeq.current) return
      const rows = silent
        ? mergeSilentTraders(adsCache.current[cacheKey] || [], res.traders || [])
        : (res.traders || [])
      adsCache.current[cacheKey] = rows
      setTraders(rows)
      setError(null)
    } catch (err) {
      if (seq !== loadSeq.current) return
      if (!isRefresh && !cached) {
        setError(err.response?.data?.error || 'Could not load traders. Please try again.')
      }
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [network, debouncedMinAmount, fiatCurrency, tab])

  useEffect(() => {
    client.get('/api/v1/config/cashout-limits')
      .then((res) => {
        const mins = res.data?.data?.tradeTiming?.typicalCompleteMinutes
        if (mins != null) setTypicalTradeMinutes(mins)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadAds()
    const id = setInterval(() => loadAds(true, { silent: true }), QUOTE_REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [loadAds])

  useEffect(() => {
    const other = tab === 'buy' ? 'sell' : 'buy'
    const cacheKey = `${other}|${fiatCurrency}|${network || ''}|${debouncedMinAmount || ''}`
    if (adsCache.current[cacheKey]) return undefined
    let cancelled = false
    const params = { currency: fiatCurrency }
    if (network) params.network = network
    if (debouncedMinAmount) params.minAmount = parseFloat(debouncedMinAmount)
    const request = other === 'buy' ? listBuyAds(params) : listTraderAds(params)
    request.then((res) => {
      if (!cancelled) adsCache.current[cacheKey] = res.traders || []
    }).catch(() => {})
    return () => { cancelled = true }
  }, [tab, fiatCurrency, network, debouncedMinAmount])

  const buildAdFromOffer = (offer, trader) => ({
    ...offer,
    id: offer.payoutSettingId,
    traderId: trader.traderId,
    traderName: trader.traderName,
    trustScore: trader.trustScore,
    minAmount: offer.minAmount ?? trader.minAmount,
    maxAmount: offer.maxAmount ?? trader.maxAmount,
    availableFloat: offer.availableFloat,
    availableUsdc: offer.availableUsdc,
    ratePerUsdc: offer.ratePerUsdc,
  })

  const openMultiNetworkTrade = (trader) => {
    if (hasActiveOrder) return
    const offers = trader.offers || []
    if (offers.length === 0) return
    navigate(tab === 'buy' ? '/wallet/buy' : '/wallet/cashout', {
      state: {
        traderName: trader.traderName,
        traderOffers: offers.map((offer) => buildAdFromOffer(offer, trader)),
      },
    })
  }

  const handleViewProfile = (trader) => {
    navigate(`/wallet/traders/${trader.traderId}`, {
      state: { mode: tab },
    })
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Sticky controls — fixed height block so list scroll does not shift header */}
      <header className="sticky top-0 z-30 bg-rowan-bg border-b border-rowan-border">
        <div className="px-4 pt-4 pb-3 space-y-3 max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex-1 inline-flex bg-rowan-surface border border-rowan-border rounded-xl p-1 min-w-0">
              <button
                type="button"
                onClick={() => setTab('buy')}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold min-h-11 transition-colors ${
                  tab === 'buy' ? 'bg-rowan-green text-white' : 'text-rowan-muted'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setTab('sell')}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold min-h-11 transition-colors ${
                  tab === 'sell' ? 'bg-rowan-green text-white' : 'text-rowan-muted'
                }`}
              >
                Sell
              </button>
            </div>
            <button
              type="button"
              disabled={hasActiveOrder}
              onClick={() => setExpressOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 bg-rowan-surface border border-rowan-border rounded-xl px-3 py-2.5 min-h-11 text-rowan-text text-sm font-semibold disabled:opacity-50"
            >
              <Zap size={16} className="text-rowan-gold shrink-0" />
              Express
            </button>
          </div>

          <p className="text-rowan-muted text-xs">
            {tab === 'buy' ? 'Buy USDC' : 'Sell USDC'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="p2p-amount" className="sr-only">Amount</label>
              <div className="flex items-center bg-rowan-surface border border-rowan-border rounded-xl overflow-hidden min-h-11">
                <input
                  id="p2p-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={minAmount}
                  onChange={(e) => setMinAmount(sanitizeAmount(e.target.value))}
                  placeholder="0"
                  className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-rowan-text text-sm tabular-nums outline-none"
                />
                <span className="px-3 text-rowan-muted text-xs font-semibold border-l border-rowan-border shrink-0">
                  {fiatCurrency}
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="p2p-provider" className="sr-only">Payment method</label>
              <select
                id="p2p-provider"
                value={network || ''}
                onChange={(e) => setNetwork(e.target.value || null)}
                className="w-full bg-rowan-surface border border-rowan-border rounded-xl px-3 py-2.5 text-rowan-text text-sm min-h-11 appearance-none"
              >
                <option value="">All payments</option>
                {countryNetworks.map((key) => (
                  <option key={key} value={key}>
                    {NETWORKS[key]?.label || key}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {hasActiveOrder && activeTransaction && (
        <div className="px-4 pt-3 max-w-3xl mx-auto">
          <div className="bg-rowan-mint border border-rowan-green/30 rounded-xl p-3">
            <p className="text-rowan-text text-sm font-semibold">
              You have an active order. Finish it before starting another.
            </p>
            <Button
              className="mt-2"
              onClick={() => navigate(`/wallet/transaction/${activeTransaction.id}`)}
            >
              View order
            </Button>
          </div>
        </div>
      )}

      {/* Floating refresh — no layout shift */}
      {refreshing && (
        <div
          className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-rowan-surface border border-rowan-border px-3 py-1.5 text-rowan-muted text-xs shadow-sm pointer-events-none"
          aria-live="polite"
        >
          <RefreshCw size={14} className="animate-spin shrink-0" />
          Refreshing
        </div>
      )}

      {/* Scrollable trader list */}
      <div className="px-4 pt-4 max-w-3xl mx-auto">
        <div className="relative min-h-[12rem]">
          {loading && (
            <div className="absolute inset-0">
              <MarketplaceSkeleton />
            </div>
          )}

          {!loading && error && (
            <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 text-center">
              <p className="text-rowan-red text-sm">{error}</p>
              <button
                type="button"
                onClick={() => loadAds(true)}
                className="text-rowan-green text-sm font-medium mt-3 min-h-11"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && traders.length === 0 && (
            <MarketplaceEmpty
              tab={tab}
              filtered={Boolean(network || debouncedMinAmount)}
              onRefresh={() => loadAds(true)}
              onClearFilters={() => {
                setNetwork(null)
                setMinAmount('')
              }}
            />
          )}

          {!loading && !error && traders.length > 0 && (
            <div className="space-y-3">
              {traders.map((trader) => (
                <TraderGroupCard
                  key={trader.traderId}
                  trader={trader}
                  mode={tab}
                  usdcToFiat={rates?.usdcToFiat}
                  walletBalance={usdcBalance}
                  typicalTradeMinutes={typicalTradeMinutes}
                  onViewProfile={handleViewProfile}
                  onPickNetwork={openMultiNetworkTrade}
                  tradeDisabled={hasActiveOrder}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ExpressSheet
        open={expressOpen}
        onClose={() => setExpressOpen(false)}
        initialSide={tab}
      />
    </div>
  )
}
