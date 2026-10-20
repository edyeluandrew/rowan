/**
 * Slide 1: Africa, with a single pin on Uganda.
 * Matches the website hero. No dashed inflow routes.
 */

/** Fitted mercator centre of Uganda in public/africa-countries.svg (viewBox 200x220). */
const UG = { x: 136.54, y: 110.63 };

export default function MapInflowVisual() {
  return (
    <div className="ob-stage">
      <figure className="landing-story">
        <div className="landing-story-stage">
          <svg viewBox="4 16 192 190" className="w-full h-full block overflow-visible" aria-hidden="true">
            <image
              href="/africa-countries.svg"
              xlinkHref="/africa-countries.svg"
              x="0"
              y="0"
              width="200"
              height="220"
              preserveAspectRatio="xMidYMid meet"
            />
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
                  <path
                    d="M0 0 C-1.5 -4.4 -5.4 -7.2 -5.4 -11.6 A5.4 5.4 0 1 1 5.4 -11.6 C5.4 -7.2 1.5 -4.4 0 0 Z"
                    fill="#F6465D"
                  />
                  <ellipse cx="0" cy="-13.4" rx="2.3" ry="1.15" fill="#FFFFFF" opacity="0.28" />
                  <circle cx="0" cy="-11.6" r="2.05" fill="#FFFFFF" />
                </g>
              </g>
            </g>
          </svg>
        </div>
        <figcaption className="landing-story-place">Kampala, Uganda</figcaption>
      </figure>
    </div>
  );
}
