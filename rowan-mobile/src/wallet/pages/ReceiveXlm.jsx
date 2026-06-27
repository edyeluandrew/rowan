import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Coins, AlertTriangle } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import QRCodeDisplay from '../components/wallet/QRCodeDisplay'
import AddressDisplay from '../components/wallet/AddressDisplay'
import Button from '../components/ui/Button'
import { CURRENT_NETWORK } from '../utils/constants'
import { fundWithFriendbot } from '../utils/friendbot'

export default function ReceiveXlm() {
  const navigate = useNavigate()
  const { publicKey, refresh } = useWallet()
  const [friendbotState, setFriendbotState] = useState('idle')
  const [shareError, setShareError] = useState(null)

  const handleShare = async () => {
    if (!publicKey) return
    setShareError(null)
    const text = `Send XLM to my Rowan wallet on Stellar:\n${publicKey}`

    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: 'My Rowan Stellar address',
        text,
        dialogTitle: 'Share address',
      })
    } catch {
      try {
        await navigator.clipboard.writeText(publicKey)
      } catch {
        setShareError('Could not share or copy address')
      }
    }
  }

  const handleFriendbot = async () => {
    if (!publicKey || !CURRENT_NETWORK.friendbotUrl) return
    setFriendbotState('loading')
    try {
      await fundWithFriendbot(publicKey)
      setFriendbotState('success')
      refresh()
    } catch {
      setFriendbotState('error')
    }
  }

  if (!publicKey) {
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
          <h1 className="text-rowan-text text-lg font-bold">Receive XLM</h1>
        </div>
        <p className="text-rowan-muted text-sm text-center py-12">Wallet not loaded</p>
      </div>
    )
  }

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
        <h1 className="text-rowan-text text-lg font-bold">Receive XLM</h1>
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-5 mb-4">
        <QRCodeDisplay
          value={publicKey}
          label="Scan to send XLM to this wallet"
        />
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
        <p className="text-rowan-muted text-xs mb-2">Your Stellar address</p>
        <AddressDisplay address={publicKey} />
      </div>

      <Button onClick={handleShare} variant="ghost" className="mb-4">
        <Share2 size={18} />
        Share address
      </Button>

      {shareError && (
        <p className="text-rowan-red text-xs text-center mb-4">{shareError}</p>
      )}

      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4 flex gap-3">
        <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
        <div>
          <p className="text-rowan-text text-sm font-medium">Stellar network only</p>
          <p className="text-rowan-muted text-xs mt-1">
            Only send native XLM to this address. Other assets or networks may be lost.
          </p>
        </div>
      </div>

      {CURRENT_NETWORK.isTest && (
        <button
          onClick={handleFriendbot}
          disabled={friendbotState === 'loading' || friendbotState === 'success'}
          className="w-full flex items-center justify-center gap-2 bg-rowan-surface border border-rowan-yellow/30 rounded-xl px-4 py-3 min-h-11 disabled:opacity-50"
        >
          <Coins size={16} className="text-rowan-yellow" />
          <span className="text-rowan-yellow text-sm font-medium">
            {friendbotState === 'loading' && 'Funding...'}
            {friendbotState === 'success' && 'Funded with test XLM'}
            {friendbotState === 'error' && 'Failed — tap to retry'}
            {friendbotState === 'idle' && 'Get testnet XLM'}
          </span>
        </button>
      )}
    </div>
  )
}
