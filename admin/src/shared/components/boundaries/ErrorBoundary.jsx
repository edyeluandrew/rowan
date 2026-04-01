/**
 * Error Boundary Component
 * Catches React component errors and displays fallback UI
 */

import React from 'react'
import { AlertTriangle } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      let isDev = false
      try {
        isDev = import.meta !== undefined
      } catch {
        // eslint-disable-next-line no-empty
      }
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Something went wrong</h3>
              <p className="text-rowan-red text-sm mt-1">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              {isDev && (
                <details className="mt-2 text-xs text-rowan-red">
                  <summary className="cursor-pointer">Details</summary>
                  <pre className="mt-1 overflow-auto bg-red-100 p-2 rounded">
                    {this.state.error?.toString()}
                  </pre>
                </details>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-3 py-1 bg-rowan-red text-rowan-text rounded text-sm hover:bg-rowan-red/80 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
