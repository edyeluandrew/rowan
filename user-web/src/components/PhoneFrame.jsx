/**
 * Shared handset chrome for the landing visuals:
 * titanium rail, side buttons, thin bezel, screen glare.
 */

export function StatusBar({ light = false }) {
  return (
    <div
      className={`flex items-center justify-between px-3.5 pt-2.5 pb-1 text-[9px] font-semibold tracking-wide ${
        light ? 'text-white/90' : 'text-rowan-text'
      }`}
      aria-hidden="true"
    >
      <span>9:41</span>
      <span className="inline-block w-3.5 h-2 rounded-[2px] border border-current opacity-80 relative">
        <span className="absolute inset-0.5 right-auto w-[70%] bg-current rounded-[1px]" />
      </span>
    </div>
  )
}

export default function PhoneFrame({ children, className = '', dark = false }) {
  return (
    <div className={`relative ${className}`}>
      <span className="receive-demo-btn receive-demo-btn--silent" aria-hidden="true" />
      <span className="receive-demo-btn receive-demo-btn--vol-up" aria-hidden="true" />
      <span className="receive-demo-btn receive-demo-btn--vol-down" aria-hidden="true" />
      <span className="receive-demo-btn receive-demo-btn--power" aria-hidden="true" />

      <div className="receive-demo-rail">
        <div className="receive-demo-bezel">
          <div className={`relative overflow-hidden rounded-[1.15rem] ${dark ? 'bg-[#0f1411]' : 'bg-rowan-bg'}`}>
            <div
              className="absolute top-1.5 left-1/2 z-20 h-[0.85rem] w-[26%] -translate-x-1/2 rounded-full bg-black"
              aria-hidden="true"
            />
            {children}
            <div className="receive-demo-glare" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  )
}
