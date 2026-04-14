import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { maskPhoneNumber } from '../utils/crypto'
import { getSecure } from '../../shared/utils/storage'
import { verifyTwoFactorLogin } from '../api/twoFactor'
import { COUNTRY_CODES } from '../utils/constants'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import WalletTwoFactorLoginModal from './WalletTwoFactorLoginModal'

const countries = Object.entries(COUNTRY_CODES)

export default function Register() {
  const navigate = useNavigate()
  const { registerWithWallet, loginWithWallet, setWalletAuthAfter2FA } = useAuth()
  const [countryCode, setCountryCode] = useState('+256')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // 2FA modal state
  const [show2faModal, setShow2faModal] = useState(false)
  const [tempUserId, setTempUserId] = useState(null)
  const [tempAuthData, setTempAuthData] = useState(null)

  const fullPhone = `${countryCode}${phone}`
  const masked = phone.length >= 4 ? maskPhoneNumber(fullPhone) : ''

  const handleRegister = async () => {
    if (!phone || phone.length < 7) return
    setLoading(true)
    setError(null)
    try {
      const response = await registerWithWallet(fullPhone)
      
      // Check if 2FA is required
      if (response?.requiresTwoFactorVerification === true) {
        // Store temp auth data and show 2FA modal
        // response has: { requiresTwoFactorVerification: true, userId, token, message? }
        setTempUserId(response.userId)
        setTempAuthData({
          token: response.token,
          userId: response.userId,
        })
        setShow2faModal(true)
      } else {
        // No 2FA needed, navigate directly
        navigate('/wallet/home', { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await loginWithWallet()
      
      // Check if 2FA is required
      if (response?.requiresTwoFactorVerification === true) {
        // Store temp auth data and show 2FA modal
        // response has: { requiresTwoFactorVerification: true, userId, token, message? }
        setTempUserId(response.userId)
        setTempAuthData({
          token: response.token,
          userId: response.userId,
        })
        setShow2faModal(true)
      } else {
        // No 2FA needed, navigate directly
        navigate('/wallet/home', { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle successful 2FA verification from modal
   * Modal verifies the code and passes back the token that was issued during SEP-10 auth
   */
  const handleAfter2FA = async (verifyCode) => {
    setLoading(true)
    setError(null)
    try {
      // Verify the 2FA code with backend
      // This just validates the TOTP/backup code
      await verifyTwoFactorLogin(tempUserId, verifyCode)
      
      // If verification succeeds, we can now use the token issued during SEP-10
      // Fetch the full user profile using the token
      const keypair = await getSecure('rowan_stellar_keypair')
      const kpData = keypair ? JSON.parse(keypair) : null
      
      // Complete wallet auth with the token issued before 2FA
      await setWalletAuthAfter2FA(
        tempAuthData.token,
        { id: tempUserId }, // Minimal user object - will be updated after this
        kpData
      )
      
      // Close modal and clear temporary state
      setShow2faModal(false)
      setTempUserId(null)
      setTempAuthData(null)
      
      // Redirect to wallet home
      navigate('/wallet/home', { replace: true })
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle 2FA modal cancel/failure
   * Clear temporary state and go back
   */
  const handle2faCancel = () => {
    setShow2faModal(false)
    setTempUserId(null)
    setTempAuthData(null)
    setError('Authentication cancelled. Please try again.')
  }

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-16">
      <h2 className="text-rowan-text text-xl font-bold text-center mb-2">
        Link your phone number
      </h2>
      <p className="text-rowan-muted text-sm text-center mb-6">
        Your phone number is hashed before being sent. We never store it in plaintext
      </p>

      <div className="flex">
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="bg-rowan-surface border border-rowan-border rounded-l-xl px-3 py-4 text-rowan-text text-sm w-20 focus:outline-none"
        >
          {countries.map(([, info]) => (
            <option key={info.code} value={info.code}>
              {info.label}
            </option>
          ))}
        </select>
        <Input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="7XXXXXXXX"
          className="rounded-l-none border-l-0"
        />
      </div>

      {masked && (
        <div className="flex items-center gap-1 mt-2">
          <Hash size={14} className="text-rowan-muted" />
          <span className="text-rowan-muted text-xs">
            Your phone: {masked} → SHA-256 → sent to server
          </span>
        </div>
      )}

      {error && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      <div className="mt-8">
        <Button onClick={handleRegister} loading={loading} disabled={phone.length < 7}>
          Create Account
        </Button>
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="text-rowan-yellow text-sm underline text-center mt-4 min-h-11"
      >
        Already have an account?
      </button>

      {/* 2FA Modal */}
      <WalletTwoFactorLoginModal
        isVisible={show2faModal}
        userId={tempUserId}
        onSuccess={handleAfter2FA}
        onCancel={handle2faCancel}
      />
    </div>
  )
}
