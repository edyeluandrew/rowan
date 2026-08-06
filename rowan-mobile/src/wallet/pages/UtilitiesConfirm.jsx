import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, AlertTriangle } from 'lucide-react'
import UtilityQuoteSummary from '../components/utilities/UtilityQuoteSummary'
import CountdownTimer from '../components/ui/CountdownTimer'
import Button from '../components/ui/Button'
import { labelsFor } from '../utils/utilityLabels'

export default function UtilitiesConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, network, phone, mockPurchaseAllowed, utilityType } = location.state || {}
  const labels = labelsFor({ type: utilityType || quote?.type })
  const title = labels.type === 'data' ? 'Confirm data bundle' : 'Confirm airtime'

  const [expired, setExpired] = useState(false)

  if (!quote) {
    navigate(labels.utilitiesPath, { replace: true })
    return null
  }

  const handleConfirm = () => {
    if (expired) return
    navigate('/wallet/utilities/send', {
      state: { quote, network, phone, mockPurchaseAllowed, utilityType: utilityType || quote.type },
      replace: true,
    })
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">{title}</h1>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span className="text-rowan-muted text-sm">Quote expires in</span>
        <CountdownTimer
          expiresAt={quote.expiresAt}
          onExpire={() => setExpired(true)}
        />
      </div>
      <p className="text-rowan-muted text-xs mb-4">
        {labels.confirmTimerHint}
      </p>

      <UtilityQuoteSummary quote={quote} phone={phone} />

      <div className="bg-rowan-surface rounded-xl p-4 mt-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-rowan-green shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs">
          {labels.confirmAfterPayment}
          {mockPurchaseAllowed && ' Staging can complete without on-chain payment.'}
        </p>
      </div>

      {expired && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-rowan-yellow" />
            <p className="text-rowan-yellow font-bold text-sm">Quote expired</p>
          </div>
          <Button onClick={() => navigate(labels.utilitiesPath, { replace: true })}>
            Get new quote
          </Button>
        </div>
      )}

      {!expired && (
        <div className="mt-8">
          <Button onClick={handleConfirm}>
            Continue to payment
          </Button>
        </div>
      )}
    </div>
  )
}
