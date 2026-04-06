import { ACTION_TYPE_OPTIONS, ENTITY_TYPE_OPTIONS } from '../utils/constants'

export default function AuditLogFilters({ filters, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="text-rowan-muted text-xs block mb-1">Action Type</label>
        <select
          value={filters.action || ''}
          onChange={(e) => update('action', e.target.value || undefined)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow"
        >
          <option value="">All Actions</option>
          {ACTION_TYPE_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-rowan-muted text-xs block mb-1">Entity Type</label>
        <select
          value={filters.entity_type || ''}
          onChange={(e) => update('entity_type', e.target.value || undefined)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow"
        >
          <option value="">All Entities</option>
          {ENTITY_TYPE_OPTIONS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-rowan-muted text-xs block mb-1">From Date</label>
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => update('date_from', e.target.value || undefined)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow"
        />
      </div>

      <div>
        <label className="text-rowan-muted text-xs block mb-1">Search</label>
        <input
          type="text"
          placeholder="Admin email or entity ID..."
          value={filters.search || ''}
          onChange={(e) => update('search', e.target.value || undefined)}
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow w-48"
        />
      </div>
    </div>
  )
}
