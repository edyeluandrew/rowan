/**
 * DateRangePicker component
 */
import React, { useState } from 'react'

export const DateRangePicker = React.forwardRef(({ onChange }, ref) => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleStartChange = (e) => {
    setStartDate(e.target.value)
    onChange?.({start: e.target.value, end: endDate})
  }

  const handleEndChange = (e) => {
    setEndDate(e.target.value)
    onChange?.({start: startDate, end: e.target.value})
  }

  return (
    <div ref={ref} className="flex gap-2">
      <input
        type="date"
        value={startDate}
        onChange={handleStartChange}
        className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="date"
        value={endDate}
        onChange={handleEndChange}
        className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
})

DateRangePicker.displayName = 'DateRangePicker'
export default DateRangePicker
