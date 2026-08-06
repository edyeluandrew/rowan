import { Signal, Wifi } from 'lucide-react'

export function getUtilityType(source) {
  if (!source) return 'airtime'
  return source.type || source.utilityType || source.utility_type || 'airtime'
}

export function getUtilityLabels(type = 'airtime') {
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
  }
}

export function labelsFor(source) {
  return getUtilityLabels(getUtilityType(source))
}
