const LABELS = ['Identity', 'Documents', 'P2P History', 'MoMo', 'Agreement'];

/**
 * StepIndicator — horizontal progress through steps 1-5.
 * Props: currentStep (1-5), totalSteps (5)
 */
export default function StepIndicator({ currentStep, totalSteps = 5 }) {
  return (
    <div className="flex items-start gap-0 px-2 mt-4 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={step} className="flex-1 flex flex-col items-center relative">
            {/* Connecting line before circle */}
            {i > 0 && (
              <div
                className={`absolute top-3 right-1/2 w-full h-px ${
                  step <= currentStep ? 'bg-rowan-green' : 'bg-rowan-border'
                }`}
                style={{ zIndex: 0 }}
              />
            )}

            {/* Circle */}
            <div
              className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isCompleted
                  ? 'bg-rowan-green text-white'
                  : isCurrent
                  ? 'border-2 border-rowan-yellow text-rowan-yellow shadow-[0_0_8px_rgba(240,185,11,0.4)]'
                  : 'border border-rowan-border text-rowan-muted'
              }`}
            >
              {isCompleted ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step
              )}
            </div>

            {/* Label */}
            <span className="text-[10px] text-rowan-muted mt-1.5 text-center leading-tight">
              {LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
