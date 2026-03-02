import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { buildAndSignPayment, submitTransaction } from '../utils/stellar'
import MemoBox from '../components/cashout/MemoBox'
import Button from '../components/ui/Button'

export default function CashoutSend() {
  const navigate = useNavigate()
  const location = useLocation()
  const { keypair } = useAuth()
  const { transaction, network, phone } = location.state || {}
  const [allChecked, setAllChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showExitWarning, setShowExitWarning] = useState(false)

  if (!transaction) {
    navigate('/cashout', { replace: true })
    return null
  }

  const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL

  const handleSendNow = async () => {
    if (!allChecked || !keypair?.secret) return
    setLoading(true)
    setError(null)
    try {
      const signedXdr = await buildAndSignPayment({
        sourceSecretKey: keypair.secret,
        destinationAddress: transaction.escrowAddress,
        xlmAmount: transaction.xlmAmount,
        memo: transaction.memo,
        horizonUrl,
      })
      await submitTransaction(signedXdr, horizonUrl)
      navigate(`/transaction/${transaction.id}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendManually = () => {
    navigate(`/transaction/${transaction.id}`, { replace: true })
  }

  const handleClose = () => {
    if (showExitWarning) {
      navigate('/home', { replace: true })
    } else {
      setShowExitWarning(true)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-rowan-text text-lg font-bold">Send XLM</h1>
        <button
          onClick={handleClose}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
        >
          <X size={24} />
        </button>
      </div>

      {showExitWarning && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-rowan-red shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-red text-sm font-medium">
              Are you sure you want to leave?
            </p>
            <p className="text-rowan-muted text-xs mt-1">
              You can still send XLM manually using the details above.
              Tap X again to exit.
            </p>
          </div>
        </div>
      )}

      <MemoBox
        escrowAddress={transaction.escrowAddress}
        amount={transaction.xlmAmount}
        memo={transaction.memo}
        onAllChecked={setAllChecked}
      />

      {error && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      <div className="mt-8 space-y-3">
        <Button onClick={handleSendNow} loading={loading} disabled={!allChecked}>
          Send Now
        </Button>
        <button
          onClick={handleSendManually}
          className="w-full text-rowan-muted text-sm underline text-center min-h-11"
        >
          I&apos;ll send manually
        </button>
      </div>
    </div>
  )
}
