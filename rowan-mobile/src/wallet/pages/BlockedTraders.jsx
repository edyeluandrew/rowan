import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { listBlockedTraders, unblockTrader } from '../api/user'
import { getTraderDisplayName } from '../utils/p2pFormat'
import { formatTimeAgo } from '../utils/format'
import Button from '../components/ui/Button'

export default function BlockedTraders() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [unblockingId, setUnblockingId] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    listBlockedTraders()
      .then(setItems)
      .catch(() => setError('Could not load blocked traders'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleUnblock = async (traderId) => {
    setUnblockingId(traderId)
    try {
      await unblockTrader(traderId)
      setItems((prev) => prev.filter((i) => i.traderId !== traderId))
    } catch {
      setError('Could not unblock trader')
    } finally {
      setUnblockingId(null)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Blocked Traders</h1>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <RefreshCw size={24} className="text-rowan-yellow animate-spin" />
          <p className="text-rowan-muted text-sm">Loading…</p>
        </div>
      )}

      {error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 text-center mb-4">
          <p className="text-rowan-red text-sm">{error}</p>
          <button type="button" onClick={load} className="text-rowan-yellow text-sm mt-2">Try again</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-8 text-center">
          <p className="text-rowan-muted text-sm">You haven&apos;t blocked any traders.</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-rowan-surface border border-rowan-border rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-rowan-text text-sm font-medium">{getTraderDisplayName(item.traderName)}</p>
              <p className="text-rowan-muted text-xs mt-1">Blocked {formatTimeAgo(item.createdAt)}</p>
            </div>
            <Button
              variant="ghost"
              className="py-2 px-3 text-sm shrink-0"
              loading={unblockingId === item.traderId}
              onClick={() => handleUnblock(item.traderId)}
            >
              Unblock
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
