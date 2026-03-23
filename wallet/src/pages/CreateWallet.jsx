import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, TriangleAlert, Coins } from 'lucide-react'
import { generateKeypair } from '../utils/stellar'
import { setSecure } from '../utils/storage'
import { CURRENT_NETWORK, WALLET_GEN_DELAY_MS } from '../utils/constants'
import AddressDisplay from '../components/wallet/AddressDisplay'
import Button from '../components/ui/Button'

export default function CreateWallet() {
  const navigate = useNavigate()
  const [keypair, setKeypair] = useState(null)
  const [generating, setGenerating] = useState(true)
  const [showSkipWarning, setShowSkipWarning] = useState(false)
  const [friendbotState, setFriendbotState] = useState('idle') // idle | loading | success | error

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
    }, WALLET_GEN_DELAY_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  const fundWithFriendbot = async () => {
    if (!keypair || !CURRENT_NETWORK.friendbotUrl) return
    setFriendbotState('loading')
    try {
      const res = await fetch(
        `${CURRENT_NETWORK.friendbotUrl}?addr=${encodeURIComponent(keypair.publicKey)}`
      )
      if (!res.ok) throw new Error('Friendbot request failed')
      setFriendbotState('success')
    } catch {
      setFriendbotState('error')
    }
  }

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

      {/* Friendbot — testnet only */}
      {CURRENT_NETWORK.isTest && (
        <button
          onClick={fundWithFriendbot}
          disabled={friendbotState === 'loading' || friendbotState === 'success'}
          className="w-full flex items-center justify-center gap-2 bg-rowan-surface border border-rowan-yellow/30 rounded-xl px-4 py-3 min-h-11 mb-6 disabled:opacity-50"
        >
          <Coins size={16} className="text-rowan-yellow" />
          <span className="text-rowan-yellow text-sm font-medium">
            {friendbotState === 'loading' && 'Funding...'}
            {friendbotState === 'success' && 'Funded with 10,000 XLM!'}
            {friendbotState === 'error' && 'Failed — tap to retry'}
            {friendbotState === 'idle' && 'Fund with Testnet XLM'}
          </span>
        </button>
      )}

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
