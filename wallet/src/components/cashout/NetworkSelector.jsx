import { Signal, Radio, Landmark, Smartphone } from 'lucide-react'
import { NETWORKS } from '../../utils/constants'

const NETWORK_ICONS = {
  MTN_MOMO_UG: Signal,
  AIRTEL_UG: Radio,
  MPESA_KE: Landmark,
  VODACOM_TZ: Smartphone,
  TIGO_TZ: Smartphone,
}

/**
 * Grid of mobile money network cards for selection.
 */
export default function NetworkSelector({ selected, onSelect }) {
  return (
    <div>
      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3">
        Select mobile money network
      </p>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(NETWORKS).map(([key, network]) => {
          const Icon = NETWORK_ICONS[key] || Smartphone
          const isSelected = selected === key
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex flex-col items-center gap-2 rounded-xl p-4 border min-h-11 transition-colors ${
                isSelected
                  ? 'border-rowan-yellow bg-rowan-yellow/5'
                  : 'border-rowan-border bg-rowan-surface'
              }`}
            >
              <Icon size={24} className={isSelected ? 'text-rowan-yellow' : network.color} />
              <span className="text-rowan-text text-sm font-medium">{network.label}</span>
              <span className="text-rowan-muted text-xs">{network.country}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
