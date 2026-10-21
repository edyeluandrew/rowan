/**
 * Confirms the person at this browser before USDC leaves the wallet.
 * The phone app uses fingerprint, face, or the device PIN. The website uses a release PIN.
 */
import { useEffect, useState } from 'react'
import { getSecure, setSecure } from '../utils/storage'

const PIN_KEY = 'rowan_release_pin'

async function hashPin(pin) {
  const data = new TextEncoder().encode(`rowan-release:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function ReleaseGate({ open, title = 'Confirm this USDC release', onCancel, onConfirmed }) {
  const [mode, setMode] = useState('loading')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setPin('')
    setConfirmPin('')
    setError('')
    ;(async () => {
      const saved = await getSecure(PIN_KEY).catch(() => null)
      if (cancelled) return
      setMode(saved ? 'enter' : 'create')
    })()
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const finish = () => {
    setBusy(false)
    onConfirmed()
  }

  const submitPin = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      setError('Use a 4 to 6 digit PIN')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'create') {
        if (pin !== confirmPin) {
          setError('PINs do not match')
          setBusy(false)
          return
        }
        await setSecure(PIN_KEY, await hashPin(pin))
        finish()
        return
      }
      const saved = await getSecure(PIN_KEY)
      if ((await hashPin(pin)) !== saved) {
        setError('Wrong PIN')
        setBusy(false)
        return
      }
      finish()
    } catch {
      setError('Could not check the PIN')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-rowan-surface border border-rowan-border rounded-2xl w-full max-w-sm p-5">
        <p className="text-rowan-text font-semibold">{title}</p>
        <p className="text-rowan-muted text-sm mt-1">
          {mode === 'create'
            ? 'Set a release PIN for this browser. USDC will not move until you enter it.'
            : 'Enter your release PIN before USDC moves.'}
        </p>

        {mode !== 'loading' && (
          <div className="mt-4 space-y-2">
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={mode === 'create' ? 'New PIN' : 'Release PIN'}
              className="w-full bg-rowan-bg border border-rowan-border rounded-xl px-4 py-3 text-rowan-text tracking-[0.3em]"
            />
            {mode === 'create' && (
              <input
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Confirm PIN"
                className="w-full bg-rowan-bg border border-rowan-border rounded-xl px-4 py-3 text-rowan-text tracking-[0.3em]"
              />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={submitPin}
              className="w-full min-h-11 rounded-xl bg-[#FCD535] text-[#181A20] font-semibold disabled:opacity-60"
            >
              {mode === 'create' ? 'Save PIN and continue' : 'Confirm PIN'}
            </button>
          </div>
        )}

        {error && <p className="text-rowan-red text-sm mt-3">{error}</p>}

        <button type="button" onClick={onCancel} className="mt-3 w-full text-rowan-muted text-sm min-h-9">
          Cancel
        </button>
      </div>
    </div>
  )
}
