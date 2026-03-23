import { CURRENT_NETWORK } from '../../utils/constants'

/**
 * Small pill showing "Testnet" or "Mainnet" with appropriate color.
 */
export default function NetworkBadge() {
  const isTest = CURRENT_NETWORK.isTest
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isTest
          ? 'bg-rowan-yellow/20 text-rowan-yellow'
          : 'bg-rowan-green/20 text-rowan-green'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isTest ? 'bg-rowan-yellow' : 'bg-rowan-green'
        }`}
      />
      {isTest ? 'Testnet' : 'Mainnet'}
    </span>
  )
}
