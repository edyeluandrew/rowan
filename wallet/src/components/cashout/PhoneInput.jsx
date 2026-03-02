import { Hash } from 'lucide-react'
import { NETWORKS, COUNTRY_CODES } from '../../utils/constants'

/**
 * Phone number input with auto-selected country code based on network.
 */
export default function PhoneInput({ phone, onPhoneChange, network }) {
  const networkInfo = NETWORKS[network]
  const countryCode = networkInfo
    ? COUNTRY_CODES[networkInfo.country]?.code || '+256'
    : '+256'

  const handleChange = (e) => {
    const val = e.target.value.replace(/[^\d]/g, '')
    onPhoneChange(val)
  }

  const fullNumber = phone ? `${countryCode}${phone}` : ''
  const masked = phone && phone.length >= 4
    ? `${countryCode} ${phone.slice(0, 1)}XX XXX ${phone.slice(-3)}`
    : ''

  return (
    <div>
      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">
        Mobile money number
      </p>
      <div className="flex">
        <div className="bg-rowan-surface border border-rowan-border rounded-l-xl px-3 py-4 text-rowan-text text-sm w-20 flex items-center justify-center">
          {countryCode}
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

      {masked && (
        <div className="flex items-center gap-1 mt-2">
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
