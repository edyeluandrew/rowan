import { formatCurrency } from './format'
import { NETWORKS } from './constants'
import { isAutomatedOfframp, isAutomatedOnramp, isBuyOrder } from './transactions'

/** Human readable transaction status — never show raw state enums in UI */
export const USER_STATUS_LABELS = {
  QUOTE_REQUESTED: 'Getting your rate...',
  QUOTE_CONFIRMED: 'Rate confirmed',
  ESCROW_LOCKED: 'Waiting for a trader',
  TRADER_MATCHED: 'Waiting for mobile money',
  FIAT_PAYOUT_SUBMITTED: 'Check your phone',
  USER_CONFIRMATION_PENDING: 'Did you get it?',
  COMPLETE: 'Done!',
  DISPUTE_OPENED: 'Under review',
  DISPUTE_RELEASE_PENDING: 'Under review',
  DISPUTE_REFUND_PENDING: 'Under review',
  RELEASE_BLOCKED: 'Needs attention',
  REFUNDED: 'Refunded',
  FAILED: 'Transaction failed',
}

const AUTOMATED_STATUS_LABELS = {
  ESCROW_LOCKED: 'Sending to your phone',
  FIAT_PAYOUT_SUBMITTED: 'Check your phone',
  USER_CONFIRMATION_PENDING: 'Finishing payout',
}

const AUTOMATED_ONRAMP_STATUS_LABELS = {
  TRADER_MATCHED: 'Approve on your phone',
  FIAT_PAYOUT_SUBMITTED: 'Approve on your phone',
  USER_CONFIRMATION_PENDING: 'Sending USDC',
}

export function getStatusLabel(state, options = {}) {
  if (!state) return 'Processing'
  if (options.onramp && AUTOMATED_ONRAMP_STATUS_LABELS[state]) return AUTOMATED_ONRAMP_STATUS_LABELS[state]
  if (options.automated && AUTOMATED_STATUS_LABELS[state]) return AUTOMATED_STATUS_LABELS[state]
  return USER_STATUS_LABELS[state] || 'Processing'
}

/** Window expiry / cancel with nothing stuck in escrow — not a “contact support” failure. */
export function isCleanOrderClose(tx) {
  if (!tx) return false
  const reason = String(tx.failureReason ?? tx.failure_reason ?? '').toLowerCase()
  if (/payment window expired|cancelled by buyer|no trader available|order closed/.test(reason)) {
    return true
  }
  if (tx.state === 'FAILED' && !(tx.stellarDepositTx || tx.stellar_deposit_tx)) {
    return true
  }
  return false
}

/** Copy for COMPLETE / REFUNDED / FAILED on the order screen. */
export function getTerminalOrderMessage(tx) {
  if (!tx) return ''
  const buy = isBuyOrder(tx)

  if (tx.state === 'COMPLETE') {
    return buy ? 'Done. Check your wallet for USDC.' : 'Done. Check your phone for the exact amount.'
  }

  if (tx.state === 'REFUNDED') {
    return buy
      ? 'Time ran out. This order is closed. Start a new buy when you want.'
      : 'Your USDC is back in your wallet. This order is closed. Sell again when you want.'
  }

  if (tx.state === 'FAILED') {
    if (isCleanOrderClose(tx)) {
      return buy
        ? 'Time ran out. No USDC left your wallet. This order is closed — start a new buy when you want.'
        : 'This order closed. Nothing was taken from your wallet. Sell again when you want.'
    }
    return 'This order failed. If USDC is not back in your wallet, email support@rowanpay.app with your order ID.'
  }

  return ''
}

/** e.g. 98.5% */
export function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return null
  return `${Number(value).toFixed(1)}%`
}

/** e.g. "4 mins", "1 min" */
export function formatDurationMinutes(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return null
  const m = Math.round(Number(minutes))
  if (m <= 0) return 'Under 1 min'
  return m === 1 ? '1 min' : `${m} mins`
}

/** Human-readable order reference: ROW-A1B2C3D4 */
export function formatShortId(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') return 'ROW-????????'
  return `ROW-${transactionId.replace(/-/g, '').substring(0, 8).toUpperCase()}`
}

/** e.g. "UGX 3,680 per XLM" for rate lock display */
export function formatLockedRateLine(currency, rate) {
  if (!currency || rate == null || !Number.isFinite(Number(rate))) return null
  const formatted = Number(rate).toLocaleString('en-US', { maximumFractionDigits: 0 })
  return `${currency} ${formatted} per XLM`
}

