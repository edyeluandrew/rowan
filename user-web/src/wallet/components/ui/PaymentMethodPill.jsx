import { NETWORKS } from '../../utils/constants'
import { NetworkBrand } from '../../../components/brands/NetworkLogo'

export default function PaymentMethodPill({ network, className = '' }) {
  const config = NETWORKS[network]
  if (!config) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-rowan-surface border border-rowan-border text-rowan-text ${className}`}
    >
      <NetworkBrand network={network} size={14} />
      {config.label}
    </span>
  )
}
