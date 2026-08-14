/**
 * Silent landing visual: bare Africa map + glittering USDC inflow indicators.
 * Cycles: arrive → cash out → airtime/data → bills.
 */
import { useEffect, useState } from 'react'

const SCENE_MS = 4200
const SCENE_COUNT = 4

/** Fitted mercator center of Uganda in public/africa-countries.svg (viewBox 200×220). */
const UG = { x: 136.54, y: 110.63 }

const FLOWS = [
  { id: 'a', d: `M22 28 L${UG.x - 4} ${UG.y - 2}`, coin: [22, 28], delay: '0s' },
  { id: 'b', d: `M186 22 L${UG.x + 6} ${UG.y - 4}`, coin: [186, 22], delay: '0.45s' },
  { id: 'c', d: `M18 198 L${UG.x - 6} ${UG.y + 6}`, coin: [18, 198], delay: '0.9s' },
  { id: 'd', d: `M188 188 L${UG.x + 5} ${UG.y + 8}`, coin: [188, 188], delay: '1.25s' },
]

function AfricaMap({ highlight = true, opacity = 1 }) {
  return (
    <g opacity={opacity}>
      <image
        href="/africa-countries.svg"
        xlinkHref="/africa-countries.svg"
        x="0"
        y="0"
        width="200"
        height="220"
        preserveAspectRatio="xMidYMid meet"
      />
      {highlight && (
        <g className="landing-story-uganda">
          <circle cx={UG.x} cy={UG.y} r="12" fill="none" stroke="#12B81A" strokeWidth="1.5" className="landing-story-pulse-ring" />
          <circle cx={UG.x} cy={UG.y} r="20" fill="none" stroke="#12B81A" strokeWidth="1" className="landing-story-pulse-ring-delayed" />
        </g>
      )}
    </g>
  )
}

