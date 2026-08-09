import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Copy, CopyCheck, Coins, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import QRCodeDisplay from '../components/wallet/QRCodeDisplay'
import AddressDisplay from '../components/wallet/AddressDisplay'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'
import Button from '../components/ui/Button'
import { CURRENT_NETWORK, COPY_FEEDBACK_TIMEOUT_MS } from '../utils/constants'
import { fundWithFriendbot } from '../utils/friendbot'

const POLL_MS = 5000

export default function ReceiveXlm() {
  const navigate = useNavigate()
  const { publicKey, balance, usdcBalance, refresh } = useWallet()
  const [friendbotState, setFriendbotState] = useState('idle')
  const [shareError, setShareError] = useState(null)
  const [copyState, setCopyState] = useState('idle')
  const [depositBanner, setDepositBanner] = useState(null)
  const baselineUsdc = useRef(null)
  const lastDetected = useRef(null)

  // Track baseline once we have a number; poll for increases while Receive is open
  useEffect(() => {
    if (usdcBalance == null) return
    const n = Number(usdcBalance)
    if (!Number.isFinite(n)) return
    if (baselineUsdc.current == null) {
      baselineUsdc.current = n
      return
    }
    if (n > baselineUsdc.current + 0.0000001) {
      const delta = n - baselineUsdc.current
      const key = `${n.toFixed(7)}`
      if (lastDetected.current !== key) {
        lastDetected.current = key
        setDepositBanner({
          amount: delta,
          total: n,
          at: Date.now(),
        })
        baselineUsdc.current = n
      }
    }
  }, [usdcBalance])

  useEffect(() => {
    if (!publicKey) return undefined
    refresh()
    const id = setInterval(() => refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [publicKey, refresh])

  const handleCopy = async () => {
    if (!publicKey) return
    setShareError(null)
    try {
      await navigator.clipboard.writeText(publicKey)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_TIMEOUT_MS)
    } catch {
      setShareError('Could not copy address')
    }
  }

  const handleShare = async () => {
    if (!publicKey) return
    setShareError(null)
    const text = `Send USDC on Stellar (${CURRENT_NETWORK.isTest ? 'testnet' : 'mainnet'}) to my Rowan wallet:\n${publicKey}`

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
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_TIMEOUT_MS)
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
          <h1 className="text-rowan-text text-lg font-bold">Receive</h1>
        </div>
        <p className="text-rowan-muted text-sm text-center py-12">Wallet not loaded</p>
      </div>
    )
  }

  const networkLabel = CURRENT_NETWORK.isTest ? 'Stellar testnet' : 'Stellar mainnet'
  const usdcLabel = usdcBalance != null && Number.isFinite(Number(usdcBalance))
    ? Number(usdcBalance).toFixed(4)
    : '—'

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
        <div className="min-w-0 flex-1">
          <h1 className="text-rowan-text text-lg font-bold">Receive USDC</h1>
          <p className="text-rowan-muted text-xs mt-0.5">{networkLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Refresh balance"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <UsdcTrustlineSetup onEnabled={refresh} />

      {depositBanner && (
        <div className="bg-rowan-green/10 border border-rowan-green/35 rounded-xl p-4 mb-4 flex gap-3">
          <CheckCircle2 size={20} className="text-rowan-green shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-rowan-green text-sm font-semibold">USDC arrived</p>
            <p className="text-rowan-text text-sm mt-1 tabular-nums">
              +{depositBanner.amount.toFixed(4)} USDC
            </p>
            <p className="text-rowan-muted text-xs mt-1">
              Balance now {depositBanner.total.toFixed(4)} USDC. You can buy airtime or cash out when ready.
            </p>
            <button
              type="button"
              onClick={() => navigate('/wallet/home')}
              className="text-rowan-green text-xs font-semibold underline mt-2 min-h-9"
            >
              Back to home
            </button>
          </div>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-rowan-muted text-xs">Wallet USDC</p>
          <p className="text-rowan-text text-lg font-semibold tabular-nums">{usdcLabel}</p>
        </div>
        <p className="text-rowan-muted text-[11px] text-right max-w-[9rem] leading-snug">
          Watching for deposits every few seconds
        </p>
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-5 mb-4">
        <QRCodeDisplay
          value={publicKey}
          label="Scan to send USDC on Stellar"
        />
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-3">
        <p className="text-rowan-muted text-xs mb-2">Your Stellar address</p>
        <AddressDisplay address={publicKey} />
        <p className="text-rowan-muted text-[11px] font-mono mt-3 break-all leading-relaxed select-all">
          {publicKey}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button onClick={handleCopy} variant="ghost">
          {copyState === 'copied' ? <CopyCheck size={18} className="text-rowan-green" /> : <Copy size={18} />}
          {copyState === 'copied' ? 'Copied' : 'Copy'}
        </Button>
        <Button onClick={handleShare} variant="ghost">
          <Share2 size={18} />
          Share
        </Button>
      </div>

      {shareError && (
        <p className="text-rowan-red text-xs text-center mb-4">{shareError}</p>
      )}

      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4 flex gap-3">
        <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
        <div>
          <p className="text-rowan-text text-sm font-medium">Stellar USDC only ({networkLabel})</p>
          <p className="text-rowan-muted text-xs mt-1">
            Send USDC issued on Stellar to this address. Other chains or tokens can be lost.
            This screen watches for balance increases after you send.
          </p>
        </div>
      </div>

      {CURRENT_NETWORK.isTest && (balance == null || parseFloat(balance) < 1) && (
        <button
          onClick={handleFriendbot}
          disabled={friendbotState === 'loading' || friendbotState === 'success'}
          className="w-full flex items-center justify-center gap-2 bg-rowan-surface border border-rowan-yellow/30 rounded-xl px-4 py-3 min-h-11 disabled:opacity-50"
        >
          <Coins size={16} className="text-rowan-yellow" />
          <span className="text-rowan-yellow text-sm font-medium">
            {friendbotState === 'loading' && 'Setting up network fees...'}
            {friendbotState === 'success' && 'Network fees ready'}
            {friendbotState === 'error' && 'Failed — tap to retry'}
            {friendbotState === 'idle' && 'Set up network fees (testnet)'}
          </span>
        </button>
      )}
    </div>
  )
}
