/**
 * Suspense fallback for async components
 */

import React from 'react'

export const SuspenseFallback = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-rowan-border border-t-rowan-yellow rounded-full animate-spin mx-auto mb-2" />
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
)

export const withSuspense = (Component, fallback = <SuspenseFallback />) => {
  return (props) => (
    <React.Suspense fallback={fallback}>
      <Component {...props} />
    </React.Suspense>
  )
}

export default SuspenseFallback
