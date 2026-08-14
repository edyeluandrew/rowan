/**
 * Peer receive demo — advert-style loop on a fixed 12s timeline.
 * QR phone is pushed in from the left, scanner phone flies in, scans,
 * confirms, then shows the sent tick before the stage resets.
 *
 * Motion lives in CSS keyframes (rd-receive-move / rd-scanner-move);
 * screen content is cued off the same timeline and resynced each loop.
 */
import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  ChevronLeft,
  MoreHorizontal,
  Image as ImageIcon,
  Zap,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react'
import PhoneFrame, { StatusBar } from './PhoneFrame'

const DEMO_ADDRESS = 'GAIUDOEXAMPLE7ROWANRECEIVEPEERDEMO4W2A54XXXX'
const DEMO_SHORT = 'GAIU…A54X'
const DEMO_AMOUNT = '25.00'

/** Cues in ms, matched to the keyframe percentages in index.css. */
const SCREEN_CUES = [
  { at: 0, screen: 'camera' },
  { at: 3600, screen: 'aiming' },
  { at: 5300, screen: 'locked' },
  { at: 7200, screen: 'confirm' },
  { at: 8800, screen: 'sent' },
  { at: 11400, screen: 'camera' },
]

function ReceivePhone({ screen }) {
  const received = screen === 'sent'

  return (
    <PhoneFrame className="w-[168px] sm:w-[188px]">
      <div className="relative min-h-[340px] sm:min-h-[380px] flex flex-col">
        <StatusBar />
        <div className="flex items-center justify-between px-3 pt-1 pb-2">
          <div className="w-7 h-7 rounded-full bg-white border border-rowan-border flex items-center justify-center" aria-hidden="true">
            <ChevronLeft size={14} className="text-rowan-text" />
          </div>
          <p className="font-serif text-sm text-rowan-text">Receive</p>
          <div className="w-7 h-7 rounded-full bg-white border border-rowan-border flex items-center justify-center" aria-hidden="true">
            <MoreHorizontal size={14} className="text-rowan-muted" />
          </div>
        </div>

        <div className="px-3 flex-1 flex flex-col items-center">
          <p className="text-[10px] text-rowan-muted font-sans text-center mb-2.5">
            Show this QR to get paid
          </p>
          <div
            className={`bg-white rounded-2xl p-3 shadow-sm border border-rowan-border/70 receive-demo-qr-target ${
              screen === 'locked' ? 'is-hit' : ''
            }`}
          >
            <QRCode value={DEMO_ADDRESS} size={112} bgColor="#FFFFFF" fgColor="#0B0F0C" level="M" />
          </div>
          <p className="mt-2.5 font-mono text-[9px] text-rowan-text bg-rowan-mint rounded-xl px-2.5 py-1.5 max-w-full truncate">
            {DEMO_SHORT}
          </p>
          <div className="mt-3 w-full grid grid-cols-2 gap-1.5 pb-4">
            <div className="rounded-xl bg-white border border-rowan-border py-2 text-center text-[10px] font-medium text-rowan-text">
              Copy
            </div>
            <div className="rounded-xl bg-rowan-green py-2 text-center text-[10px] font-semibold text-white">
              Share
            </div>
          </div>
        </div>

        {received && (
          <div className="absolute inset-x-2 top-9 receive-demo-toast" aria-hidden="true">
            <div className="rounded-2xl bg-white border border-rowan-green/40 shadow-[0_10px_24px_rgba(11,15,12,0.14)] px-3 py-2.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rowan-mint flex items-center justify-center shrink-0">
                <ArrowDownLeft size={14} className="text-rowan-green" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-rowan-text leading-tight">
                  +{DEMO_AMOUNT} USDC
                </p>
                <p className="text-[9px] text-rowan-muted leading-tight">Received</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center pb-2" aria-hidden="true">
          <div className="h-1 w-16 rounded-full bg-rowan-border" />
        </div>
      </div>
    </PhoneFrame>
  )
}

function ScannerPhone({ screen }) {
  const aiming = screen === 'aiming'
  const locked = screen === 'locked'
  const confirm = screen === 'confirm'
  const sent = screen === 'sent'

  let title = 'Scan to pay'
  if (confirm) title = 'Send USDC'
  if (sent) title = 'Sent'

  return (
    <PhoneFrame className="w-[158px] sm:w-[176px]" dark>
      <div className="min-h-[320px] sm:min-h-[350px] flex flex-col text-white">
        <StatusBar light />
        <div className="flex items-center justify-between px-3 pt-1 pb-2">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center" aria-hidden="true">
            <ChevronLeft size={14} className="text-white" />
          </div>
          <p className="text-sm font-medium">{title}</p>
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center" aria-hidden="true">
            {confirm || sent ? (
              <Check size={13} className="text-rowan-green" />
            ) : (
              <Zap size={13} className="text-rowan-lime" />
            )}
          </div>
        </div>

        {sent ? (
          <div className="mx-3 flex-1 rounded-2xl bg-white text-rowan-text flex flex-col items-center justify-center px-3.5 py-6 receive-demo-sent">
            <div className="relative w-14 h-14 mb-3">
              <span className="absolute inset-0 rounded-full bg-rowan-mint receive-demo-tick-ring" />
              <span className="absolute inset-0 rounded-full bg-rowan-green flex items-center justify-center receive-demo-tick">
                <Check size={26} className="text-white" strokeWidth={3} />
              </span>
            </div>
            <p className="font-serif text-lg text-rowan-text">Sent</p>
            <p className="mt-1 text-[11px] text-rowan-muted font-sans text-center">
              {DEMO_AMOUNT} USDC to
            </p>
            <p className="mt-1 font-mono text-[10px] text-rowan-text bg-rowan-mint rounded-lg px-2 py-1">
              {DEMO_SHORT}
            </p>
          </div>
        ) : confirm ? (
          <div className="mx-3 flex-1 rounded-2xl bg-white text-rowan-text flex flex-col px-3.5 py-4 receive-demo-confirm">
            <div className="w-10 h-10 rounded-full bg-rowan-mint flex items-center justify-center mb-3">
              <ArrowUpRight size={18} className="text-rowan-green" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-rowan-muted font-sans">Send</p>
            <p className="font-serif text-2xl text-rowan-text mt-0.5">
              {DEMO_AMOUNT} <span className="text-base text-rowan-muted">USDC</span>
            </p>
            <p className="mt-3 text-[10px] text-rowan-muted font-sans">to</p>
            <p className="mt-1 font-mono text-[11px] bg-rowan-mint rounded-xl px-2.5 py-2 break-all leading-snug">
              {DEMO_SHORT}
            </p>
            <div className="mt-auto pt-4">
              <div className="w-full rounded-xl bg-rowan-green py-2.5 text-center text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(18,184,26,0.28)] receive-demo-cta-press">
                Confirm send
              </div>
            </div>
          </div>
        ) : (
          <div className="relative mx-3 flex-1 rounded-2xl overflow-hidden bg-[#1a2420] min-h-[200px]">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 40%, rgba(18,184,26,0.25), transparent 55%), linear-gradient(180deg, #24302a 0%, #121916 100%)',
              }}
              aria-hidden="true"
            />

            <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div
                className={`bg-white/95 rounded-lg p-1.5 receive-demo-qr-ghost ${locked ? 'is-locked' : ''} ${
                  aiming ? 'is-scanning' : ''
                }`}
              >
                <QRCode value={DEMO_ADDRESS} size={72} bgColor="#FFFFFF" fgColor="#0B0F0C" level="M" />
              </div>
            </div>

            <div className="absolute inset-6 pointer-events-none" aria-hidden="true">
              <span className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-md ${locked ? 'border-rowan-lime' : 'border-rowan-green'}`} />
              <span className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-md ${locked ? 'border-rowan-lime' : 'border-rowan-green'}`} />
              <span className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-md ${locked ? 'border-rowan-lime' : 'border-rowan-green'}`} />
              <span className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-md ${locked ? 'border-rowan-lime' : 'border-rowan-green'}`} />
              {(aiming || locked) && <div className="receive-demo-scanline" />}
            </div>

            <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-white/80 font-sans">
              {locked ? 'QR detected…' : 'Align QR in the frame'}
            </p>
          </div>
        )}

        {!confirm && !sent && (
          <div className="flex items-center justify-center gap-6 py-3 px-4">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center" aria-hidden="true">
              <ImageIcon size={15} className="text-white/80" />
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-white/80 flex items-center justify-center" aria-hidden="true">
              <div className="w-9 h-9 rounded-full bg-white/20" />
            </div>
            <div className="w-9 h-9 rounded-full bg-rowan-green/90 flex items-center justify-center text-[10px] font-bold" aria-hidden="true">
              USDC
            </div>
          </div>
        )}

        <div className="flex justify-center pb-2 pt-2" aria-hidden="true">
          <div className="h-1 w-16 rounded-full bg-white/25" />
        </div>
      </div>
    </PhoneFrame>
  )
}

export default function ReceivePeerVisual({ className = '' }) {
  const [screen, setScreen] = useState('camera')
  const clockRef = useRef(null)

  useEffect(() => {
    let timers = []

    const schedule = () => {
      timers.forEach(window.clearTimeout)
      timers = SCREEN_CUES.map((cue) =>
        window.setTimeout(() => setScreen(cue.screen), cue.at),
      )
    }

    schedule()

    // Keep screen cues locked to the CSS loop, however long it has been running.
    const node = clockRef.current
    node?.addEventListener('animationiteration', schedule)

    return () => {
      timers.forEach(window.clearTimeout)
      node?.removeEventListener('animationiteration', schedule)
    }
  }, [])

  return (
    <div
      className={`receive-demo ${className}`}
      role="img"
      aria-label="Demo: a phone showing a Rowan receive QR slides in, a second phone scans it, then confirms and sends USDC."
    >
      <div className="receive-demo-stage">
        <div ref={clockRef} className="receive-demo-phone receive-demo-phone--receive">
          <ReceivePhone screen={screen} />
        </div>
        <div className="receive-demo-phone receive-demo-phone--scanner">
          <ScannerPhone screen={screen} />
        </div>
      </div>
    </div>
  )
}
