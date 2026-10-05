/**
 * Hero map. One continent, one pin. The pin is the only motion.
 * Countries are drawn inline so the viewBox does not become a picture plate.
 */
import { useEffect, useState } from 'react'
import africaRaw from '../assets/africa-countries.svg?raw'

/** Fitted mercator center of Uganda in public/africa-countries.svg (viewBox 200×220). */
const UG = { x: 136.54, y: 110.63 }

const AFRICA_MARKUP = africaRaw
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')

function AfricaMap() {
  return <g dangerouslySetInnerHTML={{ __html: AFRICA_MARKUP }} />
}

function UgandaPin({ reduceMotion }) {
  return (
    <g aria-hidden="true">
      <circle
        cx={UG.x}
        cy={UG.y}
        r="7"
        fill="none"
        stroke="#F6465D"
        strokeWidth="0.55"
        className="landing-story-pin-ring"
      />
      <ellipse
        cx={UG.x}
        cy={UG.y + 1.4}
        rx="3.6"
        ry="1.15"
        fill="#000000"
        className="landing-story-pin-shadow"
      />
      <g transform={`translate(${UG.x} ${UG.y})`}>
        <g>
          {!reduceMotion && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -4.2; 0 0"
              keyTimes="0; 0.42; 1"
              dur="2.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0 0.2 1; 0.4 0 0.55 1"
            />
          )}
          <path
            d="M0 0 C-1.5 -4.4 -5.4 -7.2 -5.4 -11.6 A5.4 5.4 0 1 1 5.4 -11.6 C5.4 -7.2 1.5 -4.4 0 0 Z"
            fill="#F6465D"
          />
          <ellipse cx="0" cy="-13.4" rx="2.3" ry="1.15" fill="#FFFFFF" opacity="0.28" />
          <circle cx="0" cy="-11.6" r="2.05" fill="#FFFFFF" />
        </g>
      </g>
    </g>
  )
}

export default function LandingStoryVisual({ className = '' }) {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  return (
    <figure className={`landing-story ${className}`}>
      <div className="landing-story-stage">
        <svg viewBox="4 16 192 190" className="block h-full w-full overflow-visible bg-transparent" aria-hidden="true">
          <AfricaMap />
          <UgandaPin reduceMotion={reduceMotion} />
        </svg>
      </div>
      <figcaption className="landing-story-place">Kampala, Uganda</figcaption>
    </figure>
  )
}
