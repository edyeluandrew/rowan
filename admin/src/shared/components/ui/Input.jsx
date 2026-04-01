/**
 * Input component
 */
import React from 'react'

export const Input = React.forwardRef(({ error, ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-3 py-2 border rounded ${
      error ? 'border-red-400 bg-red-50' : 'border-gray-300'
    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
    {...props}
  />
))

Input.displayName = 'Input'
export default Input
