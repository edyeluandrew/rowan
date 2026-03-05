import { Hash } from 'lucide-react'
import { NETWORKS, COUNTRY_CODES } from '../../utils/constants'

/**
 * Phone number input with auto-selected country code + flag based on network.
 */
export default function PhoneInput({ phone, onPhoneChange, network }) {
  const networkInfo = NETWORKS[network]
  const countryKey = networkInfo?.country || 'UG'
  const country = COUNTRY_CODES[countryKey] || COUNTRY_CODES.UG
  const countryCode = country.code
  const flag = country.flag

  const handleChange = (e) => {
    const val = e.target.value.replace(/[^\d]/g, '')
    onPhoneChange(val)
  }

  const masked = phone && phone.length >= 4
    ? `${countryCode} ${phone.slice(0, 1)}XX XXX ${phone.slice(-3)}`
    : ''

  return (
    <div>
      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">
        Mobile money number
      </p>
      <div className="flex">
        <div className="bg-rowan-surface border border-rowan-border rounded-l-xl px-3 py-4 text-rowan-text text-sm w-24 flex items-center justify-center gap-1.5">
          <span className="text-base">{flag}</span>
          <span>{countryCode}</span>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={handleChange}
          placeholder="7XXXXXXXX"
          className="bg-rowan-surface border border-rowan-border border-l-0 rounded-r-xl px-4 py-4 text-rowan-text text-sm flex-1 focus:outline-none focus:border-rowan-yellow min-h-11"
        />
      </div>

      {network && (
        <p className="text-rowan-muted text-xs mt-2">
          {flag} {country.name} ({countryCode})
        </p>
      )}

      {masked && (
        <div className="flex items-center gap-1 mt-1">
          <Hash size={13} className="text-rowan-muted" />
          <span className="text-rowan-muted text-xs">
            Your phone: {masked} → SHA-256 → sent to server
          </span>
        </div>
      )}

      <p className="text-rowan-muted text-xs mt-1">
        Number is hashed for privacy — we never store it in plaintext
      </p>
    </div>
  )
}
