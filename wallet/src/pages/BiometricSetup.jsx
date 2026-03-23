import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Fingerprint, ScanFace, ShieldCheck, Clock } from 'lucide-react'
import useBiometrics from '../hooks/useBiometrics'
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
  const [toggling, setToggling] = useState(false)

  const biometricLabel = biometricType === 'FACE_ID' ? 'Face ID' : 'Fingerprint'
  const BiometricIcon = biometricType === 'FACE_ID' ? ScanFace : Fingerprint

  const handleToggle = async () => {
    setToggling(true)
    try {
      if (isEnabled) {
        await disable()
      } else {
        await enable()
      }
    } finally {
      setToggling(false)
    }
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
            <ScanFace size={40} className="text-rowan-muted" />
            <Fingerprint size={40} className="text-rowan-muted" />
          </div>
          <p className="text-rowan-text font-medium mb-2">Not available</p>
          <p className="text-rowan-muted text-sm">
            Your device does not support Face ID or Fingerprint, or biometrics have not been set up in your device settings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
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
                <p className="text-rowan-text text-sm font-medium">Auto-lock after</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TIMEOUT_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    className="bg-rowan-bg border border-rowan-border rounded-lg p-2 text-rowan-muted text-xs text-center min-h-11"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
