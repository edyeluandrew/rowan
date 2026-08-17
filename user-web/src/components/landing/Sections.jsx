/**
 * Public landing sections: rails strip, how it works, features,
 * bills, security, coverage, FAQ and footer.
 */
import {
  ArrowLeftRight,
  Bell,
  Check,
  Clock,
  Fingerprint,
  Gauge,
  KeyRound,
  Landmark,
  MessageSquare,
  Receipt,
  ScanLine,
  Shield,
  Smartphone,
  Wallet,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Reveal from './Reveal'
import RowanLogo from '../RowanLogo'
import ReceivePeerVisual from '../ReceivePeerVisual'
import BillsPayVisual from '../BillsPayVisual'

function SectionHeading({ eyebrow, title, blurb, id }) {
  return (
    <Reveal className="max-w-2xl">
      {eyebrow && (
        <p className="text-[11px] uppercase tracking-[0.18em] text-rowan-green font-semibold font-sans">
          {eyebrow}
        </p>
      )}
      <h2 id={id} className="mt-2 font-serif text-2xl sm:text-3xl lg:text-[2.1rem] text-rowan-text leading-snug">
        {title}
      </h2>
      {blurb && (
        <p className="mt-3 text-sm sm:text-base text-rowan-muted font-sans leading-relaxed">{blurb}</p>
      )}
    </Reveal>
  )
}

/* —————————————————————————— rails strip —————————————————————————— */

const RAILS = [
  'Stellar USDC',
  'MTN Mobile Money',
  'Airtel Money',
  'UMEME Yaka',
  'NWSC Water',
  'MTN Data',
  'Airtel Airtime',
  'Escrow protected',
]

export function RailsStrip() {
  return (
    <section aria-label="Supported rails" className="border-y border-rowan-border/70 bg-white/60 py-3.5">
      <div className="rails-marquee">
        <ul className="rails-track" aria-hidden="true">
          {[...RAILS, ...RAILS].map((rail, i) => (
            <li key={`${rail}-${i}`} className="flex items-center gap-2.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rowan-green" />
              <span className="text-xs sm:text-sm font-sans text-rowan-muted whitespace-nowrap">{rail}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only">{RAILS.join(', ')}</p>
    </section>
  )
}

/* —————————————————————————— how it works —————————————————————————— */

const STEPS = [
  {
    n: '01',
    Icon: Wallet,
    title: 'Create your wallet',
    body: 'A Stellar wallet in about a minute. Your keys are generated on your device and never uploaded.',
  },
  {
    n: '02',
    Icon: ScanLine,
    title: 'Get paid in USDC',
    body: 'Share your QR or address. Anyone, anywhere, can send you digital dollars in seconds.',
  },
  {
    n: '03',
    Icon: Smartphone,
    title: 'Spend it locally',
    body: 'Cash out to MTN or Airtel, or pay UMEME, water, data and airtime straight from your balance.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20 lg:py-24" aria-labelledby="how-heading">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From digital dollars to money you can spend"
          blurb="Three steps. No exchange account, no WhatsApp middlemen, no waiting on a bank."
        />

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <ol className="space-y-4 list-none p-0 m-0">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.n} delay={i * 90}>
                <div className="flex gap-4 rounded-2xl border border-rowan-border bg-white p-5 shadow-[0_10px_30px_rgba(11,15,12,0.05)] transition hover:shadow-[0_16px_40px_rgba(18,184,26,0.12)] hover:border-rowan-green/40">
                  <div className="shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-rowan-mint flex items-center justify-center">
                      <step.Icon size={19} className="text-rowan-green" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-center text-[10px] font-mono text-rowan-muted">{step.n}</p>
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-rowan-text">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-rowan-muted font-sans leading-relaxed">{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal className="flex justify-center lg:justify-end" delay={120}>
            <ReceivePeerVisual />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* —————————————————————————— features —————————————————————————— */

const FEATURES = [
  {
    Icon: Wallet,
    title: 'USDC wallet',
    body: 'Hold dollars that keep their value, on fast and low-fee Stellar rails.',
  },
  {
    Icon: ArrowLeftRight,
    title: 'Buy and sell',
    body: 'Trade with verified traders at a rate that is locked when your order opens.',
  },
  {
    Icon: Shield,
    title: 'Escrow on every trade',
    body: 'Funds are held until both sides confirm. Disputes are reviewed with real evidence.',
  },
  {
    Icon: Smartphone,
    title: 'Mobile money payouts',
    body: 'Cash out to MTN or Airtel and get the money on the number you already use.',
  },
  {
    Icon: Receipt,
    title: 'Bills and top-ups',
    body: 'UMEME Yaka, NWSC water, data bundles and airtime, paid from your balance.',
  },
  {
    Icon: Bell,
    title: 'Rate alerts',
    body: 'Set a target rate and get notified the moment the market reaches it.',
  },
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-16 sm:py-20 lg:py-24" aria-labelledby="features-heading">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Everything in one wallet"
          blurb="Built for people who earn in dollars and live on shillings."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <article className="h-full rounded-2xl border border-rowan-border bg-white p-5 transition hover:-translate-y-1 hover:border-rowan-green/40 hover:shadow-[0_18px_40px_rgba(18,184,26,0.12)]">
                <div className="w-10 h-10 rounded-xl bg-rowan-mint flex items-center justify-center mb-3.5">
                  <f.Icon size={18} className="text-rowan-green" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-lg text-rowan-text">{f.title}</h3>
                <p className="mt-1.5 text-sm text-rowan-muted font-sans leading-relaxed">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* —————————————————————————— bills —————————————————————————— */

const BILL_ITEMS = [
  { Icon: Zap, label: 'UMEME Yaka', note: 'Prepaid electricity tokens' },
  { Icon: Landmark, label: 'NWSC water', note: 'National Water bills' },
  { Icon: Gauge, label: 'Data bundles', note: 'MTN and Airtel' },
  { Icon: Smartphone, label: 'Airtime', note: 'Any Ugandan number' },
]

export function BillsSection() {
  return (
    <section
      id="bills"
      className="scroll-mt-24 py-16 sm:py-20 lg:py-24 bg-white/70 border-y border-rowan-border/70"
      aria-labelledby="bills-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal className="flex justify-center lg:justify-start order-2 lg:order-1">
            <BillsPayVisual />
          </Reveal>

          <div className="order-1 lg:order-2">
            <SectionHeading
              id="bills-heading"
              eyebrow="Pay bills"
              title="Your dollars, spent on real life"
              blurb="No cash-out step first. Pay the bill directly from your USDC balance and get the token or confirmation in the app."
            />

            <ul className="mt-8 space-y-3 list-none p-0 m-0">
              {BILL_ITEMS.map((item, i) => (
                <Reveal as="li" key={item.label} delay={i * 80}>
                  <div className="flex items-center gap-3 rounded-2xl border border-rowan-border bg-white px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-rowan-mint flex items-center justify-center shrink-0">
                      <item.Icon size={16} className="text-rowan-green" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-rowan-text font-sans leading-tight">{item.label}</p>
                      <p className="text-xs text-rowan-muted font-sans leading-tight mt-0.5">{item.note}</p>
                    </div>
                    <Check size={16} className="text-rowan-green ml-auto shrink-0" aria-hidden="true" />
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* —————————————————————————— security —————————————————————————— */

const SECURITY = [
  {
    Icon: KeyRound,
    title: 'Your keys, your wallet',
    body: 'Keys are created and stored on your device. Rowan cannot move your funds.',
  },
  {
    Icon: Shield,
    title: 'Escrow by default',
    body: 'Every trade locks funds until both sides confirm, so nobody can disappear mid-deal.',
  },
  {
    Icon: Fingerprint,
    title: 'Two-factor and biometrics',
    body: 'Add an authenticator app and device biometrics before anything leaves your wallet.',
  },
  {
    Icon: MessageSquare,
    title: 'Disputes with evidence',
    body: 'Upload proof in-app. Orders are reviewed against the actual payment trail.',
  },
]

export function Security() {
  return (
    <section id="security" className="scroll-mt-24 py-16 sm:py-20 lg:py-24" aria-labelledby="security-heading">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          id="security-heading"
          eyebrow="Security"
          title="Built so you never have to trust a stranger"
          blurb="The protection is in the product, not in a promise."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SECURITY.map((s, i) => (
            <Reveal key={s.title} delay={(i % 2) * 90}>
              <article className="h-full rounded-2xl border border-rowan-border bg-white p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-rowan-mint flex items-center justify-center shrink-0">
                  <s.Icon size={18} className="text-rowan-green" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-rowan-text">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-rowan-muted font-sans leading-relaxed">{s.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* —————————————————————————— coverage —————————————————————————— */

const CORRIDORS = [
  { flag: '🇺🇬', country: 'Uganda', rails: 'MTN · Airtel · UMEME · NWSC', status: 'Live' },
  { flag: '🇰🇪', country: 'Kenya', rails: 'M-Pesa', status: 'Next' },
  { flag: '🇹🇿', country: 'Tanzania', rails: 'MTN · Airtel', status: 'Planned' },
]

export function Coverage() {
  return (
    <section
      className="py-16 sm:py-20 lg:py-24 bg-white/70 border-y border-rowan-border/70"
      aria-labelledby="coverage-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          id="coverage-heading"
          eyebrow="Coverage"
          title="Starting in Uganda, built for the region"
          blurb="We go deep on one corridor at a time so payouts actually land, then expand."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {CORRIDORS.map((c, i) => (
            <Reveal key={c.country} delay={i * 90}>
              <article className="h-full rounded-2xl border border-rowan-border bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xl" aria-hidden="true">{c.flag}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full ${
                      c.status === 'Live'
                        ? 'bg-rowan-mint text-rowan-green-dark'
                        : 'bg-rowan-bg text-rowan-muted border border-rowan-border'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <h3 className="mt-3 font-serif text-lg text-rowan-text">{c.country}</h3>
                <p className="mt-1 text-sm text-rowan-muted font-sans">{c.rails}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* —————————————————————————— faq —————————————————————————— */

const FAQS = [
  {
    q: 'Do I need to know anything about crypto?',
    a: 'No. Rowan works like a normal money app. USDC is simply a digital dollar; the blockchain part stays out of your way.',
  },
  {
    q: 'How fast is a cash-out to mobile money?',
    a: 'A local trader sends mobile money to your number. Most payouts land in a few minutes once they confirm. Confirm in the app only after the money arrives — your USDC stays in escrow until then.',
  },
  {
    q: 'What does it cost?',
    a: 'Buy and sell show one all-in quote before you confirm. Airtime and data are typically face value. Yaka and bills include a partner fulfilment fee plus a small Rowan service fee, both shown before you pay.',
  },
  {
    q: 'What happens if a trade goes wrong?',
    a: 'Open a dispute in the app and upload your proof of payment. Escrow holds the funds until the case is reviewed.',
  },
  {
    q: 'Can I pay UMEME and water bills directly?',
    a: 'Yes. Pay UMEME Yaka, NWSC water, data bundles and airtime straight from your USDC balance, with the token or receipt shown in-app.',
  },
  {
    q: 'Who controls my wallet?',
    a: 'You do. Keys are generated on your device and never leave it, so nobody at Rowan can move your money.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 py-16 sm:py-20 lg:py-24" aria-labelledby="faq-heading">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 lg:px-12">
        <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions people actually ask" />

        <div className="mt-8 divide-y divide-rowan-border/70 rounded-2xl border border-rowan-border bg-white">
          {FAQS.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
                <span className="font-sans text-sm sm:text-base font-medium text-rowan-text">{item.q}</span>
                <span
                  className="shrink-0 w-6 h-6 rounded-full border border-rowan-border flex items-center justify-center text-rowan-muted transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="mt-2.5 text-sm text-rowan-muted font-sans leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/** FAQ structured data so the answers can surface in search. */
export function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

/* —————————————————————————— footer —————————————————————————— */

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-rowan-border/70 bg-white/70 pt-12 pb-8 safe-bottom">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <RowanLogo size={38} />
            <p className="mt-3 max-w-sm text-sm text-rowan-muted font-sans leading-relaxed">
              Hold USDC, buy and sell with local traders, and pay airtime, data and bills in one wallet.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-rowan-muted font-sans">
              <Clock size={13} className="text-rowan-green" aria-hidden="true" />
              Live in Uganda · more corridors coming
            </p>
          </div>

          <div>
            <h2 className="text-xs uppercase tracking-[0.14em] text-rowan-text font-semibold font-sans">Product</h2>
            <ul className="mt-3 space-y-2 list-none p-0 m-0">
              <li><a href="#how-it-works" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">How it works</a></li>
              <li><a href="#features" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">Features</a></li>
              <li><a href="#bills" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">Pay bills</a></li>
              <li><a href="#security" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">Security</a></li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs uppercase tracking-[0.14em] text-rowan-text font-semibold font-sans">Legal & support</h2>
            <ul className="mt-3 space-y-2 list-none p-0 m-0">
              <li>
                <Link to="/legal/terms" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">
                  Privacy Policy
                </Link>
              </li>
              <li><a href="#faq" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">FAQ</a></li>
              <li>
                <a href="mailto:support@rowanpay.app" className="text-sm text-rowan-muted hover:text-rowan-text font-sans">
                  support@rowanpay.app
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-rowan-border/70 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-rowan-muted font-sans">© {year} Rowan. All rights reserved.</p>
          <p className="text-xs text-rowan-muted font-sans">Keys stay on your device · never uploaded</p>
        </div>
      </div>
    </footer>
  )
}
