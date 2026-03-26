import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, AlertTriangle } from 'lucide-react'
import QuoteSummary from '../components/cashout/QuoteSummary'
import CountdownTimer from '../components/ui/CountdownTimer'
import Button from '../components/ui/Button'

export default function CashoutConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, network, phone } = location.state || {}
  const [expired, setExpired] = useState(false)

  if (!quote) {
    navigate('/wallet/cashout', { replace: true })
    return null
  }

  const handleConfirm = () => {
    if (expired) return
    navigate('/wallet/cashout/send', {
      state: {
        quote,
        network,
        phone,
      },
      replace: true,
    })
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Confirm Quote</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-rowan-muted text-sm">Quote expires in</span>
        <CountdownTimer
          expiresAt={quote.expiresAt}
          onExpire={() => setExpired(true)}
        />
      </div>

      <QuoteSummary quote={quote} phone={phone} />

      <div className="bg-rowan-surface rounded-xl p-4 mt-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-rowan-green shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs">
          Your XLM will be held in escrow until the mobile money payment is confirmed.
          If the trader fails to pay within the SLA window, your XLM will be automatically refunded.
        </p>
      </div>

      {expired && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-rowan-yellow" />
            <p className="text-rowan-yellow font-bold text-sm">Quote Expired</p>
          </div>
          <p className="text-rowan-muted text-xs mb-3">This quote is no longer valid. Please request a new one.</p>
          <Button onClick={() => navigate('/wallet/cashout', { replace: true })}>
            Get New Quote
          </Button>
        </div>
      )}

      {!expired && (
        <div className="mt-8">
          <Button onClick={handleConfirm}>
            Confirm and Proceed
          </Button>
        </div>
      )}
    </div>
  )
}
