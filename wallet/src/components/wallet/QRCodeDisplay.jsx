import QRCode from 'react-qr-code'
import { formatAddress } from '../../utils/format'
import { QR_BG_HEX, QR_FG_HEX } from '../../utils/constants'

/**
 * QR code display with label and truncated value.
 * White background required for readability on dark theme.
 */
export default function QRCodeDisplay({ value, size = 180, label }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-4 rounded-2xl">
        <QRCode
          value={value}
          size={size}
          bgColor={QR_BG_HEX}
          fgColor={QR_FG_HEX}
          level="M"
        />
      </div>
      {label && (
        <p className="text-rowan-muted text-xs text-center">{label}</p>
      )}
      <p className="text-rowan-text font-mono text-xs break-all text-center">
        {formatAddress(value)}
      </p>
    </div>
  )
}
