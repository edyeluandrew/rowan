/**
 * Slide 1: USDC arriving into Uganda from around the world, drawn on a real
 * map of Africa with glittering inflow trails.
 */

/** Fitted mercator centre of Uganda in public/africa-countries.svg (viewBox 200x220). */
const UG = { x: 136.54, y: 110.63 };

const FLOWS = [
  { id: 'a', d: `M22 28 L${UG.x - 4} ${UG.y - 2}`, coin: [22, 28], delay: '0s' },
  { id: 'b', d: `M186 22 L${UG.x + 6} ${UG.y - 4}`, coin: [186, 22], delay: '0.45s' },
  { id: 'c', d: `M18 198 L${UG.x - 6} ${UG.y + 6}`, coin: [18, 198], delay: '0.9s' },
  { id: 'd', d: `M188 188 L${UG.x + 5} ${UG.y + 8}`, coin: [188, 188], delay: '1.25s' },
];

export default function MapInflowVisual() {
  return (
    <div className="ob-stage">
      <div className="landing-story-stage">
        <svg viewBox="0 0 200 220" className="w-full h-full block overflow-visible" aria-hidden="true">
          <defs>
            <filter id="ob-glitter-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ob-coin-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <image
            href="/africa-countries.svg"
            xlinkHref="/africa-countries.svg"
            x="0"
            y="0"
            width="200"
            height="220"
            preserveAspectRatio="xMidYMid meet"
          />

          <circle
            cx={UG.x}
            cy={UG.y}
            r="12"
            fill="none"
            stroke="#F0B90B"
            strokeWidth="1.5"
            className="landing-story-pulse-ring"
          />
          <circle
            cx={UG.x}
            cy={UG.y}
            r="20"
            fill="none"
            stroke="#F0B90B"
            strokeWidth="1"
            className="landing-story-pulse-ring-delayed"
          />

          {FLOWS.map((flow) => (
            <g key={flow.id}>
              <path
                d={flow.d}
                fill="none"
                stroke="#F0B90B"
                strokeWidth="1.2"
                strokeOpacity="0.22"
                strokeLinecap="round"
              />
              <path
                d={flow.d}
                fill="none"
                stroke="#F0B90B"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray="3 7"
                className="landing-story-glitter-line"
                style={{ animationDelay: flow.delay }}
                filter="url(#ob-glitter-glow)"
              />

              <circle r="2.4" fill="#F0B90B" filter="url(#ob-glitter-glow)">
                <animateMotion dur="2.4s" repeatCount="indefinite" begin={flow.delay} path={flow.d} />
              </circle>
              <circle r="1.4" fill="#fff" opacity="0.95">
                <animateMotion dur="2.4s" repeatCount="indefinite" begin={flow.delay} path={flow.d} />
              </circle>
              <circle r="2" fill="#F0B90B" opacity="0.7" filter="url(#ob-glitter-glow)">
                <animateMotion
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${parseFloat(flow.delay) + 0.7}s`}
                  path={flow.d}
                />
              </circle>

              <g className={`landing-story-coin landing-story-coin-${flow.id}`} filter="url(#ob-coin-glow)">
                <circle cx={flow.coin[0]} cy={flow.coin[1]} r="9" fill="#000000" stroke="#F0B90B" strokeWidth="1.4" />
                <text
                  x={flow.coin[0]}
                  y={flow.coin[1] + 3}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill="#000000"
                  fontFamily="system-ui,sans-serif"
                >
                  $
                </text>
              </g>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
