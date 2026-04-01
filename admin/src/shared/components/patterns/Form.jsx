/**
 * Standardized Form Component Pattern
 * Provides consistent form validation, error handling, submission
 */

import React from 'react'

export const Form = ({ onSubmit, children, error, success }) => {
  return (
    <form onSubmit={onSubmit} className="max-w-lg mx-auto space-y-4">
      {error && <div className="p-3 bg-rowan-red/10 border border-rowan-red/30 rounded text-rowan-red text-sm">{error}</div>}
      {success && <div className="p-3 bg-rowan-green/10 border border-rowan-green/30 rounded text-rowan-green text-sm">{success}</div>}
      <div className="space-y-4">{children}</div>
    </form>
  )
}

export const FormField = ({ label, error, required, children }) => (
  <div className="space-y-1">
    {label && (
      <label className="block text-sm font-medium text-rowan-text">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {error && <p className="text-xs text-rowan-red">{error}</p>}
  </div>
)

export const FormInput = React.forwardRef(({ type = 'text', error, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={`w-full px-3 py-2 border rounded ${
      error ? 'border-red-400 bg-red-50' : 'border-gray-300'
    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
    {...props}
  />
))
FormInput.displayName = 'FormInput'

export const FormSelect = React.forwardRef(({ error, ...props }, ref) => (
  <select
    ref={ref}
    className={`w-full px-3 py-2 border rounded ${
      error ? 'border-red-400 bg-red-50' : 'border-gray-300'
    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
    {...props}
  />
))
FormSelect.displayName = 'FormSelect'

export const FormTextarea = React.forwardRef(({ error, ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full px-3 py-2 border rounded ${
      error ? 'border-red-400 bg-red-50' : 'border-gray-300'
    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
    {...props}
  />
))
FormTextarea.displayName = 'FormTextarea'

export const FormCheckbox = React.forwardRef(({ label, ...props }, ref) => (
  <label className="flex items-center gap-2">
    <input ref={ref} type="checkbox" className="rounded border-gray-300 cursor-pointer" {...props} />
    <span className="text-sm">{label}</span>
  </label>
))
FormCheckbox.displayName = 'FormCheckbox'
