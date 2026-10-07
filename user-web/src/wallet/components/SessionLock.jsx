/**
 * Shown after the wallet sits idle. The person confirms with the lock
 * already on this device, then Rowan signs the wallet back in.
 */
import { useState } from 'react'
import { Lock, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import useBiometrics from '../hooks/useBiometrics'
import { useBiometricLock } from '../../shared/context/BiometricLockContext'
import { isMissingWalletAccount } from '../utils/apiErrors'
import Button from './ui/Button'
import WalletTwoFactorLoginModal from '../pages/WalletTwoFactorLoginModal'
import { getSecure } from '../utils/storage'

export default function SessionLock() {
  const { sessionLocked, loginWithWallet, setWalletAuthAfter2FA, logout } = useAuth()
  const { unlock } = useBiometricLock()
  const { isAvailable, loading: detecting, authenticate } = useBiometrics()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [show2faModal, setShow2faModal] = useState(false)
  const [tempUserId, setTempUserId] = useState(null)

  if (!sessionLocked) return null

  const finish = async (response) => {
    if (response?.requiresTwoFactorVerification === true) {
      setTempUserId(response.userId)
      setShow2faModal(true)
      return
    }
    unlock()
  }

  const handleResume = async () => {
    setLoading(true)
    setError(null)
    try {
      if (isAvailable) {
        const verified = await authenticate()
        if (!verified) {
          setError("Confirm with this device's lock to continue.")
          return
        }
      }
      const response = await loginWithWallet()
      await finish(response)
    } catch (err) {
      if (isMissingWalletAccount(err)) {
        setError('This wallet still needs phone setup before it can sign in.')
      } else {
        setError(err?.message || 'Could not sign in')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAfter2FA = async (verifyResponse) => {
    setLoading(true)
    setError(null)
    try {
      const keypair = await getSecure('rowan_stellar_keypair')
      const kpData = keypair ? JSON.parse(keypair) : null
      await setWalletAuthAfter2FA(
        verifyResponse.token,
        verifyResponse.user || { id: tempUserId },
        kpData,
      )
      setShow2faModal(false)
      setTempUserId(null)
      unlock()
    } catch (err) {
      setError(err?.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-rowan-bg px-6">
      <Lock size={56} className="mb-6 text-rowan-yellow" />
      <h1 className="mb-2 text-center text-2xl font-bold text-rowan-text">Session paused</h1>
      <p className="mb-8 max-w-xs text-center text-sm text-rowan-muted">
        {detecting
          ? 'Checking this device…'
          : isAvailable
            ? "You have been away for a few minutes. Confirm with this device's PIN, fingerprint, or face unlock."
            : 'You have been away for a few minutes. Sign in to continue.'}
      </p>

      <div className="w-full max-w-sm">
        <Button onClick={handleResume} loading={loading || detecting} disabled={detecting}>
          Sign in
        </Button>
      </div>

      {error && <p className="mt-4 max-w-sm text-center text-sm text-rowan-red">{error}</p>}

      <button
        type="button"
        onClick={() => logout()}
        disabled={loading}
        className="mt-8 inline-flex items-center gap-2 text-sm text-rowan-muted disabled:opacity-50"
      >
        <LogOut size={16} />
        Sign out
      </button>

      <WalletTwoFactorLoginModal
        isVisible={show2faModal}
        userId={tempUserId}
        onSuccess={handleAfter2FA}
        onCancel={() => {
          setShow2faModal(false)
          setTempUserId(null)
          setError('Authentication cancelled. Please try again.')
        }}
      />
    </div>
  )
}
