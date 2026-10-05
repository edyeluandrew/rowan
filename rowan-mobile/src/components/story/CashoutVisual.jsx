/**
 * Slide 2: USDC balance flowing down into MTN and Airtel mobile money.
 */
import { ArrowDown } from 'lucide-react';

function Chip({ label, sub, tone, delayed }) {
  return (
    <div
      className={`ob-cash-chip${delayed ? ' ob-cash-chip--b' : ''} flex-1 rounded-2xl bg-rowan-surface border border-rowan-border px-3 py-3 text-center`}
    >
      <span
        className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {label}
      </span>
      <p className="mt-2 text-[13px] font-bold text-rowan-text tabular-nums">{sub}</p>
    </div>
  );
}

export default function CashoutVisual() {
  return (
    <div className="ob-stage py-2">
      <div className="relative w-full max-w-[290px]">
        {/* USDC source */}
        <div className="rounded-2xl bg-rowan-surface border border-rowan-border px-4 py-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-rowan-muted">USDC balance</p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-none text-rowan-text tabular-nums">25.00</span>
            <span className="text-xs font-semibold text-rowan-muted">USDC</span>
          </div>
        </div>

        {/* Rail */}
        <div className="relative mx-auto h-16 w-px">
          <div
            className="ob-cash-rail absolute inset-0 border-l-2 border-dashed border-rowan-green"
            aria-hidden="true"
          />
          <div
            className="ob-cash-drop absolute left-1/2 top-0 -translate-x-1/2"
            aria-hidden="true"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rowan-green text-xs font-bold text-white shadow-[0_4px_14px_rgba(240,185,11,0.4)]">
              $
            </span>
          </div>
          <ArrowDown
            size={16}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-rowan-green"
            aria-hidden="true"
          />
        </div>

        {/* Mobile money destinations */}
        <div className="flex gap-3">
          <Chip label="MTN MoMo" sub="UGX 92,400" tone={{ bg: '#F0B90B', fg: '#181A20' }} />
          <Chip label="Airtel" sub="UGX 92,400" tone={{ bg: '#F6465D', fg: '#FFFFFF' }} delayed />
        </div>

        <p className="mt-3 text-center text-[11px] font-medium text-rowan-muted">
          Escrow-protected · settles in minutes
        </p>
      </div>
    </div>
  );
}
