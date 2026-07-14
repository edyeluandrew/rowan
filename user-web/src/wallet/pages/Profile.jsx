import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCircle, Shield, Copy, CopyCheck, LogOut, Volume2, VolumeX,
  Vibrate, ShieldCheck, Clock, Fingerprint, Bell, ChevronRight, Lock, Globe,
  HelpCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import useWallet from '../hooks/useWallet'
import useTransactions from '../hooks/useTransactions'
import useUserCountry from '../hooks/useUserCountry'
import { getPreference, setPreference } from '../utils/storage'
import { formatAddress } from '../utils/format'
import { KYC_LEVELS, COPY_FEEDBACK_TIMEOUT_MS, COUNTRY_CODES } from '../utils/constants'
import { COUNTRY_FIAT } from '../utils/country'
import CountryPicker from '../components/settings/CountryPicker'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'
import Badge from '../components/ui/Badge'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { usdcBalance, hasUsdcTrustline, publicKey } = useWallet()
  const { stats } = useTransactions()
  const { country, setCountry } = useUserCountry()
  const [showCountryPicker, setShowCountryPicker] = useState(false)
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
      navigate('/', { replace: true })
    } catch {
      setLoggingOut(false)
    }
  }

  const kycLevel = user?.kycLevel || 'NONE'
  const kycInfo = KYC_LEVELS[kycLevel] || KYC_LEVELS.NONE

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-rowan-text text-lg font-bold mb-6">You</h1>

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
        <button
          type="button"
          onClick={() => navigate('/wallet/verify-identity')}
          className="flex items-center justify-between w-full border-t border-rowan-border pt-3 min-h-11"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-rowan-yellow" />
            <span className="text-rowan-text text-sm">
              {kycLevel === 'VERIFIED' ? 'Identity verified' : 'Verify identity to raise limits'}
            </span>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>
      </div>

      {/* USDC wallet */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">USDC balance</p>
        <p className="text-rowan-yellow text-2xl font-bold tabular-nums">
          {hasUsdcTrustline ? Number(usdcBalance || 0).toFixed(2) : '—'}
        </p>
        {hasUsdcTrustline === false && (
          <p className="text-rowan-muted text-xs mt-1">
            Enable USDC below to receive tokens from P2P buy
          </p>
        )}
        {hasUsdcTrustline === false && <UsdcTrustlineSetup compact />}
      </div>

      {/* Stats — tap to open History */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate('/wallet/history', { state: { status: 'all' } })}
          className="bg-rowan-surface rounded-xl p-3 text-center min-h-11"
        >
          <Clock size={16} className="text-rowan-muted mx-auto mb-1" />
          <p className="text-rowan-text text-sm font-semibold tabular-nums">{stats?.total ?? 0}</p>
          <p className="text-rowan-muted text-[10px]">Transactions</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/wallet/history', { state: { status: 'completed' } })}
          className="bg-rowan-surface rounded-xl p-3 text-center min-h-11"
        >
          <ShieldCheck size={16} className="text-rowan-green mx-auto mb-1" />
          <p className="text-rowan-text text-sm font-semibold tabular-nums">{stats?.completed ?? 0}</p>
          <p className="text-rowan-muted text-[10px]">Completed</p>
        </button>
      </div>

      {/* Country / market */}
      <div className="bg-rowan-surface rounded-xl mb-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCountryPicker((v) => !v)}
          className="flex items-center justify-between w-full px-4 py-3 min-h-11"
        >
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-rowan-muted" />
            <div className="text-left">
              <span className="text-rowan-text text-sm block">Country</span>
              <span className="text-rowan-muted text-xs">
                {COUNTRY_CODES[country]?.flag} {COUNTRY_CODES[country]?.name} · {COUNTRY_FIAT[country]}
              </span>
            </div>
          </div>
          <ChevronRight
            size={16}
            className={`text-rowan-muted transition-transform ${showCountryPicker ? 'rotate-90' : ''}`}
          />
        </button>
        {showCountryPicker && (
          <div className="px-4 pb-4 border-t border-rowan-border pt-3">
            <CountryPicker
              value={country}
              onChange={(code) => {
                setCountry(code)
                setShowCountryPicker(false)
              }}
            />
          </div>
        )}
      </div>

      {/* Help */}
      <div className="bg-rowan-surface rounded-xl divide-y divide-rowan-border mb-4">
        <button
          type="button"
          onClick={() => navigate('/wallet/help')}
          className="flex items-center justify-between w-full px-4 py-3 min-h-11"
        >
          <div className="flex items-center gap-3">
            <HelpCircle size={18} className="text-rowan-yellow" />
            <div className="text-left">
              <span className="text-rowan-text text-sm block">Help</span>
              <span className="text-rowan-muted text-xs">Pilot guide · WhatsApp · Email</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>
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
          onClick={() => navigate('/wallet/biometric-setup')}
          className="flex items-center justify-between w-full px-4 py-3 min-h-11"
        >
          <div className="flex items-center gap-3">
            <Fingerprint size={18} className="text-rowan-muted" />
            <span className="text-rowan-text text-sm">Biometric Unlock</span>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>
        <button
          onClick={() => navigate('/wallet/security/2fa')}
          className="flex items-center justify-between w-full px-4 py-3 min-h-11"
        >
          <div className="flex items-center gap-3">
            <Lock size={18} className="text-rowan-muted" />
            <span className="text-rowan-text text-sm">Two-Factor Auth</span>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>
        <button
          onClick={() => navigate('/wallet/blocked-traders')}
          className="flex items-center justify-between w-full px-4 py-3 min-h-11"
        >
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-rowan-muted" />
            <span className="text-rowan-text text-sm">Blocked Traders</span>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>
        <button
          onClick={() => navigate('/wallet/rate-alerts')}
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
