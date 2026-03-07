export default function TrustScore({ score = 0 }) {
  let label, labelColor;
  if (score >= 90)      { label = 'Excellent'; labelColor = 'text-rowan-green'; }
  else if (score >= 75) { label = 'Good';      labelColor = 'text-rowan-yellow'; }
  else if (score >= 60) { label = 'Fair';      labelColor = 'text-rowan-muted'; }
  else                  { label = 'At Risk';   labelColor = 'text-rowan-red'; }

  return (
    <div className="w-full">
      {/* Track */}
      <div className="bg-rowan-border h-2 rounded-full w-full">
        <div
          className="bg-rowan-yellow h-2 rounded-full transition-all"
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-rowan-text font-bold text-2xl tabular-nums">{score}</span>
        <span className={`text-xs ${labelColor}`}>{label}</span>
      </div>
    </div>
  );
}
