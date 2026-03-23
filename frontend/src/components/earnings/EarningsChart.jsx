import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

/**
 * EarningsChart — pure-CSS bar chart for daily earnings.
 * Props: data (array of { date, usdc })
 */
export default function EarningsChart({ data = [] }) {
  const [tooltip, setTooltip] = useState(null);

  if (!data.length) return null;

  const maxVal = Math.max(...data.map((d) => d.usdc || 0), 1);

  const formatDate = (iso) => {
    const d = new Date(iso);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  return (
    <div className="relative">
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const pct = Math.max(((d.usdc || 0) / maxVal) * 100, 2);
          return (
            <div
              key={i}
              className="flex-1 relative group"
              onClick={() => setTooltip(tooltip === i ? null : i)}
            >
              <div
                className="rounded-t bg-rowan-yellow/60 w-full transition-all hover:bg-rowan-yellow"
                style={{ height: `${pct}%` }}
              />
              {tooltip === i && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-rowan-surface border border-rowan-border rounded px-2 py-1 text-xs text-rowan-text whitespace-nowrap z-10">
                  <div className="font-bold tabular-nums">{(d.usdc || 0).toFixed(2)} USDC</div>
                  <div className="text-rowan-muted">{formatDate(d.date)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Date labels — every 7th */}
      <div className="flex items-center mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            {i % 7 === 0 ? (
              <span className="text-rowan-muted text-[9px]">{formatDate(d.date)}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
