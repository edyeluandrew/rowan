import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert, KeyRound, Copy, CopyCheck } from 'lucide-react'
import { getSecure } from '../utils/storage'
import { COPY_FEEDBACK_TIMEOUT_MS, CLIPBOARD_AUTO_CLEAR_MS } from '../utils/constants'
import Button from '../components/ui/Button'
import OnboardingShell from '../components/layout/OnboardingShell'

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
      /* clipboard */
    }
  }

  if (step === 1) {
    return (
      <OnboardingShell
        step={2}
        stepTotal={3}
        title="Protect your key"
        subtitle="This secret key is cash. Anyone with it can move your funds."
      >
        <ul className="space-y-2.5 mb-6">
          {[
            'Never share it with anyone',
            'Do not screenshot this screen',
            'Store it offline or in a password manager',
            'You alone recover the wallet with this key',
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 rounded-2xl bg-rowan-bg border border-rowan-border px-3.5 py-3"
            >
              <TriangleAlert size={16} className="text-rowan-red flex-shrink-0 mt-0.5" />
              <span className="text-sm text-rowan-text font-sans leading-snug">{line}</span>
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-3 cursor-pointer min-h-11 mb-6">
          <input
            type="checkbox"
            checked={understood}
            onChange={() => setUnderstood(!understood)}
            className="mt-1 w-5 h-5 rounded border-rowan-border accent-rowan-green"
          />
          <span className="text-sm text-rowan-muted leading-relaxed font-sans">
            I understand that losing this key means losing my funds
          </span>
        </label>

        <Button onClick={() => setStep(2)} disabled={!understood}>
          Show my secret key
        </Button>
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell
      step={3}
      stepTotal={3}
      title="Save this key"
      subtitle="Write it down offline. You will not see this screen again."
    >
      <div className="bg-rowan-red/10 border border-rowan-red/25 rounded-2xl p-3.5 mb-5 flex items-start gap-2.5">
        <TriangleAlert size={18} className="text-rowan-red shrink-0 mt-0.5" />
        <div>
          <p className="text-rowan-red text-sm font-medium font-sans">Do not screenshot</p>
          <p className="text-rowan-muted text-xs mt-1 leading-relaxed font-sans">
            Prefer paper or a password manager.
          </p>
        </div>
      </div>

      <div className="bg-rowan-green text-white rounded-2xl p-4 sm:p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-rowan-lime" />
          <span className="text-rowan-lime text-xs font-bold uppercase tracking-wider font-sans">
            Secret key
          </span>
        </div>
        <p className="font-mono text-xs sm:text-sm break-all select-all leading-relaxed text-white/95">
          {secretKey}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 mt-4 text-white/75 text-xs hover:text-white font-sans min-h-9"
        >
          {copied ? <CopyCheck size={15} className="text-rowan-lime" /> : <Copy size={15} />}
          <span>{copied ? 'Copied' : 'Copy to clipboard'}</span>
        </button>
      </div>

      <div className="mt-6">
        <Button onClick={() => navigate('/register')}>I have saved my key</Button>
      </div>
    </OnboardingShell>
  )
}
