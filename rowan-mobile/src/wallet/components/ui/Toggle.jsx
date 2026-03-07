/**
 * Styled toggle switch with haptic feedback.
 */
export default function Toggle({ enabled, onChange, disabled = false }) {
  const handleToggle = async () => {
    if (disabled) return
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {
      /* haptics not available on web — silent fail */
    }
    onChange(!enabled)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={handleToggle}
      className={`w-12 h-7 rounded-full transition-colors cursor-pointer relative ${
        enabled ? 'bg-rowan-yellow' : 'bg-rowan-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