function GlitterFlows() {
  return (
    <g className="landing-story-arrows" aria-hidden="true">
      <defs>
        <filter id="landing-glitter-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="landing-coin-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {FLOWS.map((flow) => (
        <g key={flow.id}>
          {/* Soft trail */}
          <path
            d={flow.d}
            fill="none"
            stroke="#12B81A"
            strokeWidth="1.2"
            strokeOpacity="0.22"
            strokeLinecap="round"
          />
          {/* Glittering dashed indicator line */}
          <path
            d={flow.d}
            fill="none"
            stroke="#12B81A"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="3 7"
            className="landing-story-glitter-line"
            style={{ animationDelay: flow.delay }}
            filter="url(#landing-glitter-glow)"
          />
          {/* Traveling spark dots */}
          <circle r="2.2" fill="#DDEB3A" filter="url(#landing-glitter-glow)" className="landing-story-spark">
            <animateMotion dur="2.4s" repeatCount="indefinite" begin={flow.delay} path={flow.d} />
          </circle>
          <circle r="1.4" fill="#fff" opacity="0.95" className="landing-story-spark">
            <animateMotion dur="2.4s" repeatCount="indefinite" begin={flow.delay} path={flow.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
          </circle>
          <circle r="2" fill="#12B81A" opacity="0.7" filter="url(#landing-glitter-glow)">
            <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${parseFloat(flow.delay) + 0.7}s`} path={flow.d} />
          </circle>

          {/* Origin indicator coin */}
          <g className={`landing-story-coin landing-story-coin-${flow.id}`} filter="url(#landing-coin-glow)">
            <circle cx={flow.coin[0]} cy={flow.coin[1]} r="9" fill="#fff" stroke="#12B81A" strokeWidth="1.4" />
            <text
              x={flow.coin[0]}
              y={flow.coin[1] + 3}
              textAnchor="middle"
              fontSize="7"
              fontWeight="700"
              fill="#087A12"
              fontFamily="system-ui,sans-serif"
            >
              $
            </text>
          </g>
        </g>
      ))}
    </g>
  )
}

function SceneArrive() {
  return (
    <g>
      <AfricaMap />
      <GlitterFlows />
    </g>
  )
}

function SceneCashout() {
  return (
    <g>
      <AfricaMap highlight={false} opacity={0.34} />
      <circle cx="100" cy="72" r="20" fill="#fff" stroke="#12B81A" strokeWidth="2" filter="url(#landing-coin-glow)" />
      <text x="100" y="77" textAnchor="middle" fontSize="13" fontWeight="700" fill="#087A12" fontFamily="system-ui,sans-serif">$</text>
      <path d="M100 100 L100 130" stroke="#12B81A" strokeWidth="2.2" strokeLinecap="round" className="landing-story-flow-down" />
      <path d="M93 122 L100 134 L107 122" fill="none" stroke="#12B81A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="landing-story-flow-down" />
      <g className="landing-story-rise">
        <rect x="40" y="150" width="50" height="26" rx="13" fill="#FFD51F" />
        <text x="65" y="167" textAnchor="middle" fontSize="8" fontWeight="700" fill="#0B0F0C" fontFamily="system-ui,sans-serif">MTN</text>
        <rect x="110" y="150" width="50" height="26" rx="13" fill="#E53935" />
        <text x="135" y="167" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="system-ui,sans-serif">Airtel</text>
      </g>
    </g>
  )
}

function SceneSpend() {
  return (
    <g>
      <AfricaMap highlight={false} opacity={0.22} />
      <rect x="40" y="48" width="120" height="130" rx="16" fill="#fff" stroke="#D8E0D9" strokeWidth="1.4" />
      <circle cx="100" cy="82" r="18" fill="#EAF8EE" />
      <path
        d="M100 71c-6 0-11 4.5-11 11 0 8 11 18 11 18s11-10 11-18c0-6.5-5-11-11-11z"
        fill="#12B81A"
        className="landing-story-signal"
      />
      <circle cx="100" cy="80" r="3" fill="#fff" />
      <g className="landing-story-bars">
        <rect x="60" y="120" width="12" height="26" rx="3" fill="#12B81A" opacity="0.35" className="landing-story-bar-1" />
        <rect x="78" y="110" width="12" height="36" rx="3" fill="#12B81A" opacity="0.55" className="landing-story-bar-2" />
        <rect x="96" y="100" width="12" height="46" rx="3" fill="#12B81A" opacity="0.75" className="landing-story-bar-3" />
        <rect x="114" y="90" width="12" height="56" rx="3" fill="#12B81A" className="landing-story-bar-4" />
      </g>
      <circle cx="142" cy="62" r="12" fill="#fff" stroke="#12B81A" strokeWidth="1.4" className="landing-story-coin" />
      <text x="142" y="66" textAnchor="middle" fontSize="8" fontWeight="700" fill="#087A12" fontFamily="system-ui,sans-serif">$</text>
    </g>
  )
}

function SceneBills() {
  return (
    <g>
      <AfricaMap highlight={false} opacity={0.22} />
      <rect x="40" y="48" width="120" height="130" rx="16" fill="#fff" stroke="#D8E0D9" strokeWidth="1.4" />
      <g className="landing-story-bill landing-story-bill-a">
        <rect x="54" y="64" width="92" height="36" rx="11" fill="#EAF8EE" />
        <path d="M86 72 L77 84 H88 L81 92 L98 78 H88 L93 72 Z" fill="#12B81A" />
        <circle cx="126" cy="82" r="7" fill="#fff" stroke="#12B81A" strokeWidth="1.1" />
        <text x="126" y="85" textAnchor="middle" fontSize="6" fontWeight="700" fill="#087A12" fontFamily="system-ui,sans-serif">$</text>
      </g>
      <g className="landing-story-bill landing-story-bill-b">
        <rect x="54" y="114" width="92" height="36" rx="11" fill="#EAF8EE" />
        <rect x="70" y="122" width="26" height="18" rx="3" fill="#12B81A" opacity="0.85" />
        <rect x="76" y="126" width="14" height="9" rx="1" fill="#EAF8EE" />
        <circle cx="126" cy="132" r="7" fill="#fff" stroke="#12B81A" strokeWidth="1.1" />
        <text x="126" y="135" textAnchor="middle" fontSize="6" fontWeight="700" fill="#087A12" fontFamily="system-ui,sans-serif">$</text>
      </g>
    </g>
  )
}

const SCENES = [SceneArrive, SceneCashout, SceneSpend, SceneBills]

export default function LandingStoryVisual({ className = '' }) {
  const [scene, setScene] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    if (reduceMotion) return undefined
    const id = window.setInterval(() => {
      setScene((s) => (s + 1) % SCENE_COUNT)
    }, SCENE_MS)
    return () => window.clearInterval(id)
  }, [reduceMotion])

  const Scene = SCENES[scene]

  return (
    <div
      className={`landing-story ${className}`}
      role="img"
      aria-label="USDC arrives in Uganda on a map of Africa, then cash out to mobile money, buy airtime and data, or pay bills in the Rowan wallet."
    >
      <div className="landing-story-stage">
        <svg viewBox="0 0 200 220" className="w-full h-full block overflow-visible" aria-hidden="true">
          {/* Shared glow defs for all scenes */}
          <defs>
            <filter id="landing-coin-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g key={scene} className="landing-story-scene is-active">
            <Scene />
          </g>
        </svg>
      </div>

      <div className="landing-story-dots" aria-hidden="true">
        {Array.from({ length: SCENE_COUNT }, (_, i) => (
          <span key={i} className={`landing-story-dot${i === scene ? ' is-active' : ''}`} />
        ))}
      </div>
    </div>
  )
}
