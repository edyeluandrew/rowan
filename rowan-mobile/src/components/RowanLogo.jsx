/** Rowan gold leaf mark with optional wordmark. */
export default function RowanLogo({ size = 30, withWordmark = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/rowan-mark.png"
        alt=""
        width={Math.round(size * 0.68)}
        height={size}
        decoding="async"
        className="rowan-logo-mark"
        style={{ height: size, width: 'auto' }}
      />
      {withWordmark && (
        <span className="text-rowan-green text-xl font-bold tracking-tight leading-none">Rowan</span>
      )}
    </span>
  );
}