/** e.g. "1 XLM = UGX 3,680" */
export function formatXlmRateLine(currency, rate) {
  if (!currency || rate == null || !Number.isFinite(Number(rate))) return null
  const formatted = Number(rate).toLocaleString('en-US', { maximumFractionDigits: 0 })
  return `1 XLM = ${currency} ${formatted}`
}

/** e.g. "1 USDC ≈ UGX 3,728" — trader-set buy price */
export function formatUsdcRateLine(currency, ratePerUsdc) {
  if (!currency || ratePerUsdc == null || !Number.isFinite(Number(ratePerUsdc))) return null
  const formatted = Number(ratePerUsdc).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `1 USDC ≈ ${currency} ${formatted}`
}

/** e.g. "Ref UGX 3,720 · +1.6%" */
export function formatUsdcRateVsMarket(currency, traderRate, marketRate) {
  const trader = Number(traderRate)
  const market = Number(marketRate)
  if (!currency || !Number.isFinite(trader) || trader <= 0 || !Number.isFinite(market) || market <= 0) {
    return null
  }
  const pct = ((trader - market) / market) * 100
  const marketFmt = market.toLocaleString('en-US', { maximumFractionDigits: 0 })
  const sign = pct > 0 ? '+' : ''
  return `Ref ${currency} ${marketFmt} · ${sign}${pct.toFixed(1)}%`
}

/** Context-aware sell progress copy (P2P vs automated rail). */
export function getSellProgressSubtitle(tx) {
  if (!tx || isBuyOrder(tx)) return null
  const state = tx.state

  if (isAutomatedOfframp(tx)) {
    if (state === 'ESCROW_LOCKED') return 'Sending mobile money to your phone'
    if (state === 'FIAT_PAYOUT_SUBMITTED') return 'Check your phone — MoMo is on the way'
    if (state === 'USER_CONFIRMATION_PENDING') return 'Finishing your payout'
    return null
  }

  const traderId = tx.traderId ?? tx.trader_id
  if (state === 'ESCROW_LOCKED' && !traderId) return 'A trader will send the exact amount to your phone'
  if (state === 'TRADER_MATCHED') {
    return tx.matchedAt || tx.matched_at
      ? 'Watch your phone for the exact amount'
      : 'A trader is reviewing your request'
  }
  if (state === 'FIAT_PAYOUT_SUBMITTED') return 'If the money arrived, tap I got it'
  return null
}

/** Context-aware buy progress copy (P2P vs Collect Money). */
export function getBuyProgressSubtitle(tx) {
  if (!tx || !isBuyOrder(tx) || !isAutomatedOnramp(tx)) return null
  const state = tx.state
  if (state === 'TRADER_MATCHED' || state === 'FIAT_PAYOUT_SUBMITTED') {
    return 'Approve the MTN or Airtel prompt'
  }
  if (state === 'USER_CONFIRMATION_PENDING') return 'Sending USDC to your wallet'
  return null
}

/** Automated rail waiting on MarzPay (cash-out send or buy collect). */
export function isAutomatedPayoutPending(tx) {
  if (isAutomatedOfframp(tx)) {
    return ['ESCROW_LOCKED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING'].includes(tx.state)
  }
  if (isAutomatedOnramp(tx)) {
    return ['TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING'].includes(tx.state)
  }
  return false
}

/** e.g. "Joined Jun 2024" */
export function formatMemberSince(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  if (!Number.isFinite(d.getTime())) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `Joined ${months[d.getMonth()]} ${d.getFullYear()}`
}

/** e.g. "Usually under 10 min" — platform typical trade duration */
export function formatTypicalTradeTime(minutes) {
  const m = Number(minutes)
  if (!Number.isFinite(m) || m <= 0) return null
  return m === 1 ? 'Usually under 1 min' : `Usually under ${m} min`
}

/** e.g. "Avg. payout: 4 min" */
export function formatAvgReleaseTime(minutes) {
  const formatted = formatDurationMinutes(minutes)
  if (!formatted) return null
  return `Avg. payout: ${formatted}`
}

/** e.g. "42 trades" */
export function formatTradeCount(count) {
  const n = Number(count)
  if (!Number.isFinite(n) || n < 0) return null
  if (n === 0) return 'No trades yet'
  return n === 1 ? '1 trade' : `${n.toLocaleString()} trades`
}

