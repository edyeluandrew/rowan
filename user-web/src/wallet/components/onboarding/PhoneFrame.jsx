import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Battery,
  Bell,
  CheckCircle2,
  KeyRound,
  Lock,
  Shield,
  Signal,
  Smartphone,
  Wallet,
  Wifi,
} from 'lucide-react'

function PhoneStatusBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-2 pb-0.5 text-[9px] text-rowan-text font-sans">
      <span className="font-semibold tabular-nums">9:41</span>
      <div className="flex items-center gap-1 text-rowan-muted">
        <Signal size={10} strokeWidth={2.4} />
        <Wifi size={10} strokeWidth={2.4} />
        <Battery size={11} strokeWidth={2.4} />
      </div>
    </div>
  )
}

function ScreenHome() {
  return (
    <div className="px-2.5 pb-2 pt-0.5 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-serif text-rowan-green text-[13px] leading-none">Rowan</p>
          <p className="text-[8px] text-rowan-muted mt-0.5">Good morning</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-white border border-rowan-border flex items-center justify-center">
          <Bell size={11} className="text-rowan-muted" />
        </div>
      </div>

      <div className="bg-rowan-green rounded-2xl px-2.5 py-2.5 text-white">
        <p className="text-[8px] uppercase tracking-wider text-white/65">Balance</p>
        <p className="font-serif text-[22px] tabular-nums leading-none mt-1">128.40</p>
        <p className="text-[9px] text-white/85 font-semibold mt-1">USDC · ≈ UGX 495k</p>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {[
          { label: 'Receive', Icon: ArrowDownLeft },
          { label: 'Buy', Icon: ArrowDownToLine },
          { label: 'Sell', Icon: ArrowUpFromLine },
          { label: 'Airtime', Icon: Signal },
        ].map(({ label, Icon }) => (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-full bg-white border border-rowan-border flex items-center justify-center">
              <Icon size={13} className="text-rowan-green" />
            </div>
            <span className="text-[7px] font-semibold text-rowan-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto bg-white border border-rowan-border rounded-xl px-2 py-1.5 flex items-center gap-1.5">
        <CheckCircle2 size={11} className="text-rowan-green shrink-0" />
        <p className="text-[8px] text-rowan-text leading-snug">P2P · MTN & Airtel · Escrow</p>
      </div>
    </div>
  )
}

function ScreenTrade() {
  return (
    <div className="px-2.5 pb-2 pt-0.5 flex flex-col gap-2 h-full">
      <p className="font-serif text-rowan-text text-[13px]">Buy USDC</p>
      <div className="flex gap-1">
        <div className="flex-1 bg-rowan-green text-white text-[9px] font-semibold rounded-full py-1 text-center">
          Buy
        </div>
        <div className="flex-1 bg-white border border-rowan-border text-rowan-muted text-[9px] font-semibold rounded-full py-1 text-center">
          Sell
        </div>
      </div>
      {[
        { name: 'MTN Mobile Money', rate: '3,850' },
        { name: 'Airtel Money', rate: '3,842' },
      ].map((row) => (
        <div
          key={row.name}
          className="bg-white border border-rowan-border rounded-xl px-2 py-1.5 flex items-center justify-between"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-rowan-mint flex items-center justify-center">
              <Smartphone size={11} className="text-rowan-green" />
            </div>
            <span className="text-[9px] font-semibold text-rowan-text">{row.name}</span>
          </div>
          <span className="text-[9px] font-bold text-rowan-green tabular-nums">{row.rate}</span>
        </div>
      ))}
      <div className="mt-auto rounded-xl bg-rowan-mint px-2 py-1.5 flex items-center gap-1.5">
        <Shield size={11} className="text-rowan-green shrink-0" />
        <p className="text-[8px] text-rowan-text">Escrow until both sides confirm</p>
      </div>
    </div>
  )
}

function ScreenSecure() {
  return (
    <div className="px-2.5 pb-2 pt-5 flex flex-col items-center text-center h-full">
      <div className="w-12 h-12 rounded-full bg-rowan-mint flex items-center justify-center mb-2">
        <Lock size={22} className="text-rowan-green" />
      </div>
      <p className="font-serif text-rowan-text text-[13px]">Self-custodial</p>
      <p className="text-[8px] text-rowan-muted mt-1 leading-relaxed px-1">
        Keys live on your device. Rowan never holds them.
      </p>
      <div className="mt-3 w-full space-y-1">
        {[
          { t: 'On-device storage', Icon: KeyRound },
          { t: 'Escrow-protected trades', Icon: Shield },
          { t: 'You control recovery', Icon: CheckCircle2 },
        ].map(({ t, Icon }) => (
          <div
            key={t}
            className="flex items-center gap-1.5 bg-white border border-rowan-border rounded-xl px-2 py-1.5 text-left"
          >
            <Icon size={11} className="text-rowan-green shrink-0" />
            <span className="text-[9px] text-rowan-text font-medium">{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenWallet() {
  return (
    <div className="px-2.5 pb-2 pt-5 flex flex-col items-center text-center h-full">
      <div className="w-12 h-12 rounded-full bg-rowan-green flex items-center justify-center mb-2">
        <Wallet size={22} className="text-white" />
      </div>
      <p className="font-serif text-rowan-text text-[13px]">Your wallet</p>
      <p className="text-[8px] text-rowan-muted mt-1 leading-relaxed px-1">
        One Stellar wallet powers buy, sell & airtime.
      </p>
      <div className="mt-4 w-full rounded-2xl bg-rowan-mint border border-rowan-green/20 px-3 py-3 space-y-2">
        <div className="flex items-center gap-2 text-left">
          <CheckCircle2 size={12} className="text-rowan-green" />
          <span className="text-[9px] text-rowan-text">Create in one tap</span>
        </div>
        <div className="flex items-center gap-2 text-left">
          <CheckCircle2 size={12} className="text-rowan-green" />
          <span className="text-[9px] text-rowan-text">Or import a secret key</span>
        </div>
      </div>
    </div>
  )
}

const SCREENS = {
  home: ScreenHome,
  trade: ScreenTrade,
  secure: ScreenSecure,
  wallet: ScreenWallet,
}

const SIZE = {
  sm: { wrap: 'w-[168px]', screen: 'h-[292px]', pad: 'p-[7px]', round: 'rounded-[1.65rem]', inner: 'rounded-[1.25rem]' },
  md: { wrap: 'w-[200px]', screen: 'h-[348px]', pad: 'p-[8px]', round: 'rounded-[1.85rem]', inner: 'rounded-[1.4rem]' },
  lg: { wrap: 'w-[220px]', screen: 'h-[382px]', pad: 'p-[9px]', round: 'rounded-[2rem]', inner: 'rounded-[1.55rem]' },
}

/**
 * Realistic phone chrome + mini Rowan UI (Lucide icons only).
 * @param {'home'|'trade'|'secure'|'wallet'} scene
 * @param {'sm'|'md'|'lg'} size
 */
export default function PhoneFrame({ scene = 'home', size = 'md', className = '' }) {
  const Screen = SCREENS[scene] || ScreenHome
  const s = SIZE[size] || SIZE.md

  return (
    <div className={`mx-auto ${s.wrap} select-none pointer-events-none ${className}`} aria-hidden>
      <div className={`relative ${s.round} bg-[#1a1f1c] ${s.pad} shadow-[0_20px_50px_rgba(11,15,12,0.22)]`}>
        <div className="absolute -left-[2px] top-16 w-[2px] h-6 rounded-l bg-[#2a302c]" />
        <div className="absolute -left-[2px] top-24 w-[2px] h-9 rounded-l bg-[#2a302c]" />
        <div className="absolute -right-[2px] top-20 w-[2px] h-10 rounded-r bg-[#2a302c]" />

        <div className={`relative ${s.inner} overflow-hidden bg-rowan-bg ${s.screen} flex flex-col`}>
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 w-16 h-3.5 rounded-full bg-[#1a1f1c]" />
          <PhoneStatusBar />
          <div className="flex-1 min-h-0 overflow-hidden">
            <Screen />
          </div>
          <div className="flex justify-center pb-1.5 pt-0.5">
            <div className="w-16 h-0.5 rounded-full bg-rowan-text/15" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Caption for carousel scenes (outside the phone). */
export const SCENE_COPY = {
  home: {
    title: 'Your USDC wallet',
    body: 'Hold dollars. Cash out to mobile money when you need local cash.',
  },
  trade: {
    title: 'Buy & sell with MoMo',
    body: 'Match with traders on MTN and Airtel. Rates update live.',
  },
  secure: {
    title: 'Escrow & self-custody',
    body: 'Funds stay locked until both sides confirm. Keys stay on your device.',
  },
  wallet: {
    title: 'Ready when you are',
    body: 'Create a new wallet or bring one you already use on Stellar.',
  },
}
