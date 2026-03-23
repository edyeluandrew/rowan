import { useCountdown } from '../../hooks/useCountdown';

export default function CountdownTimer({ endTime, seconds, large = false }) {
  const { timeLeft, isExpired, formattedTime } = useCountdown({ endTime, seconds });

  if (isExpired) {
    return <span className="text-rowan-muted text-xs font-mono">Expired</span>;
  }

  let color = 'text-rowan-text';
  if (timeLeft < 30) color = 'text-rowan-red font-bold';
  else if (timeLeft < 60) color = 'text-rowan-yellow';

  const sizeClass = large ? 'text-2xl' : 'text-sm';

  return (
    <span className={`font-mono tabular-nums ${sizeClass} ${color}`}>
      {formattedTime}
    </span>
  );
}
