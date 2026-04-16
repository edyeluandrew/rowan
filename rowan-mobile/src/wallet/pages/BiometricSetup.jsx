import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Fingerprint, ScanFace, ShieldCheck, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import useBiometrics from '../hooks/useBiometrics'
import { useBiometricLock } from '../../shared/context/BiometricLockContext'
import Toggle from '../components/ui/Toggle'
import Button from '../components/ui/Button'

const TIMEOUT_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
]

export default function BiometricSetup() {
  const navigate = useNavigate()
  const { isAvailable, isEnabled, biometricType, loading, enable, disable } = useBiometrics()
  const { enableLock, disableLock, timeout, lockRequired } = useBiometricLock()
  const [toggling, setToggling] = useState(false)
  const [selectedTimeout, setSelectedTimeout] = useState(timeout)
  const [statusMessage, setStatusMessage] = useState(null)

  const biometricLabel = biometricType === 'FACE_ID' ? 'Face ID' : 'Fingerprint'
  const BiometricIcon = biometricType === 'FACE_ID' ? ScanFace : Fingerprint

  const handleToggle = async () => {
    setToggling(true)
    setStatusMessage(null)
    try {
      if (isEnabled) {
        await disable()
        await disableLock()
        setStatusMessage({ type: 'success', text: `${biometricLabel} unlock disabled` })
      } else {
        const verified = await enable()
        if (verified) {
          await enableLock(selectedTimeout)
          setStatusMessage({ type: 'success', text: `${biometricLabel} unlock enabled` })
        } else {
          setStatusMessage({ type: 'error', text: 'Failed to enable biometric unlock' })
        }
      }
    } catch (err) {
      console.error('Toggle error:', err)
      setStatusMessage({ type: 'error', text: err.message || 'An error occurred' })
    } finally {
      setToggling(false)
    }
  }

  const handleTimeoutChange = (value) => {
    setSelectedTimeout(value)
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Biometric Unlock</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-rowan-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !isAvailable ? (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AlertCircle size={40} className="text-rowan-yellow" />
          </div>
          <p className="text-rowan-text font-medium mb-2">Not available</p>
          <p className="text-rowan-muted text-sm">
            Your device does not support Face ID or Fingerprint, or biometrics have not been set up in your device settings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status message */}
          {statusMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              statusMessage.type === 'success'
                ? 'bg-rowan-green bg-opacity-10 border border-rowan-green'
                : 'bg-rowan-red bg-opacity-10 border border-rowan-red'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle size={18} className="text-rowan-green flex-shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-rowan-red flex-shrink-0" />
              )}
              <p className={`text-sm ${
                statusMessage.type === 'success' ? 'text-rowan-green' : 'text-rowan-red'
              }`}>
                {statusMessage.text}
              </p>
            </div>
          )}

          {/* Enable toggle */}
          <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BiometricIcon size={20} className="text-rowan-yellow" />
              <div>
                <p className="text-rowan-text text-sm font-medium">
                  {biometricLabel} Unlock
                </p>
                <p className="text-rowan-muted text-xs">
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <Toggle
              enabled={isEnabled}
              onChange={handleToggle}
              disabled={toggling}
            />
          </div>

          {/* What this protects */}
          <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={18} className="text-rowan-green" />
              <p className="text-rowan-text text-sm font-medium">What this protects</p>
            </div>
            <ul className="space-y-2">
              {[
                'App unlock after inactivity',
                'Viewing your secret key',
                'Sending XLM from your wallet',
              ].map((item) => (
                <li key={item} className="text-rowan-muted text-xs flex items-start gap-2">
                  <span className="text-rowan-green mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Auto-lock timeout */}
          {isEnabled && (
            <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-rowan-yellow" />
                <p className="text-rowan-text text-sm font-medium">Auto-lock after inactivity</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TIMEOUT_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => handleTimeoutChange(value)}
                    className={`rounded-lg p-3 text-sm text-center min-h-12 font-medium transition-colors ${
                      selectedTimeout === value
                        ? 'bg-rowan-yellow text-rowan-bg border border-rowan-yellow'
                        : 'bg-rowan-bg border border-rowan-border text-rowan-muted hover:border-rowan-yellow'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-rowan-muted text-xs mt-3">
                Selected timeout will take effect after you close and reopen the app.
              </p>
            </div>
          )}

          {/* Info */}
          <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
            <p className="text-rowan-muted text-xs">
              <strong>Privacy:</strong> Your biometric data is processed locally on your device and never sent to our servers. Biometric unlock is a local protection layer that doesn't replace your backend authentication.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
