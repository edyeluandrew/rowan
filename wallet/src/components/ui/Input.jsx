/**
 * Styled text input matching the Rowan design system.
 */
export default function Input({
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
  disabled = false,
  error = false,
  rightElement,
  ...props
}) {
  const borderColor = error
    ? 'border-rowan-red focus:border-rowan-red'
    : 'border-rowan-border focus:border-rowan-yellow'

  return (
    <div className="relative w-full">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`bg-rowan-surface ${borderColor} border text-rowan-text rounded-xl px-4 py-4 w-full text-sm focus:outline-none min-h-11 ${
          disabled ? 'opacity-50' : ''
        } ${rightElement ? 'pr-12' : ''} ${className}`}
        {...props}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  )
}
