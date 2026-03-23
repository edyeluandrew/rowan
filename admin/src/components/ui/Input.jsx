export default function Input({
  label,
  error,
  className = '',
  ...props
}) {
  return (
    <div className={className}>
      {label && <label className="text-rowan-muted text-xs mb-1.5 block">{label}</label>}
      <input
        className={`w-full bg-rowan-surface border ${error ? 'border-rowan-red' : 'border-rowan-border'} text-rowan-text rounded-xl px-3 py-2.5 text-sm placeholder:text-rowan-muted focus:outline-none focus:border-rowan-yellow transition-colors`}
        {...props}
      />
      {error && <p className="text-rowan-red text-xs mt-1">{error}</p>}
    </div>
  )
}
