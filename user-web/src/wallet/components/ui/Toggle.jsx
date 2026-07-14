/**
 * Styled toggle switch — controlled by parent (no optimistic flip).
 */
export default function Toggle({ enabled, onChange, disabled = false }) {
  const handleToggle = async () => {
    if (disabled) return
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {
      /* haptics not available on web */
    }
    onChange?.(!enabled)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={handleToggle}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
        enabled ? 'bg-rowan-yellow' : 'bg-rowan-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left] duration-200 ${
          enabled ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
