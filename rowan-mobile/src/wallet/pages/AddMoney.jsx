import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Smartphone, Clock } from 'lucide-react'
import Button from '../components/ui/Button'

export default function AddMoney() {
  const navigate = useNavigate()

  return (
    <div className="bg-rowan-bg min-h-screen px-4 pt-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Back"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Add money</h1>
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-8 text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-rowan-yellow/10 flex items-center justify-center mx-auto mb-4">
          <Smartphone size={28} className="text-rowan-yellow" />
        </div>
        <p className="text-rowan-text text-base font-semibold mb-2">Coming soon</p>
        <p className="text-rowan-muted text-sm">
          Pay with MTN or Airtel and receive XLM directly in your Rowan wallet.
        </p>
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6 flex gap-3">
        <Clock size={18} className="text-rowan-muted shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs">
          For now, receive XLM from another wallet or exchange, then cash out to mobile money when you need UGX.
        </p>
      </div>

      <Button onClick={() => navigate('/wallet/receive')} variant="ghost" className="mb-3">
        Receive XLM instead
      </Button>
      <Button onClick={() => navigate('/wallet/home')}>
        Back to Home
      </Button>
    </div>
  )
}
