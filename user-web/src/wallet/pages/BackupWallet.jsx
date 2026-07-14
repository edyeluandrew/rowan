import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, TriangleAlert, KeyRound, Copy, CopyCheck } from 'lucide-react'
import { getSecure } from '../utils/storage'
import { COPY_FEEDBACK_TIMEOUT_MS, CLIPBOARD_AUTO_CLEAR_MS } from '../utils/constants'
import Button from '../components/ui/Button'

export default function BackupWallet() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [understood, setUnderstood] = useState(false)
  const [secretKey, setSecretKey] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const stored = await getSecure('rowan_stellar_keypair')
      if (!cancelled && stored) {
        const kp = JSON.parse(stored)
        setSecretKey(kp.secretKey)
      }
    }
    load()
    return () => {
      cancelled = true
      setSecretKey('')
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secretKey)
      setCopied(true)
      setTimeout(async () => {
        try { await navigator.clipboard.writeText('') } catch { /* ok */ }
      }, CLIPBOARD_AUTO_CLEAR_MS)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS)
    } catch {
      /* clipboard not available */
    }
  }

  if (step === 1) {
    return (
      <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-16">
        <Shield size={48} className="text-rowan-yellow mx-auto" />
        <h2 className="text-rowan-text text-xl font-bold text-center mt-4">
          Keep your secret key safe
        </h2>

        <div className="space-y-3 mt-8">
          {[
            'Never share it with anyone',
            'Do not take a screenshot',
            'Store it somewhere offline and safe',
            'Anyone with this key controls your funds',
          ].map((warning) => (
            <div key={warning} className="flex items-center gap-3">
              <TriangleAlert size={16} className="text-rowan-red flex-shrink-0" />
              <span className="text-rowan-text text-sm">{warning}</span>
            </div>
          ))}
        </div>

        <label className="flex items-start gap-3 mt-8 cursor-pointer min-h-11">
          <input
            type="checkbox"
            checked={understood}
            onChange={() => setUnderstood(!understood)}
            className="mt-1 w-5 h-5 rounded border-rowan-border accent-rowan-yellow"
          />
          <span className="text-rowan-muted text-sm">
            I understand that losing this key means losing my funds
          </span>
        </label>

        <div className="mt-8">
          <Button onClick={() => setStep(2)} disabled={!understood}>
            I understand — Show my key
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-16">
      <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-6 flex items-start gap-3">
        <TriangleAlert size={20} className="text-rowan-red shrink-0 mt-0.5" />
        <div>
          <p className="text-rowan-red text-sm font-medium">Do not screenshot</p>
          <p className="text-rowan-muted text-xs mt-1">
            Screenshots can be accessed by other apps. Write this key down on paper or use a password manager.
          </p>
        </div>
      </div>

      <div className="bg-rowan-surface border border-rowan-yellow rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-rowan-yellow" />
          <span className="text-rowan-yellow text-sm font-bold">Your Secret Key</span>
        </div>
        <p className="text-rowan-yellow font-mono text-sm break-all select-all">
          {secretKey}
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 mt-3 text-rowan-muted text-xs"
        >
          {copied ? (
            <CopyCheck size={15} className="text-rowan-green" />
          ) : (
            <Copy size={15} />
          )}
          <span>{copied ? 'Copied' : 'Copy to clipboard'}</span>
        </button>
      </div>

      <p className="text-rowan-muted text-xs text-center mt-4">
        This screen will not be shown again
      </p>

      <div className="mt-6">
        <Button onClick={() => navigate('/register')}>I have saved my secret key</Button>
      </div>
    </div>
  )
}
