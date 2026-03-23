import { X } from 'lucide-react'

export default function DateRangePicker({ from, to, onFromChange, onToChange, onClear }) {
  return (
    <div className="flex items-center gap-2">
      <div>
        <label className="text-rowan-muted text-xs block mb-1">From</label>
        <input
          type="date"
          value={from || ''}
          onChange={(e) => onFromChange(e.target.value)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow"
        />
      </div>
      <div>
        <label className="text-rowan-muted text-xs block mb-1">To</label>
        <input
          type="date"
          value={to || ''}
          onChange={(e) => onToChange(e.target.value)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow"
        />
      </div>
      {(from || to) && (
        <button onClick={onClear} className="text-rowan-muted hover:text-rowan-text mt-5 p-1">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
