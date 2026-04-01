/**
 * Standardized Table Component Pattern
 * Provides consistent table rendering, pagination, sorting, filtering
 */

import React, { useState, useCallback } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export const Table = React.forwardRef(({ columns, data, loading, error, pagination, onPageChange, onSort, defaultSortBy, rowActions }, ref) => {
  const [sortBy, setSortBy] = useState(defaultSortBy || columns[0]?.key)
  const [sortOrder, setSortOrder] = useState('asc')

  const handleSort = useCallback((key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
    if (onSort) onSort(key, sortOrder === 'asc' ? 'desc' : 'asc')
  }, [sortBy, sortOrder, onSort])

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
  }

  if (loading) {
    return <div className="p-4 text-center text-rowan-muted">Loading...</div>
  }

  if (!data || data.length === 0) {
    return <div className="p-4 text-center text-rowan-muted">No data available</div>
  }

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <table className="w-full">
        <thead className="bg-rowan-surface border-b border-rowan-border">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 text-left text-sm font-semibold text-rowan-text cursor-pointer hover:bg-rowan-bg transition-colors"
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-2">
                  {col.label}
                  {col.sortable && sortBy === col.key && (
                    sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  )}
                  {col.sortable && sortBy !== col.key && <ChevronsUpDown size={14} className="text-gray-300" />}
                </div>
              </th>
            ))}
            {rowActions && <th className="px-4 py-2 w-12">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.id || idx} className="border-b border-rowan-border hover:bg-rowan-surface/50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-sm text-rowan-text">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
              {rowActions && (
                <td className="px-4 py-2 text-sm">
                  <div className="flex gap-2">{rowActions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2 p-4">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1 rounded ${
                p === pagination.page
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

Table.displayName = 'Table'
export default Table
