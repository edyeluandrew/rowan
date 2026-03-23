/**
 * A single row in a receipt card — label on the left, value on the right.
 */
export default function ReceiptRow({ label, value, mono = false, accent = false }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-rowan-border last:border-b-0">
      <span className="text-rowan-muted text-xs shrink-0 mr-4">{label}</span>
      <span
        className={`text-right text-xs break-all ${
          accent ? 'text-rowan-green font-semibold' : 'text-rowan-text'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value || '—'}
      </span>
    </div>
  )
}
