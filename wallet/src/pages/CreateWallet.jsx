import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { generateKeypair } from '../utils/stellar'
import { setSecure } from '../utils/storage'
import AddressDisplay from '../components/wallet/AddressDisplay'
import Button from '../components/ui/Button'

export default function CreateWallet() {
  const navigate = useNavigate()
  const [keypair, setKeypair] = useState(null)
  const [generating, setGenerating] = useState(true)
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const kp = generateKeypair()
      await setSecure('rowan_stellar_keypair', JSON.stringify(kp))
      await setSecure('rowan_wallet_created_at', new Date().toISOString())
      if (!cancelled) {
        setKeypair(kp)
        setGenerating(false)
      }
    }, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  if (generating) {
    return (
      <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-center">
        <RefreshCw size={48} className="text-rowan-yellow animate-spin-slow" />
        <p className="text-rowan-muted text-sm mt-4">Generating your wallet...</p>
      </div>
    )
  }

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-16">
      <h2 className="text-rowan-text text-xl font-bold text-center mb-2">Wallet Created</h2>
      <p className="text-rowan-muted text-sm text-center mb-6">Your Stellar address</p>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 flex justify-center mb-6">
        <AddressDisplay address={keypair?.publicKey} />
      </div>

      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-2">
          <TriangleAlert size={20} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
          <p className="text-rowan-text text-sm">
            Your wallet has been created. Back up your secret key before continuing.
            If you lose it you permanently lose access to your funds.
          </p>
        </div>
      </div>

      <Button onClick={() => navigate('/backup-wallet')}>Back Up Now</Button>

      {!showSkipWarning ? (
        <button
          onClick={() => setShowSkipWarning(true)}
          className="text-rowan-muted text-sm text-center mt-4 min-h-11"
        >
          Skip for Now
        </button>
      ) : (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mt-4">
          <p className="text-rowan-red text-sm mb-3">
            Are you sure? You will not be able to recover your wallet without a backup
          </p>
          <button
            onClick={() => navigate('/register')}
            className="text-rowan-red text-sm font-bold underline min-h-11"
          >
            Yes, skip backup
          </button>
        </div>
      )}
    </div>
  )
}
