/**
 * Slide 4: paying bills and buying airtime/data straight from the USDC balance.
 */
import { useEffect, useState } from 'react';
import { Zap, Droplets, Wifi, Smartphone, Check, Wallet } from 'lucide-react';

const BILLS = [
  { Icon: Zap, name: 'UMEME', meta: 'Prepaid electricity', fiat: 'UGX 20,000', usdc: '5.30' },
  { Icon: Droplets, name: 'NWSC', meta: 'Water bill', fiat: 'UGX 15,000', usdc: '3.98' },
  { Icon: Wifi, name: 'MTN Data', meta: '5 GB monthly', fiat: 'UGX 12,000', usdc: '3.18' },
  { Icon: Smartphone, name: 'Airtel Airtime', meta: 'Top up', fiat: 'UGX 10,000', usdc: '2.65' },
];

const BALANCES = ['25.00', '19.70', '15.72', '12.54'];

const STAGES = ['browse', 'sheet', 'paying', 'paid'];
const STAGE_MS = { browse: 900, sheet: 1100, paying: 700, paid: 1300 };

export default function BillsVisual() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState('browse');

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = STAGES.indexOf(stage) + 1;
      if (next < STAGES.length) {
        setStage(STAGES[next]);
      } else {
        setStage('browse');
        setIndex((i) => (i + 1) % BILLS.length);
      }
    }, STAGE_MS[stage]);
    return () => window.clearTimeout(id);
  }, [stage, index]);

  const bill = BILLS[index];
  const paid = stage === 'paid';
  const balance = paid ? BALANCES[(index + 1) % BALANCES.length] : BALANCES[index];

  return (
    <div className="ob-stage py-2">
      <div className="relative w-full max-w-[290px] overflow-hidden rounded-3xl bg-rowan-surface border border-rowan-border shadow-sm">
        {/* Balance header */}
        <div className="flex items-center justify-between border-b border-rowan-border px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rowan-muted">
            <Wallet size={13} /> Pay with USDC
          </span>
          <span
            key={balance}
            className="ob-balance is-spent text-sm font-bold text-rowan-text tabular-nums"
          >
            {balance} <span className="text-[11px] font-semibold text-rowan-muted">USDC</span>
          </span>
        </div>

        {/* Biller list */}
        <div className="space-y-1.5 p-2.5">
          {BILLS.map((b, i) => (
            <div
              key={b.name}
              className={`ob-bill-row flex items-center gap-2.5 rounded-2xl border border-rowan-border bg-rowan-bg px-2.5 py-2${
                i === index ? ' is-active' : ''
              }`}
            >
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-xl ${
                  i === index ? 'bg-rowan-green text-white' : 'bg-rowan-mint text-rowan-green'
                }`}
              >
                <b.Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-rowan-text">{b.name}</p>
                <p className="truncate text-[10px] text-rowan-muted">{b.meta}</p>
              </div>
              <span className="flex-none text-[11px] font-semibold text-rowan-muted tabular-nums">
                {b.fiat}
              </span>
            </div>
          ))}
        </div>

        {/* Confirm sheet */}
        <div
          className={`ob-bill-sheet absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-rowan-border bg-rowan-dark px-4 pb-4 pt-3${
            stage === 'browse' ? '' : ' is-open'
          }`}
        >
          <span className="mx-auto mb-3 block h-1 w-9 rounded-full bg-white/25" aria-hidden="true" />

          {paid ? (
            <div className="ob-paid-pop flex flex-col items-center py-1.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rowan-green">
                <Check size={20} className="text-white" strokeWidth={3} />
              </span>
              <p className="mt-2 text-[13px] font-bold text-white">{bill.name} paid</p>
              <p className="text-[11px] text-white/60">{bill.fiat} · {bill.usdc} USDC</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold leading-tight text-white">{bill.name}</p>
                  <p className="text-[11px] text-white/60">{bill.meta}</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold leading-tight text-white tabular-nums">{bill.fiat}</p>
                  <p className="text-[11px] text-rowan-green tabular-nums">{bill.usdc} USDC</p>
                </div>
              </div>
              <div
                className={`mt-3 flex items-center justify-center rounded-xl py-2.5 text-[13px] font-bold transition-transform ${
                  stage === 'paying' ? 'scale-95 bg-rowan-green/70 text-white' : 'bg-rowan-green text-white'
                }`}
              >
                {stage === 'paying' ? 'Paying…' : `Pay ${bill.fiat}`}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
