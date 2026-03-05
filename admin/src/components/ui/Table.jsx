/**
 * Reusable data table with standard admin styling.
 */
export default function Table({ columns, data, onRowClick, emptyMessage = 'No data found' }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-8 text-center">
        <p className="text-rowan-muted text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-rowan-bg border-b border-rowan-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-rowan-muted text-xs uppercase tracking-wider px-4 py-3 text-left font-medium ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={row.id || idx}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-rowan-border last:border-b-0 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-rowan-border/20' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${col.cellClassName || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
