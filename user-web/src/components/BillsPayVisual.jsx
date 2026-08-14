/**
 * Bills demo — spending the received USDC.
 * Loops: pick a bill → pay sheet slides up → pay → paid tick → next bill.
 * Balance ticks down so it reads as one continuous wallet.
 */
import { useEffect, useState } from 'react'
import { Zap, Droplets, Wifi, Smartphone, Check, ChevronLeft, Wallet } from 'lucide-react'
import PhoneFrame, { StatusBar } from './PhoneFrame'

const BILLS = [
  { id: 'umeme', name: 'UMEME', sub: 'Yaka prepaid', Icon: Zap, amount: 'UGX 20,000', usdc: '5.30' },
  { id: 'nwsc', name: 'NWSC', sub: 'Water bill', Icon: Droplets, amount: 'UGX 15,000', usdc: '3.98' },
  { id: 'data', name: 'MTN Data', sub: '5 GB bundle', Icon: Wifi, amount: 'UGX 12,000', usdc: '3.18' },
  { id: 'airtime', name: 'Airtel Airtime', sub: '0700 000 000', Icon: Smartphone, amount: 'UGX 5,000', usdc: '1.33' },
]

/** Wallet balance shown before each payment lands. */
const BALANCES = ['25.00', '19.70', '15.72', '12.54']

const STAGES = ['browse', 'sheet', 'paying', 'paid']
const STAGE_MS = { browse: 1000, sheet: 1200, paying: 800, paid: 1500 }

export default function BillsPayVisual({ className = '' }) {
  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState('browse')

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = STAGES.indexOf(stage) + 1
      if (next < STAGES.length) {
        setStage(STAGES[next])
      } else {
        setStage('browse')
        setIndex((i) => (i + 1) % BILLS.length)
      }
    }, STAGE_MS[stage])
    return () => window.clearTimeout(id)
  }, [stage, index])

  const bill = BILLS[index]
  const sheetOpen = stage !== 'browse'
  const paid = stage === 'paid'
  const balance = paid
    ? BALANCES[(index + 1) % BALANCES.length]
    : BALANCES[index]

  return (
    <div
      className={`bills-demo ${className}`}
      role="img"
      aria-label="Demo: paying UMEME, water, data and airtime bills straight from a USDC balance in the Rowan wallet."
    >
      <PhoneFrame className="bills-demo-phone w-[172px] sm:w-[196px]">
        <div className="relative min-h-[352px] sm:min-h-[392px] flex flex-col">
          <StatusBar />

          <div className="flex items-center justify-between px-3 pt-1 pb-2">
            <div className="w-7 h-7 rounded-full bg-white border border-rowan-border flex items-center justify-center" aria-hidden="true">
              <ChevronLeft size={14} className="text-rowan-text" />
            </div>
            <p className="font-serif text-sm text-rowan-text">Pay bills</p>
            <div className="w-7 h-7" aria-hidden="true" />
          </div>

          {/* Balance */}
          <div className="mx-3 rounded-2xl bg-rowan-mint px-3 py-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
              <Wallet size={13} className="text-rowan-green" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.12em] text-rowan-muted font-sans leading-tight">
                Balance
              </p>
              <p key={balance} className="text-[12px] font-semibold text-rowan-text leading-tight bills-demo-balance">
                {balance} USDC
              </p>
            </div>
          </div>

          {/* Bill list */}
          <div className="px-3 pt-3 pb-4 space-y-1.5">
            {BILLS.map((b, i) => {
              const active = i === index
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all duration-500 ${
                    active
                      ? 'border-rowan-green bg-white shadow-[0_6px_16px_rgba(18,184,26,0.16)] scale-[1.03]'
                      : 'border-rowan-border bg-white/70 opacity-60'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-rowan-mint' : 'bg-rowan-bg'
                    }`}
                    aria-hidden="true"
                  >
                    <b.Icon size={14} className={active ? 'text-rowan-green' : 'text-rowan-muted'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-rowan-text leading-tight truncate">{b.name}</p>
                    <p className="text-[9px] text-rowan-muted leading-tight truncate">{b.sub}</p>
                  </div>
                  <p className="text-[9px] font-medium text-rowan-muted shrink-0">{b.amount}</p>
                </div>
              )
            })}
          </div>

          <div className="flex justify-center pb-2 mt-auto" aria-hidden="true">
            <div className="h-1 w-16 rounded-full bg-rowan-border" />
          </div>

          {/* Pay sheet */}
          <div
            className={`bills-demo-sheet ${sheetOpen ? 'is-open' : ''}`}
            aria-hidden="true"
          >
            <div className="h-1 w-9 rounded-full bg-rowan-border mx-auto mb-3" />

            {paid ? (
              <div className="flex flex-col items-center py-2">
                <div className="relative w-12 h-12 mb-2">
                  <span className="absolute inset-0 rounded-full bg-rowan-mint bills-demo-tick-ring" />
                  <span className="absolute inset-0 rounded-full bg-rowan-green flex items-center justify-center bills-demo-tick">
                    <Check size={22} className="text-white" strokeWidth={3} />
                  </span>
                </div>
                <p className="font-serif text-base text-rowan-text">Paid</p>
                <p className="text-[10px] text-rowan-muted font-sans mt-0.5 text-center">
                  {bill.name} · {bill.amount}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-rowan-mint flex items-center justify-center shrink-0">
                    <bill.Icon size={15} className="text-rowan-green" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-rowan-text leading-tight">{bill.name}</p>
                    <p className="text-[9px] text-rowan-muted leading-tight">{bill.sub}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-rowan-bg px-2.5 py-2 mb-1.5 flex items-baseline justify-between">
                  <span className="text-[9px] text-rowan-muted">Amount</span>
                  <span className="text-[12px] font-semibold text-rowan-text">{bill.amount}</span>
                </div>
                <div className="rounded-xl bg-rowan-bg px-2.5 py-2 mb-3 flex items-baseline justify-between">
                  <span className="text-[9px] text-rowan-muted">You pay</span>
                  <span className="text-[12px] font-semibold text-rowan-green">{bill.usdc} USDC</span>
                </div>

                <div
                  className={`w-full rounded-xl bg-rowan-green py-2.5 text-center text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(18,184,26,0.28)] ${
                    stage === 'paying' ? 'bills-demo-press' : ''
                  }`}
                >
                  {stage === 'paying' ? 'Paying…' : 'Pay with USDC'}
                </div>
              </>
            )}
          </div>
        </div>
      </PhoneFrame>
    </div>
  )
}
