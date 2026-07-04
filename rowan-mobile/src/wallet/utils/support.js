/** Pilot / MVP support contact — shown in-app and runbook */
export const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP || '+256792700303'
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@rowan.app'

export function whatsappSupportUrl(prefill = 'Hi Rowan support, I need help with my order.') {
  const digits = SUPPORT_WHATSAPP.replace(/\D/g, '')
  const text = encodeURIComponent(prefill)
  return `https://wa.me/${digits}?text=${text}`
}

export function mailtoSupportUrl(subject = 'Rowan support') {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}
