import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, X, QrCode } from 'lucide-react'
import { buildAndSignPayment, submitTransaction } from '../utils/stellar'
import { getUserFriendlyError } from '../utils/errorMessages'
import { getSecure } from '../utils/storage'
import MemoBox from '../components/cashout/MemoBox'
import QRCodeDisplay from '../components/wallet/QRCodeDisplay'
import Button from '../components/ui/Button'

export default function CashoutSend() {
  const navigate = useNavigate()
  const location = useLocation()
  const { transaction, network, phone } = location.state || {}
  const [allChecked, setAllChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showExitWarning, setShowExitWarning] = useState(false)
  const [qrTab, setQrTab] = useState('address') // 'address' | 'memo'

  if (!transaction) {
    navigate('/cashout', { replace: true })
    return null
  }

  const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL

  const handleSendNow = async () => {
    if (!allChecked) return
    setLoading(true)
    setError(null)
    try {
      // Read secret key from secure storage on-demand — never held in React state
      const stored = await getSecure('rowan_stellar_keypair')
      if (!stored) throw new Error('Wallet not found. Please re-import your wallet.')
      const kp = JSON.parse(stored)
      if (!kp.secretKey) throw new Error('Wallet key data is corrupted. Please re-import your wallet.')

      const signedXdr = await buildAndSignPayment({
        sourceSecretKey: kp.secretKey,
        destinationAddress: transaction.escrowAddress,
        xlmAmount: transaction.xlmAmount,
        memo: transaction.memo,
        horizonUrl,
      })
      await submitTransaction(signedXdr, horizonUrl)
      navigate(`/transaction/${transaction.id}`, { replace: true })
    } catch (err) {
      // [PHASE 4] Use user-friendly error messages
      const friendlyError = getUserFriendlyError(err.message)
      setError(friendlyError)
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

      {/* [PHASE 4] Improved error display */}
      {error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rowan-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-rowan-red font-semibold text-sm mb-1">Transaction failed</p>
            <p className="text-rowan-muted text-xs leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      <MemoBox
        escrowAddress={transaction.escrowAddress}
        amount={transaction.xlmAmount}
        memo={transaction.memo}
        onAllChecked={setAllChecked}
      />

      {/* QR Codes — scan these with an external wallet app to send manually */}
      <div className="mt-6 bg-rowan-surface border border-rowan-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={18} className="text-rowan-yellow" />
          <p className="text-rowan-text text-sm font-medium">Scan to send from another wallet</p>
        </div>

        {/* Tab selector */}
        <div className="flex rounded-lg bg-rowan-bg p-1 mb-4">
          <button
            onClick={() => setQrTab('address')}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors min-h-9 ${
              qrTab === 'address'
                ? 'bg-rowan-yellow text-rowan-bg'
                : 'text-rowan-muted'
            }`}
          >
            Address
          </button>
          <button
            onClick={() => setQrTab('memo')}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors min-h-9 ${
              qrTab === 'memo'
                ? 'bg-rowan-yellow text-rowan-bg'
                : 'text-rowan-muted'
            }`}
          >
            Memo
          </button>
        </div>

        {qrTab === 'address' ? (
          <QRCodeDisplay value={transaction.escrowAddress} label="Escrow address — scan in your Stellar wallet" />
        ) : (
          <QRCodeDisplay value={transaction.memo} label="Transaction memo — paste as memo text" />
        )}

        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-lg p-3 mt-4 flex items-start gap-2">
          <QrCode size={14} className="text-rowan-yellow shrink-0 mt-0.5" />
          <p className="text-rowan-yellow text-xs">
            You must scan both the address AND the memo. The memo is required for your transaction to be detected.
          </p>
        </div>
      </div>

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
