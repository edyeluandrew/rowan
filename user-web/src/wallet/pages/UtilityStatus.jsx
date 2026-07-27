import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, XCircle, Hash } from 'lucide-react'
import Button from '../components/ui/Button'
import { maskPhoneNumber } from '../utils/crypto'

export default function UtilityStatus() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const { purchase, quote, phone } = location.state || {}
  const data = purchase || quote

  if (!data) {
    navigate('/wallet/utilities', { replace: true })
    return null
  }

  const completed = (purchase?.status || data.status) === 'COMPLETED'
  const failed = (purchase?.status || data.status) === 'FAILED'
  const externalRef = purchase?.externalRef || data.externalRef

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/wallet/home')}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Airtime receipt</h1>
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-6 text-center">
        {completed ? (
          <CheckCircle2 size={48} className="text-rowan-green mx-auto mb-4" />
        ) : (
          <XCircle size={48} className="text-rowan-red mx-auto mb-4" />
        )}
        <p className="text-rowan-text text-lg font-bold">
          {completed ? 'Airtime sent!' : failed ? 'Purchase failed' : 'Processing'}
        </p>
        {phone && (
          <p className="text-rowan-muted text-sm mt-2">
            {maskPhoneNumber(phone)}
          </p>
        )}
        {completed && data.fiatAmount != null && (
          <p className="text-rowan-green text-2xl font-bold mt-4 tabular-nums">
            {Number(data.fiatAmount).toLocaleString()} {data.fiatCurrency}
          </p>
        )}
        {externalRef && (
          <div className="flex items-center justify-center gap-1 mt-4 text-rowan-muted text-xs">
            <Hash size={12} />
            <span className="font-mono">Ref: {externalRef}</span>
          </div>
        )}
        {purchase?.errorMessage && (
          <p className="text-rowan-red text-sm mt-4">{purchase.errorMessage}</p>
        )}
        {data.reloadlyMock && completed && (
          <p className="text-rowan-muted text-xs mt-3">Sandbox mock — no real airtime sent</p>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <Button onClick={() => navigate('/wallet/utilities')}>
          Buy more airtime
        </Button>
        <button
          type="button"
          onClick={() => navigate('/wallet/home')}
          className="w-full text-rowan-muted text-sm min-h-11"
        >
          Back to home
        </button>
      </div>

      <p className="text-rowan-muted text-xs text-center mt-6 font-mono">
        {id?.slice(0, 8)}…
      </p>
    </div>
  )
}
