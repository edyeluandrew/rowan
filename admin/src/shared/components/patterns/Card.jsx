/**
 * Standardized Card Component Pattern
 * Provides consistent card styling and layout
 */

import React from 'react'

export const Card = ({ children, className = '', ...props }) => (
  <div
    className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow ${className}`}
    {...props}
  >
    {children}
  </div>
)

export const CardHeader = ({ children, className = '' }) => (
  <div className={`px-4 py-3 border-b border-rowan-border ${className}`}>{children}</div>
)

export const CardBody = ({ children, className = '' }) => (
  <div className={`px-4 py-4 ${className}`}>{children}</div>
)

export const CardFooter = ({ children, className = '' }) => (
  <div className={`px-4 py-3 border-t border-rowan-border flex justify-end gap-2 ${className}`}>{children}</div>
)

export default Card
