import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCircle, Star, Shield, Copy, CopyCheck, LogOut, Volume2, VolumeX,
  Vibrate, ShieldCheck, Clock, Fingerprint, Bell, ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import useWallet from '../hooks/useWallet'
import useTransactions from '../hooks/useTransactions'
import { getPreference, setPreference } from '../utils/storage'
import { formatAddress, formatXlm } from '../utils/format'
import { KYC_LEVELS, COPY_FEEDBACK_TIMEOUT_MS } from '../utils/constants'
import Badge from '../components/ui/Badge'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { balance, publicKey } = useWallet()
  const { stats } = useTransactions()
  const [copied, setCopied] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [vibrationEnabled, setVibrationEnabled] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const sound = await getPreference('rowan_user_sound_enabled')
        const vibration = await getPreference('rowan_user_vibration_enabled')
        if (sound !== null) setSoundEnabled(sound === 'true')
        if (vibration !== null) setVibrationEnabled(vibration === 'true')
      } catch {
        // use defaults
      }
    }
    loadPrefs()
  }, [])

  const toggleSound = async () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    await setPreference('rowan_user_sound_enabled', String(next))
  }

  const toggleVibration = async () => {
    const next = !vibrationEnabled
    setVibrationEnabled(next)
    await setPreference('rowan_user_vibration_enabled', String(next))
  }

  const handleCopy = async () => {
    if (!publicKey) return
    try {
      await navigator.clipboard.writeText(publicKey)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS)
    } catch {
      // clipboard not available
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/onboarding', { replace: true })
    } catch {
      setLoggingOut(false)
    }
  }

  const kycLevel = user?.kycLevel || 'NONE'
  const kycInfo = KYC_LEVELS[kycLevel] || KYC_LEVELS.NONE

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-rowan-text text-lg font-bold mb-6">Profile</h1>

      {/* Identity card */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-rowan-yellow/10 flex items-center justify-center">
            <UserCircle size={28} className="text-rowan-yellow" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-rowan-text text-sm font-mono truncate">
                {publicKey ? formatAddress(publicKey) : '---'}
              </p>
              <button onClick={handleCopy}>
                {copied
                  ? <CopyCheck size={14} className="text-rowan-green" />
                  : <Copy size={14} className="text-rowan-muted" />
                }
              </button>
            </div>
            <Badge color={kycInfo?.color || 'gray'}>
              <Shield size={10} className="mr-1" />
              KYC Level {kycLevel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-rowan-surface rounded-xl p-3 text-center">
          <Star size={16} className="text-rowan-yellow mx-auto mb-1" />
          <p className="text-rowan-text text-sm font-semibold">{formatXlm(balance || 0)}</p>
          <p className="text-rowan-muted text-[10px]">Balance</p>
        </div>
        <div className="bg-rowan-surface rounded-xl p-3 text-center">
          <Clock size={16} className="text-rowan-muted mx-auto mb-1" />
          <p className="text-rowan-text text-sm font-semibold">{stats?.total || 0}</p>
          <p className="text-rowan-muted text-[10px]">Transactions</p>
        </div>
        <div className="bg-rowan-surface rounded-xl p-3 text-center">
          <ShieldCheck size={16} className="text-rowan-green mx-auto mb-1" />
          <p className="text-rowan-text text-sm font-semibold">{stats?.completed || 0}</p>
          <p className="text-rowan-muted text-[10px]">Completed</p>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-rowan-surface rounded-xl divide-y divide-rowan-border mb-4">
        <ToggleRow
          icon={soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          label="Notification Sound"
          enabled={soundEnabled}
          onToggle={toggleSound}
        />
        <ToggleRow
          icon={<Vibrate size={18} />}
          label="Vibration"
          enabled={vibrationEnabled}
          onToggle={toggleVibration}
        />
      </div>

      {/* Security */}
      <div className="bg-rowan-surface rounded-xl divide-y divide-rowan-border mb-4">
        <button
          onClick={() => navigate('/biometric-setup')}
          className="flex items-center justify-between w-full px-4 py-3 min-h-11"
        >
          <div className="flex items-center gap-3">
            <Fingerprint size={18} className="text-rowan-muted" />
            <span className="text-rowan-text text-sm">Biometric Unlock</span>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>
        <button
          onClick={() => navigate('/rate-alerts')}
          className="flex items-center justify-between w-full px-4 py-3 min-h-11"
        >
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-rowan-muted" />
            <span className="text-rowan-text text-sm">Rate Alerts</span>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>
      </div>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full flex items-center justify-center gap-2 bg-rowan-red/10 border border-rowan-red/30 rounded-xl px-4 py-3 min-h-11"
      >
        <LogOut size={16} className="text-rowan-red" />
        <span className="text-rowan-red text-sm font-medium">
          {loggingOut ? 'Logging out...' : 'Log Out'}
        </span>
      </button>
    </div>
  )
}

function ToggleRow({ icon, label, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-rowan-muted">{icon}</span>
        <span className="text-rowan-text text-sm">{label}</span>
      </div>
      <button
        onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          enabled ? 'bg-rowan-yellow' : 'bg-rowan-border'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            enabled ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}
