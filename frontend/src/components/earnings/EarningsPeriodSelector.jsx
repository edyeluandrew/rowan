import { CalendarDays } from 'lucide-react';

const PERIODS = [
  { value: '7d',  label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

/**
 * EarningsPeriodSelector — pill row for period selection.
 * Props: selected, onChange(value)
 */
export default function EarningsPeriodSelector({ selected, onChange }) {
  return (
    <div className="flex gap-2">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={
            selected === p.value
              ? 'flex items-center gap-1.5 bg-rowan-yellow text-rowan-bg font-bold px-4 py-1.5 rounded-full text-sm'
              : 'bg-rowan-surface border border-rowan-border text-rowan-muted px-4 py-1.5 rounded-full text-sm'
          }
        >
          {selected === p.value && <CalendarDays size={13} />}
          {p.label}
        </button>
      ))}
    </div>
  );
}
