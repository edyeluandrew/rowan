/**
 * Official MTN and Airtel favicons.
 * MTN artwork is the mtn.com favicon, drawn in their dark-mode yellow.
 * Airtel artwork is the airtel.co.ug favicon.
 */

export function MtnMark({ size = 32 }) {
  return (
    <img
      src="/mtn.svg"
      width={Math.round(size * 1.8)}
      height={size}
      alt=""
      className="shrink-0 object-contain"
    />
  )
}

export function AirtelMark({ size = 32 }) {
  return (
    <img
      src="/airtel.svg"
      width={size}
      height={size}
      alt=""
      className="shrink-0 object-contain"
    />
  )
}

/** Logo for an MTN or Airtel network key. Null for other rails. */
export function NetworkBrand({ network, size = 32 }) {
  const key = String(network || '').toUpperCase()
  if (key.includes('MTN')) return <MtnMark size={size} />
  if (key.includes('AIRTEL')) return <AirtelMark size={size} />
  return null
}
