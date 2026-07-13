import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  Mail,
  Info,
  Shield,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Clock,
  HelpCircle,
  Copy,
  CopyCheck,
  History,
  Store,
  Bell,
  Fingerprint,
  Lock,
  ExternalLink,
  KeyRound,
} from 'lucide-react'
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, whatsappSupportUrl, mailtoSupportUrl } from '../utils/support'
import { CURRENT_NETWORK, NETWORKS, COUNTRY_CODES, COPY_FEEDBACK_TIMEOUT_MS } from '../utils/constants'
import { getNetworksForCountry } from '../utils/country'
import { formatShortId } from '../utils/p2pFormat'
import useActiveTransaction from '../hooks/useActiveTransaction'
import useTransactions from '../hooks/useTransactions'
import useUserCountry from '../hooks/useUserCountry'
import useWallet from '../hooks/useWallet'

const FAQ_ITEMS = [
  {
    q: 'I sent the wrong USDC amount',
    a: 'If it does not match the quote (beyond a tiny tolerance), Rowan should refund the deposit. Wait for the refund path to finish, or contact support with your order ID — do not send again.',
  },
  {
    q: 'My quote expired',
    a: 'Quotes are time-limited. Depositing after expiry usually triggers a refund. Start a new cash-out for a fresh quote and memo.',
  },
  {
    q: 'Where is my mobile money?',
    a: 'Partners send MoMo manually. Estimates are typical, not guarantees. If the trader marked payout sent but you do not see funds, open a dispute — do not confirm receipt.',
  },
  {
    q: 'I confirmed too early',
    a: 'Confirmation releases escrow to the trader. If you have not received MoMo, contact support immediately with your order ID and any screenshots.',
  },
  {
    q: 'What is a USDC trustline?',
    a: 'Your Stellar wallet needs a USDC trustline to hold Circle USDC. Enable it from Home or Profile if the app asks — without it you cannot receive buy-order USDC.',
  },
  {
    q: 'Is this real money?',
    a: CURRENT_NETWORK.isTest
      ? 'This build uses Stellar testnet — balances are test funds for pilot testing, not live mainnet money.'
      : 'This build uses Stellar mainnet. Only trade amounts you can afford; follow confirm/dispute rules carefully.',
  },
]

/**
 * Help — pilot guidance, FAQ, shortcuts, and support contacts.
 */
