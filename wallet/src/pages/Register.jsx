import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { maskPhoneNumber } from '../utils/crypto'
import { COUNTRY_CODES } from '../utils/constants'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const countries = Object.entries(COUNTRY_CODES)

export default function Register() {
  const navigate = useNavigate()
  const { registerWithWallet, loginWithWallet } = useAuth()
  const [countryCode, setCountryCode] = useState('+256')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const fullPhone = `${countryCode}${phone}`
  const masked = phone.length >= 4 ? maskPhoneNumber(fullPhone) : ''

  const handleRegister = async () => {
    if (!phone || phone.length < 7) return
    setLoading(true)
    setError(null)
    try {
      await registerWithWallet(fullPhone)
      navigate('/home', { replace: true })
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
      await loginWithWallet()
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
    </div>
  )
}
