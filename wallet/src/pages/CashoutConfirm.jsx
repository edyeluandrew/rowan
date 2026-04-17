import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, AlertTriangle, Info } from 'lucide-react'
import { confirmQuote } from '../api/cashout'
import { getUserFriendlyError } from '../utils/errorMessages'
import QuoteSummary from '../components/cashout/QuoteSummary'
import CountdownTimer from '../components/ui/CountdownTimer'
import Button from '../components/ui/Button'

export default function CashoutConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, network, phone } = location.state || {}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expired, setExpired] = useState(false)

  if (!quote) {
    navigate('/cashout', { replace: true })
    return null
  }

  const handleConfirm = async () => {
    if (expired) return
    setLoading(true)
    setError(null)
    try {
      const confirmed = await confirmQuote(quote.id)
      navigate('/cashout/send', {
        state: {
          transaction: confirmed,
          network,
          phone,
        },
        replace: true,
      })
    } catch (err) {
      // [PHASE 4] Convert backend error to user-friendly message
      const friendlyError = getUserFriendlyError(err.message)
      setError(friendlyError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Confirm Quote</h1>
      </div>

      {/* [PHASE 3] Enhanced expiry display with warning */}
      <div className="flex items-center justify-between mb-5 bg-rowan-surface rounded-lg p-3 border border-rowan-border">
        <span className="text-rowan-muted text-xs font-medium">Quote expires in</span>
        <CountdownTimer
          expiresAt={quote.expiresAt}
          onExpire={() => setExpired(true)}
        />
      </div>

      {/* Quote summary with enhanced clarity */}
      <QuoteSummary quote={quote} />

      {/* Trust and security info */}
      <div className="bg-rowan-surface rounded-xl p-4 mt-4 flex items-start gap-3 border border-rowan-border/50">
        <ShieldCheck size={20} className="text-rowan-green shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs leading-relaxed">
          Your XLM is held in escrow until the mobile money payment is confirmed.
          If the trader fails to pay within the SLA window, your XLM is automatically refunded.
        </p>
      </div>

      {/* [PHASE 4] Improved error display with guidance */}
      {error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-rowan-red shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-rowan-red font-semibold text-sm mb-2">Unable to confirm quote</p>
              <p className="text-rowan-muted text-xs leading-relaxed mb-3">{error}</p>
              <Button 
                size="sm"
                variant="secondary"
                onClick={() => navigate('/cashout', { replace: true })}
              >
                Get New Quote
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quote expired message */}
      {expired && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-rowan-yellow font-bold text-sm mb-2">Quote Expired</p>
              <p className="text-rowan-muted text-xs mb-3">This quote is no longer valid. Please request a new one to proceed.</p>
              <Button 
                size="sm"
                variant="secondary"
                onClick={() => navigate('/cashout', { replace: true })}
              >
                Get New Quote
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation button */}
      {!expired && !error && (
        <div className="mt-8">
          <Button onClick={handleConfirm} loading={loading} className="w-full">
            Confirm and Proceed
          </Button>
        </div>
      )}

      {/* Help text when error or expired */}
      {(error || expired) && !loading && (
        <div className="mt-6 p-3 bg-rowan-surface rounded-lg border border-rowan-border/50">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-rowan-muted shrink-0 mt-0.5" />
            <p className="text-rowan-muted text-xs">
              Quotes expire for security and to ensure you get the best current rate. 
              New quotes are generated instantly free of charge.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
