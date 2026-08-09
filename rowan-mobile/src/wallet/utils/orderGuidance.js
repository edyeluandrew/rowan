/**
 * Plain next-step copy for an in-progress P2P order (buy or sell).
 * Keeps TransactionStatus guidance in one place.
 */

import { BUY_STATE_SUBTITLES, STATE_SUBTITLES } from './constants'
import { isBuyOrder } from './transactions'

/**
 * @returns {{
 *   title: string,
 *   body: string,
 *   tip?: string,
 *   urgency: 'normal' | 'soon' | 'critical',
 *   showCancelHint?: boolean,
 *   showDisputeHint?: boolean,
 * }}
 */
export function getOrderGuidance(transaction, {
  isBuy: isBuyHint,
  paymentWindowClosing = false,
  paymentExpired = false,
  appealWindowOpen = false,
} = {}) {
  if (!transaction?.state) {
    return {
      title: 'Loading your order…',
      body: 'Fetching the latest status.',
      urgency: 'normal',
    }
  }

  const isBuy = isBuyHint ?? isBuyOrder(transaction)
  const state = transaction.state

  if (state === 'QUOTE_CONFIRMED' || state === 'QUOTE_REQUESTED') {
    return {
      title: isBuy ? 'Starting your buy…' : 'Send USDC to escrow',
      body: isBuy
        ? 'We are preparing your order. This usually takes a few seconds.'
        : 'Finish sending USDC from your wallet if you have not already. Funds stay in escrow until you confirm MoMo.',
      urgency: 'normal',
    }
  }

  if (state === 'ESCROW_LOCKED') {
    if (isBuy) {
      return {
        title: 'Your turn: send mobile money',
        body: 'Send the exact MoMo amount to the trader, then enter the payment reference and tap “I have sent fiat”.',
        tip: 'Only send via the number shown here. Chat the trader if details look wrong.',
        urgency: 'soon',
      }
    }
    return {
      title: 'Matching you with a trader',
      body: 'Your USDC is locked in escrow. We are finding a verified trader for your payout.',
      tip: 'This usually takes under a few minutes when traders are online.',
      urgency: 'normal',
    }
  }

  if (state === 'TRADER_MATCHED') {
    if (paymentExpired) {
      return {
        title: 'Payment window expired',
        body: isBuy
          ? 'If the trader did not lock USDC in time, this order may cancel and free you to start a new one.'
          : 'If the trader did not send MoMo in time, your USDC is usually refunded automatically within a few minutes.',
        tip: 'Stay on this screen — status updates when the refund or reassignment finishes.',
        urgency: 'critical',
        showCancelHint: false,
      }
    }
    if (paymentWindowClosing) {
      return {
        title: 'Time is almost up',
        body: isBuy
          ? 'Wait a moment for the trader to lock USDC. Cancel is no longer available this close to expiry.'
          : 'Wait for MoMo or for the window to expire for an automatic refund. Cancel is closed in the last 2 minutes.',
        tip: 'Do not start a second order — one active trade at a time.',
        urgency: 'critical',
        showCancelHint: false,
      }
    }
    if (isBuy) {
      return {
        title: 'Waiting for trader to lock USDC',
        body: 'A trader accepted. When they lock escrow, you will see their MoMo number and can pay.',
        tip: 'You can cancel while there is still time left on the window if you no longer want this trade.',
        urgency: 'normal',
        showCancelHint: true,
      }
    }
    return {
      title: 'Waiting for mobile money',
      body: 'A trader has your order. Watch for MoMo, then come back here to confirm receipt.',
      tip: 'You can cancel (and get USDC refunded) while the payment window still has more than 2 minutes left.',
      urgency: 'normal',
      showCancelHint: true,
    }
  }

  if (state === 'FIAT_PAYOUT_SUBMITTED') {
    if (isBuy) {
      return {
        title: 'Waiting for the trader',
        body: 'You marked MoMo as sent. The trader must confirm they received it, then release USDC to you.',
        tip: 'If nothing moves for a long time, use chat or open a dispute.',
        urgency: 'soon',
        showDisputeHint: true,
      }
    }
    return {
      title: 'Check your mobile money',
      body: 'The trader says they sent MoMo. Confirm only after the money is in your account — that releases USDC from escrow.',
      tip: 'If MoMo did not arrive, dispute instead of confirming.',
      urgency: 'soon',
      showDisputeHint: true,
    }
  }

  if (state === 'USER_CONFIRMATION_PENDING') {
    if (isBuy) {
      return {
        title: 'Releasing your USDC…',
        body: 'Trader confirmed. Your wallet balance should update shortly.',
        urgency: 'normal',
      }
    }
    return {
      title: 'Confirm your receipt',
      body: 'Tap “I have received fiat” if MoMo arrived. Raise a dispute if it did not.',
      urgency: 'soon',
      showDisputeHint: true,
    }
  }

  if (state === 'DISPUTE_OPENED') {
    return {
      title: 'Dispute under review',
      body: 'Upload any MoMo screenshots or chat proof below. Support will resolve escrow from the evidence.',
      urgency: 'soon',
    }
  }

  if (state === 'RELEASE_BLOCKED') {
    return {
      title: 'This order needs support',
      body: 'Escrow release is blocked. Contact support from Help with your order ID.',
      urgency: 'critical',
    }
  }

  if (state === 'COMPLETE' && appealWindowOpen) {
    return {
      title: 'Trade complete',
      body: isBuy
        ? 'USDC should be in your wallet. You can still open a dispute within 24 hours if something is wrong.'
        : 'MoMo should be with you. You can still open a dispute within 24 hours if something is wrong.',
      urgency: 'normal',
      showDisputeHint: true,
    }
  }

  const fallback = isBuy
    ? (BUY_STATE_SUBTITLES[state] || STATE_SUBTITLES[state])
    : STATE_SUBTITLES[state]

  return {
    title: 'Order in progress',
    body: fallback || 'We will update this screen as the trade moves forward.',
    urgency: 'normal',
  }
}
