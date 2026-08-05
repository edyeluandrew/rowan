import { Signal, Wifi, Zap } from 'lucide-react'

export function getUtilityType(source) {
  if (!source) return 'airtime'
  return source.type || source.utilityType || source.utility_type || 'airtime'
}

function maskAccount(value) {
  const clean = String(value || '').replace(/\s+/g, '')
  if (clean.length <= 4) return clean
  return `•••• ${clean.slice(-4)}`
}

export function getUtilityLabels(type = 'airtime') {
  if (type === 'bill') {
    return {
      type: 'bill',
      product: 'Bill payment',
      productLower: 'bill payment',
      receiptTitle: 'Bill receipt',
      successTitle: 'Bill paid!',
      creditLabel: 'Bill amount',
      accountLabel: 'Account / meter',
      mockNote: 'Sandbox mock — no real bill settlement',
      buyMore: 'Pay another bill',
      sendButton: 'Send USDC & pay bill',
      confirmTimerHint: 'Send USDC before the timer runs out to complete your bill payment.',
      confirmAfterPayment: 'After payment, your bill is submitted to the utility provider.',
      deliveryNote: 'to complete bill payment.',
      utilitiesPath: '/wallet/utilities/bills',
      Icon: Zap,
      maskRecipient: maskAccount,
    }
  }

  if (type === 'data') {
    return {
      type: 'data',
      product: 'Data bundle',
      productLower: 'data bundle',
      receiptTitle: 'Data receipt',
      successTitle: 'Data sent!',
      creditLabel: 'Data credit',
      accountLabel: 'Phone',
      mockNote: 'Sandbox mock — no real data sent',
      buyMore: 'Buy more data',
      sendButton: 'Send USDC & buy data',
      confirmTimerHint: 'Send USDC before the timer runs out to complete your data purchase.',
      confirmAfterPayment: 'After payment, data is sent directly to the phone number above.',
      deliveryNote: 'to complete data delivery.',
      utilitiesPath: '/wallet/utilities/data',
      Icon: Wifi,
      maskRecipient: null,
    }
  }

  return {
    type: 'airtime',
    product: 'Airtime',
    productLower: 'airtime',
    receiptTitle: 'Airtime receipt',
    successTitle: 'Airtime sent!',
    creditLabel: 'Airtime credit',
    accountLabel: 'Phone',
    mockNote: 'Sandbox mock — no real airtime sent',
    buyMore: 'Buy more airtime',
    sendButton: 'Send USDC & buy airtime',
    confirmTimerHint: 'Send USDC before the timer runs out to complete your airtime purchase.',
    confirmAfterPayment: 'After payment, airtime is sent directly to the phone number above.',
    deliveryNote: 'to complete airtime delivery.',
    utilitiesPath: '/wallet/utilities/airtime',
    Icon: Signal,
    maskRecipient: null,
  }
}

export function labelsFor(source) {
  return getUtilityLabels(getUtilityType(source))
}

/** User-facing note when Reloadly sandbox biller is down but USDC already settled (testnet). */
export function billSandboxFallbackNote({ operatorName, countryCode } = {}) {
  const provider = operatorName
    || (countryCode === 'KE' ? 'Kenya Electricity'
      : countryCode === 'UG' ? 'Umeme'
        : countryCode === 'TZ' ? 'TANESCO'
          : countryCode === 'RW' ? 'REG'
            : 'this utility provider')
  return `Reloadly sandbox for ${provider} is temporarily unavailable. Your USDC payment was received — units and token below are simulated so testnet flow can continue. Re-test when Reloadly fixes the sandbox biller.`
}

export function billSandboxUnavailableHint(countryCode) {
  if (countryCode === 'KE' || countryCode === 'UG') {
    return 'Kenya & Uganda electricity sandboxes on Reloadly are often down. USDC payment still works; receipt may show simulated units/token until Reloadly restores the biller.'
  }
  return 'Some Reloadly sandbox billers are unavailable. USDC payment still works; receipt may show simulated units/token when the provider is down.'
}
