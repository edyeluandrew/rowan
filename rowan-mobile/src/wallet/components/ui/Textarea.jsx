/**
 * Styled textarea matching the Rowan design system.
 */
export default function Textarea({
  value,
  onChange,
  placeholder = '',
  rows = 4,
  className = '',
  disabled = false,
  error = false,
  ...props
}) {
  const borderColor = error
    ? 'border-rowan-red focus:border-rowan-red'
    : 'border-rowan-border focus:border-rowan-yellow'

  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`w-full bg-rowan-surface ${borderColor} border text-rowan-text rounded-xl px-4 py-3 text-sm placeholder:text-rowan-muted focus:outline-none resize-none ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
      {...props}
    />
  )
}
