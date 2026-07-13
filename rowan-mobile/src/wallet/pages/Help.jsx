import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  MessageCircle,
  Mail,
  Info,
  Shield,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Clock,
  HelpCircle,
} from 'lucide-react'
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, whatsappSupportUrl, mailtoSupportUrl } from '../utils/support'
import { CURRENT_NETWORK } from '../utils/constants'

/**
 * Help — pilot guidance + support contacts (moved off Home).
 */
export default function Help() {
  const navigate = useNavigate()

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
        <div className="flex flex-col gap-2">
          <a
            href={whatsappSupportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-rowan-yellow text-rowan-bg text-sm font-medium px-4 py-3 rounded-xl min-h-11"
          >
            <MessageCircle size={16} />
            WhatsApp · {SUPPORT_WHATSAPP}
          </a>
          <a
            href={mailtoSupportUrl()}
            className="inline-flex items-center justify-center gap-2 bg-rowan-bg border border-rowan-border text-rowan-text text-sm font-medium px-4 py-3 rounded-xl min-h-11"
          >
            <Mail size={16} />
            {SUPPORT_EMAIL}
          </a>
        </div>
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
            {CURRENT_NETWORK.isTest && (
              <p className="text-rowan-muted text-xs mt-2 leading-relaxed">
                You are on <span className="text-rowan-text font-medium">Stellar testnet</span> —
                balances are test funds, not real money.
              </p>
            )}
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
          <p className="text-rowan-text text-sm font-semibold">Buy USDC</p>
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

      {/* Problems */}
      <section className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-rowan-yellow" />
          <p className="text-rowan-text text-sm font-semibold">If something goes wrong</p>
        </div>
        <ul className="space-y-2 text-rowan-muted text-xs leading-relaxed">
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Didn’t receive MoMo after payout marked sent → open a dispute (don’t confirm)
          </li>
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Sent wrong amount or expired quote → wait for refund path or contact support
          </li>
          <li className="flex gap-2">
            <span className="text-rowan-yellow shrink-0">•</span>
            Include your order ID / wallet address when you message us
          </li>
        </ul>
        <div className="flex flex-wrap gap-2 mt-4">
          <a
            href={whatsappSupportUrl('Hi Rowan support, I need help with order ID: ')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-rowan-yellow/15 text-rowan-yellow text-xs font-medium px-3 py-2 rounded-lg min-h-9"
          >
            <MessageCircle size={14} />
            WhatsApp with order
          </a>
          <a
            href={mailtoSupportUrl('Rowan order help')}
            className="inline-flex items-center gap-1.5 border border-rowan-border text-rowan-text text-xs font-medium px-3 py-2 rounded-lg min-h-9"
          >
            <Mail size={14} />
            Email support
          </a>
        </div>
      </section>
    </div>
  )
}
