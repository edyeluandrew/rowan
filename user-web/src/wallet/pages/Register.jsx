import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSecure } from '../../shared/utils/storage'
import { getDialCodeForCountry } from '../utils/country'
import { persistUserCountry } from '../hooks/useUserCountry'
import CountryPicker from '../components/settings/CountryPicker'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import OnboardingShell from '../components/layout/OnboardingShell'
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
    <OnboardingShell
      step={3}
      stepTotal={3}
      title="Almost done"
      subtitle="Country and phone so balances and cash-out use the right mobile money network."
    >
      <p className="text-xs font-medium text-rowan-muted uppercase tracking-wider mb-2 font-sans">
        Country
      </p>
      <CountryPicker value={country} onChange={setCountry} disabled={loading} />

      <p className="text-xs font-medium text-rowan-muted uppercase tracking-wider mt-5 mb-2 font-sans">
        Phone number
      </p>
      <div className="flex">
        <div className="bg-rowan-bg border border-rowan-border rounded-l-2xl px-3 py-3.5 text-rowan-muted text-sm w-[4.25rem] flex items-center justify-center shrink-0 font-semibold font-sans">
          {countryCode}
        </div>
        <Input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="7XXXXXXXX"
          className="rounded-l-none border-l-0 rounded-r-2xl"
        />
      </div>

      {error && <p className="text-rowan-red text-sm mt-4 font-sans">{error}</p>}

      <p className="mt-5 text-xs text-rowan-muted font-sans leading-relaxed">
        By finishing setup you agree to the{' '}
        <Link to="/legal/terms" className="text-rowan-green underline">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/legal/privacy" className="text-rowan-green underline">Privacy Policy</Link>.
      </p>

      <div className="mt-7">
        <Button onClick={handleRegister} loading={loading} disabled={phone.length < 7}>
          Finish setup
        </Button>
      </div>

      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className="text-rowan-green text-sm underline text-center mt-4 min-h-11 w-full font-sans"
      >
        Already have an account?
      </button>

      <WalletTwoFactorLoginModal
        isVisible={show2faModal}
        userId={tempUserId}
        onSuccess={handleAfter2FA}
        onCancel={handle2faCancel}
      />
    </OnboardingShell>
  )
}
