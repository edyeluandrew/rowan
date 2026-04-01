/**
 * Route-level Error Boundary HOC
 * Wraps pages with error boundary for isolated error handling
 */

import React from 'react'
import ErrorBoundary from './ErrorBoundary'

export const withErrorBoundary = (Component, fallback = null) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

export default withErrorBoundary
