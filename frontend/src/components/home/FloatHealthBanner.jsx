import { AlertTriangle, AlertOctagon, PlusCircle } from 'lucide-react';
import { CURRENCY_FLAGS } from '../../utils/constants';

/**
 * FloatHealthBanner — shows warning/critical float levels on Home screen.
 * Props: floatHealth (object from GET /api/v1/trader/float/health)
 * Only renders when at least one currency is WARNING or CRITICAL.
 */
export default function FloatHealthBanner({ floatHealth, onTopUp }) {
  if (!floatHealth) return null;

  const currencies = Object.entries(floatHealth).filter(
    ([, v]) => v && typeof v === 'object' && (v.status === 'WARNING' || v.status === 'CRITICAL'),
  );

  if (currencies.length === 0) return null;

  return (
    <div>
      {currencies.map(([currency, info]) => {
        const isCritical = info.status === 'CRITICAL';
        return (
          <div
            key={currency}
            className={
              isCritical
                ? 'bg-rowan-red/15 border border-rowan-red rounded-xl p-4 mb-4'
                : 'bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4'
            }
          >
            <div className="flex items-start gap-3">
              {isCritical ? (
                <AlertOctagon size={22} className="text-rowan-red flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={22} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`${isCritical ? 'text-rowan-red' : 'text-rowan-yellow'} font-bold text-sm`}>
                  {isCritical ? 'Float Critically Low' : 'Float Running Low'}
                </p>
                <p className="text-rowan-muted text-xs mt-1">
                  {isCritical
                    ? `You may be skipped in trader matching. Top up your ${CURRENCY_FLAGS[currency] || ''} ${currency} float immediately.`
                    : `Your ${CURRENCY_FLAGS[currency] || ''} ${currency} float is below the recommended level.`}
                </p>
                <button
                  onClick={() => onTopUp?.(currency)}
                  className={`flex items-center gap-1.5 mt-2 text-xs px-3 py-1.5 rounded-lg border ${
                    isCritical
                      ? 'border-rowan-red text-rowan-red'
                      : 'border-rowan-yellow text-rowan-yellow'
                  }`}
                >
                  <PlusCircle size={13} />
                  {isCritical ? 'Top Up Now' : 'Update Float'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
