import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSecure } from '../../shared/utils/storage'
import { COUNTRY_CODES } from '../utils/constants'
import { getDialCodeForCountry } from '../utils/country'
import { persistUserCountry } from '../hooks/useUserCountry'
import CountryPicker from '../components/settings/CountryPicker'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import WalletTwoFactorLoginModal from './WalletTwoFactorLoginModal'

export default function Register() {
  const navigate = useNavigate()
  const { registerWithWallet, loginWithWallet, setWalletAuthAfter2FA } = useAuth()
  const [country, setCountry] = useState('UG')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [show2faModal, setShow2faModal] = useState(false)
  const [tempUserId, setTempUserId] = useState(null)

  const countryCode = getDialCodeForCountry(country)
  const fullPhone = `${countryCode}${phone}`

  const saveCountryAndGoHome = async () => {
    await persistUserCountry(country)
    navigate('/wallet/home', { replace: true })
  }

  const handleRegister = async () => {
    if (!phone || phone.length < 7) return
    setLoading(true)
    setError(null)
    try {
      const response = await registerWithWallet(fullPhone)

      if (response?.requiresTwoFactorVerification === true) {
        setTempUserId(response.userId)
        setShow2faModal(true)
      } else {
        await saveCountryAndGoHome()
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

      if (response?.requiresTwoFactorVerification === true) {
        setTempUserId(response.userId)
        setShow2faModal(true)
      } else {
        await saveCountryAndGoHome()
      }
    } catch (err) {
      setError(err.message)
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
        kpData
      )

      setShow2faModal(false)
      setTempUserId(null)
      await saveCountryAndGoHome()
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handle2faCancel = () => {
    setShow2faModal(false)
    setTempUserId(null)
    setError('Authentication cancelled. Please try again.')
  }

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-12 pb-8">
      <h2 className="text-rowan-text text-xl font-bold text-center mb-2">
        Set up your account
      </h2>
      <p className="text-rowan-muted text-sm text-center mb-6">
        Choose your country — we&apos;ll show balances and cash out in your local mobile money currency
      </p>

      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Your country</p>
      <CountryPicker value={country} onChange={setCountry} disabled={loading} />

      <p className="text-rowan-muted text-xs uppercase tracking-wider mt-6 mb-2">Phone number</p>
      <div className="flex">
        <div className="bg-rowan-surface border border-rowan-border rounded-l-xl px-3 py-4 text-rowan-muted text-sm w-20 flex items-center justify-center shrink-0">
          {COUNTRY_CODES[country]?.flag} {countryCode}
        </div>
        <Input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="7XXXXXXXX"
          className="rounded-l-none border-l-0"
        />
      </div>

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

      <WalletTwoFactorLoginModal
        isVisible={show2faModal}
        userId={tempUserId}
        onSuccess={handleAfter2FA}
        onCancel={handle2faCancel}
      />
    </div>
  )
}
