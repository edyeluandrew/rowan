import { FILTER_STATUSES, FILTER_NETWORKS } from '../../utils/constants'
import DateRangePicker from '../ui/DateRangePicker'

export default function TransactionFilters({ filters, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="text-rowan-muted text-xs block mb-1">Status</label>
        <select
          value={filters.state || ''}
          onChange={(e) => update('state', e.target.value || undefined)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow"
        >
          {FILTER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-rowan-muted text-xs block mb-1">Network</label>
        <select
          value={filters.network || ''}
          onChange={(e) => update('network', e.target.value || undefined)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow"
        >
          {FILTER_NETWORKS.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </div>

      <DateRangePicker
        from={filters.from}
        to={filters.to}
        onFromChange={(v) => update('from', v || undefined)}
        onToChange={(v) => update('to', v || undefined)}
        onClear={() => onChange({ ...filters, from: undefined, to: undefined })}
      />

      <div>
        <label className="text-rowan-muted text-xs block mb-1">Search</label>
        <input
          type="text"
          placeholder="TX ID, wallet, phone..."
          value={filters.search || ''}
          onChange={(e) => update('search', e.target.value || undefined)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow w-48"
        />
      </div>
    </div>
  )
}