export default function Help() {
  const navigate = useNavigate()
  const { activeTransaction } = useActiveTransaction()
  const { transactions } = useTransactions()
  const { country } = useUserCountry()
  const { publicKey } = useWallet()
  const [openFaq, setOpenFaq] = useState(null)
  const [copied, setCopied] = useState(false)

  const helpOrder = useMemo(() => {
    if (activeTransaction?.id) return activeTransaction
    return transactions?.[0] || null
  }, [activeTransaction, transactions])

  const orderId = helpOrder?.id || null
  const shortId = orderId ? formatShortId(orderId) : null

  const networksLabel = useMemo(() => {
    const nets = Object.values(getNetworksForCountry(country) || {})
    if (!nets.length) {
      return Object.values(NETWORKS)
        .map((n) => n.label)
        .join(', ')
    }
    return nets.map((n) => n.label).join(', ')
  }, [country])

  const countryName = COUNTRY_CODES[country]?.name || country
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'
  const networkLabel = CURRENT_NETWORK.isTest ? 'testnet' : 'mainnet'

  const supportPrefill = orderId
    ? `Hi Rowan support, I need help with order ${shortId} (${orderId}).`
    : 'Hi Rowan support, I need help with my order.'

  const handleCopyOrder = async () => {
    if (!orderId) return
    try {
      await navigator.clipboard.writeText(`${shortId}\n${orderId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Help</h1>
      </div>

      {/* Contact — primary */}
      <section className="bg-rowan-surface border border-rowan-yellow/30 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <HelpCircle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-text text-sm font-semibold">Contact support</p>
            <p className="text-rowan-muted text-xs mt-1 leading-relaxed">
              Something wrong with an order? Reach us before sending more funds.
            </p>
          </div>
        </div>

        {orderId && (
          <div className="bg-rowan-bg border border-rowan-border rounded-xl p-3 mb-3">
            <p className="text-rowan-muted text-[10px] uppercase tracking-wider mb-1">
              {activeTransaction ? 'Active order' : 'Latest order'}
            </p>
            <p className="text-rowan-text text-sm font-mono">{shortId}</p>
            <p className="text-rowan-muted text-[10px] font-mono truncate mt-0.5">{orderId}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopyOrder}
                className="inline-flex items-center gap-1.5 bg-rowan-surface border border-rowan-border text-rowan-text text-xs font-medium px-3 py-2 rounded-lg min-h-9"
              >
                {copied ? <CopyCheck size={14} className="text-rowan-green" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy order ID'}
              </button>
              {activeTransaction && (
                <button
                  type="button"
                  onClick={() => navigate(`/wallet/transaction/${orderId}`)}
                  className="inline-flex items-center gap-1.5 text-rowan-yellow text-xs font-medium px-3 py-2 rounded-lg min-h-9"
                >
                  <ExternalLink size={14} />
                  Open order
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <a
            href={whatsappSupportUrl(supportPrefill)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-rowan-yellow text-rowan-bg text-sm font-medium px-4 py-3 rounded-xl min-h-11"
          >
            <MessageCircle size={16} />
            WhatsApp · {SUPPORT_WHATSAPP}
          </a>
          <a
            href={mailtoSupportUrl(orderId ? `Rowan help · ${shortId}` : 'Rowan support')}
            className="inline-flex items-center justify-center gap-2 bg-rowan-bg border border-rowan-border text-rowan-text text-sm font-medium px-4 py-3 rounded-xl min-h-11"
          >
            <Mail size={16} />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </section>

      {/* Quick links */}
      <section className="bg-rowan-surface rounded-xl divide-y divide-rowan-border mb-4 overflow-hidden">
        <p className="px-4 pt-3 pb-2 text-rowan-muted text-[10px] uppercase tracking-wider">In the app</p>
        <HelpLink
          icon={<History size={18} />}
          label="Order history"
          onClick={() => navigate('/wallet/history')}
        />
        <HelpLink
          icon={<Store size={18} />}
          label="Marketplace"
          onClick={() => navigate('/wallet/p2p')}
        />
        {activeTransaction && (
          <HelpLink
            icon={<AlertTriangle size={18} className="text-rowan-yellow" />}
            label="Open dispute on active order"
            onClick={() => navigate(`/wallet/dispute/${activeTransaction.id}`)}
          />
        )}
        <HelpLink
          icon={<Bell size={18} />}
          label="Rate alerts"
          onClick={() => navigate('/wallet/rate-alerts')}
        />
        <HelpLink
          icon={<Fingerprint size={18} />}
          label="Biometric unlock"
          onClick={() => navigate('/wallet/biometric-setup')}
        />
        <HelpLink
          icon={<Lock size={18} />}
          label="Two-factor auth"
          onClick={() => navigate('/wallet/security/2fa')}
        />
      </section>

      {/* Safety */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-rowan-yellow" />
          <p className="text-rowan-text text-sm font-semibold">Safety</p>
        </div>
        <ul className="space-y-2 text-rowan-muted text-xs leading-relaxed">
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Never share your recovery phrase or private key with anyone
          </li>
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Rowan support will never ask for your seed phrase
          </li>
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Confirm receipt only after mobile money appears in your account
          </li>
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Double-check the escrow memo and amount before sending USDC
          </li>
        </ul>
        {publicKey && (
          <p className="text-rowan-muted text-[10px] font-mono mt-3 truncate border-t border-rowan-border pt-3">
            Wallet: {publicKey}
          </p>
        )}
      </section>

      {/* FAQ */}
      <section className="bg-rowan-surface rounded-xl mb-4 overflow-hidden">
        <p className="px-4 pt-3 pb-2 text-rowan-text text-sm font-semibold">FAQ</p>
        <div className="divide-y divide-rowan-border">
          {FAQ_ITEMS.map((item, i) => {
            const open = openFaq === i
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 min-h-11 text-left"
                >
                  <span className="text-rowan-text text-sm">{item.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-rowan-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                {open && (
                  <p className="px-4 pb-3 text-rowan-muted text-xs leading-relaxed">{item.a}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Networks */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <p className="text-rowan-text text-sm font-semibold mb-2">Networks ({countryName})</p>
        <p className="text-rowan-muted text-xs leading-relaxed">{networksLabel}</p>
        <p className="text-rowan-muted text-xs mt-2">
          Change country under Profile if you trade in another market (UG, KE, TZ).
        </p>
      </section>

      {/* Pilot status */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-text text-sm font-semibold">Rowan pilot</p>
            <p className="text-rowan-muted text-xs mt-1 leading-relaxed">
              Early release. Real partners handle each mobile-money leg. Payouts may take longer than
              the estimate — only trade amounts you can afford to wait on.
            </p>
          </div>
        </div>
      </section>

      {/* What Rowan does */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-rowan-muted" />
          <p className="text-rowan-text text-sm font-semibold">What Rowan does</p>
        </div>
        <ul className="space-y-2 text-rowan-muted text-xs leading-relaxed">
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Locks your USDC in escrow while the order runs
          </li>
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Matches you with a verified trader for your network
          </li>
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Releases or refunds crypto after confirmation or dispute
          </li>
        </ul>
        <p className="text-rowan-muted text-xs mt-3 leading-relaxed border-t border-rowan-border pt-3">
          Rowan does <span className="text-rowan-text font-medium">not</span> send mobile money itself.
          Partners report payouts manually — confirm only after you see funds in your MoMo account.
        </p>
      </section>

      {/* Cash out */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpFromLine size={16} className="text-rowan-muted" />
          <p className="text-rowan-text text-sm font-semibold">Cash out (sell USDC)</p>
        </div>
        <ol className="space-y-2 text-rowan-muted text-xs leading-relaxed list-decimal list-inside">
          <li>Get a quote and send the exact USDC + memo to escrow</li>
          <li>Wait for a trader to accept and send mobile money</li>
          <li>Check your MoMo balance, then confirm receipt in the app</li>
          <li>USDC is released to the trader when you confirm</li>
        </ol>
      </section>

      {/* Buy */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownToLine size={16} className="text-rowan-muted" />
          <p className="text-rowan-text text-sm font-semibold">Buy</p>
        </div>
        <ol className="space-y-2 text-rowan-muted text-xs leading-relaxed list-decimal list-inside">
          <li>Pick a trader ad and follow the quote</li>
          <li>Pay the trader via mobile money as instructed</li>
          <li>Trader verifies payment, then USDC arrives in your wallet</li>
        </ol>
      </section>

      {/* Timing */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-rowan-muted" />
          <p className="text-rowan-text text-sm font-semibold">Timing</p>
        </div>
        <p className="text-rowan-muted text-xs leading-relaxed">
          Estimates are typical, not guarantees. Partners work during their hours. If an order sits
          too long, open a dispute from the order screen or contact support with your order ID.
        </p>
      </section>

      <p className="text-rowan-muted text-[10px] text-center pb-2">
        Rowan v{appVersion} · {networkLabel}
      </p>
    </div>
  )
}

function HelpLink({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between px-4 py-3 min-h-11"
    >
      <div className="flex items-center gap-3">
        <span className="text-rowan-muted">{icon}</span>
        <span className="text-rowan-text text-sm">{label}</span>
      </div>
      <ChevronRight size={16} className="text-rowan-muted" />
    </button>
  )
}
