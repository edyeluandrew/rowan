import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Share2, Download, Copy, CopyCheck, Clock, XCircle } from 'lucide-react'
import { getTransactionReceipt } from '../api/cashout'
import ReceiptCard from '../components/ui/ReceiptCard'
import Button from '../components/ui/Button'
import { CURRENT_NETWORK, ROWAN_BG_HEX, COPY_FEEDBACK_TIMEOUT_MS } from '../utils/constants'
import { formatAddress } from '../utils/format'

export default function TransactionReceipt() {
  const { transactionId } = useParams()
  const navigate = useNavigate()
  const receiptRef = useRef(null)

  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const data = await getTransactionReceipt(transactionId)
        if (!cancelled) setReceipt(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [transactionId])

  /**
   * Convert the receipt card to a canvas blob.
   */
  const captureImage = useCallback(async () => {
    if (!receiptRef.current) return null
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(receiptRef.current, {
      backgroundColor: ROWAN_BG_HEX,
      scale: 2,
    })
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }, [])

  /**
   * Share the receipt using Capacitor Share (native) or clipboard fallback.
   */
  const handleShare = useCallback(async () => {
    setSharing(true)
    try {
      // Try native share (Capacitor)
      const { Share } = await import('@capacitor/share')
      const blob = await captureImage()
      if (blob) {
        // Convert blob to base64 data URI
        const reader = new FileReader()
        const dataUri = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })

        await Share.share({
          title: 'Rowan Receipt',
          text: `Rowan payment receipt — TX ${formatAddress(receipt?.id || transactionId)}`,
          url: dataUri,
          dialogTitle: 'Share Receipt',
        })
      }
    } catch {
      // Fallback: copy a text summary to clipboard
      try {
        const text = [
          'Rowan Receipt',
          `TX: ${receipt?.id || transactionId}`,
          `Amount: ${receipt?.xlmAmount} XLM → ${receipt?.fiatCurrency} ${receipt?.fiatAmount}`,
          receipt?.stellarTxHash ? `Stellar TX: ${receipt.stellarTxHash}` : '',
          `Network: ${CURRENT_NETWORK.isTest ? 'Testnet' : 'Mainnet'}`,
        ]
          .filter(Boolean)
          .join('\n')
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS)
      } catch {
        /* clipboard not available */
      }
    } finally {
      setSharing(false)
    }
  }, [receipt, transactionId, captureImage])

  /**
   * Save receipt as a PNG image — triggers a browser download.
   */
  const handleSaveImage = useCallback(async () => {
    setSaving(true)
    try {
      const blob = await captureImage()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rowan-receipt-${transactionId}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      /* save failed */
    } finally {
      setSaving(false)
    }
  }, [transactionId, captureImage])

  /* ── Loading ─────────────────────── */
  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin text-rowan-yellow">
          <Clock size={24} />
        </div>
      </div>
    )
  }

  /* ── Error ───────────────────────── */
  if (error || !receipt) {
    return (
      <div className="bg-rowan-bg min-h-screen px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">Receipt</h1>
        </div>
        <div className="bg-rowan-surface rounded-xl p-6 text-center">
          <XCircle size={32} className="text-rowan-red mx-auto mb-3" />
          <p className="text-rowan-red text-sm">{error || 'Receipt not available'}</p>
          <button
            onClick={() => navigate('/wallet/home', { replace: true })}
            className="text-rowan-yellow text-sm underline mt-4"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  /* ── Success ─────────────────────── */
  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Receipt</h1>
      </div>

      {/* Receipt card (captured for image export) */}
      <ReceiptCard ref={receiptRef} receipt={receipt} />

      {/* Stellar Explorer link */}
      {receipt.stellarTxHash && (
        <a
          href={`${CURRENT_NETWORK.explorerUrl}/tx/${receipt.stellarTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-rowan-yellow text-xs underline mt-4"
        >
          View on Stellar Explorer
        </a>
      )}

      {/* Action buttons */}
      <div className="mt-6 space-y-3">
        <Button onClick={handleShare} disabled={sharing}>
          <span className="flex items-center justify-center gap-2">
            {copied ? (
              <>
                <CopyCheck size={16} />
                Copied to clipboard
              </>
            ) : (
              <>
                <Share2 size={16} />
                {sharing ? 'Sharing...' : 'Share Receipt'}
              </>
            )}
          </span>
        </Button>

        <button
          onClick={handleSaveImage}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 min-h-11 disabled:opacity-50"
        >
          <Download size={16} className="text-rowan-text" />
          <span className="text-rowan-text text-sm font-medium">
            {saving ? 'Saving...' : 'Save as Image'}
          </span>
        </button>
      </div>
    </div>
  )
}