/** Rough USDC per XLM from fiat rates */
export function estimateUsdcPerXlm(xlmRate, usdcToFiat) {
  const xlm = Number(xlmRate)
  const usdc = Number(usdcToFiat)
  if (!Number.isFinite(xlm) || !Number.isFinite(usdc) || usdc <= 0) return null
  return xlm / usdc
}

/** e.g. "With 10 USDC → ~UGX 36,400" */
export function formatUsdcSellEstimateLine(usdcAmount, fiatAmount, currency) {
  const usdc = Number(usdcAmount)
  const fiat = Number(fiatAmount)
  if (!Number.isFinite(usdc) || !Number.isFinite(fiat) || !currency) return null
  const fiatFmt = Math.round(fiat).toLocaleString('en-US')
  const usdcFmt = usdc < 10 ? usdc.toFixed(2) : String(Math.round(usdc))
  return `With ${usdcFmt} USDC → ~${currency} ${fiatFmt}`
}

/** e.g. "With 10 XLM → ~UGX 36,400" */
export function formatSellEstimateLine(xlmAmount, fiatAmount, currency) {
  const xlm = Number(xlmAmount)
  const fiat = Number(fiatAmount)
  if (!Number.isFinite(xlm) || !Number.isFinite(fiat) || !currency) return null
  const fiatFmt = Math.round(fiat).toLocaleString('en-US')
  const xlmFmt = Number.isInteger(xlm) ? String(xlm) : xlm.toFixed(1)
  return `With ${xlmFmt} XLM → ~${currency} ${fiatFmt}`
}

/** e.g. "10:34 AM" */
export function formatMessageTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function getNetworkLabel(networkKey) {
  return NETWORKS[networkKey]?.label || 'Mobile Money'
}

/** Sell cash-out hero: one step, one amount, no jargon. */
export function getSellTradeHero(transaction, { networkLabel } = {}) {
  if (!transaction || isBuyOrder(transaction)) return null
  const state = transaction.state
  if (['COMPLETE', 'REFUNDED', 'FAILED', 'DISPUTE_OPENED', 'RELEASE_BLOCKED'].includes(state)) {
    return null
  }
  const amountLabel = formatCurrency(
    transaction.fiatAmount ?? transaction.fiat_amount,
    transaction.fiatCurrency || transaction.fiat_currency || transaction.currency || 'UGX'
  )
  const network = networkLabel || 'mobile money'
  const automated = isAutomatedOfframp(transaction)

  if (state === 'QUOTE_REQUESTED' || state === 'QUOTE_CONFIRMED') {
    return {
      step: 1,
      title: 'Send this USDC',
      amountLabel,
      amountCaption: `You'll receive this exact amount on ${network}`,
      copyFiat: true,
    }
  }
  if (state === 'ESCROW_LOCKED') {
    if (automated) {
      return {
        step: 2,
        title: 'Sending to your phone',
        amountLabel,
        amountCaption: `Watch ${network} for this amount`,
        copyFiat: true,
      }
    }
    return {
      step: 2,
      title: 'Waiting for a trader',
      amountLabel,
      amountCaption: `They will send this exact amount to your ${network}`,
      copyFiat: true,
    }
  }
  if (state === 'TRADER_MATCHED') {
    return {
      step: 3,
      title: 'Waiting for mobile money',
      amountLabel,
      amountCaption: `Check ${network} for this exact amount`,
      copyFiat: true,
    }
  }
  if (state === 'FIAT_PAYOUT_SUBMITTED' || state === 'USER_CONFIRMATION_PENDING') {
    if (automated) {
      return {
        step: 3,
        title: `Check your ${network}`,
        amountLabel,
        amountCaption: 'This amount should land on your phone',
        copyFiat: true,
      }
    }
    return {
      step: 4,
      title: `Check your ${network}`,
      amountLabel,
      amountCaption: 'If it arrived, tap I got it',
      copyFiat: true,
    }
  }
  return null
}

export function getTraderDisplayName(name) {
  const trimmed = (name || '').trim()
  return trimmed || 'Verified Trader'
}

export function lookupNetworkRate(allRates, network) {
  if (!allRates || !network) return null
  if (Array.isArray(allRates)) {
    const row = allRates.find((r) => r.network === network)
    return row?.rate ?? null
  }
  return allRates[network]?.rate ?? allRates[network] ?? null
}

export { formatCurrency }
