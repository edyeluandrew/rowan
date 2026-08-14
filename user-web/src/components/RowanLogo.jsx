/** Rowan gold leaf mark with optional wordmark. */
export default function RowanLogo({
  size = 34,
  withWordmark = true,
  wordmarkClassName = 'font-serif text-2xl text-rowan-green tracking-tight leading-none',
  className = '',
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/rowan-mark.png"
        alt=""
        width={Math.round(size * 0.68)}
        height={size}
        decoding="async"
        className="rowan-logo-mark"
        style={{ height: size, width: 'auto' }}
      />
      {withWordmark && <span className={wordmarkClassName}>Rowan</span>}
    </span>
  )
}
