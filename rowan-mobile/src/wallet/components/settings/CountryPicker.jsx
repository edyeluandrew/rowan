import { COUNTRY_CODES } from '../../utils/constants'
import { COUNTRY_FIAT, SUPPORTED_COUNTRIES } from '../../utils/country'

/**
 * Country market selector (Uganda / Kenya / Tanzania).
 */
export default function CountryPicker({ value, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {SUPPORTED_COUNTRIES.map((code) => {
        const info = COUNTRY_CODES[code]
        const selected = value === code
        return (
          <button
            key={code}
            type="button"
            disabled={disabled}
            onClick={() => onChange(code)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 min-h-12 transition-colors ${
              selected
                ? 'border-rowan-yellow bg-rowan-yellow/10'
                : 'border-rowan-border bg-rowan-surface'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>{info.flag}</span>
              <div className="text-left">
                <p className={`text-sm font-medium ${selected ? 'text-rowan-yellow' : 'text-rowan-text'}`}>
                  {info.name}
                </p>
                <p className="text-rowan-muted text-xs">
                  {COUNTRY_FIAT[code]} · Mobile money
                </p>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selected ? 'border-rowan-yellow' : 'border-rowan-border'
              }`}
            >
              {selected && <span className="w-2.5 h-2.5 rounded-full bg-rowan-yellow" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
