import { useEffect, useState } from 'react'
import { Info, MessageCircle, Mail } from 'lucide-react'
import { getPreference, setPreference } from '../../utils/storage'
import { SUPPORT_EMAIL, whatsappSupportUrl, mailtoSupportUrl } from '../../utils/support'

const DISMISS_KEY = 'rowan_mvp_pilot_banner_dismissed'

/**
 * MVP pilot disclaimer with support contacts. Dismissible per device.
 */
export default function MvpPilotBanner({ className = '' }) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    getPreference(DISMISS_KEY)
      .then((value) => setDismissed(value === 'true'))
      .catch(() => setDismissed(false))
  }, [])

  const dismiss = async () => {
    setDismissed(true)
    await setPreference(DISMISS_KEY, 'true')
  }

  if (dismissed) return null

  return (
    <div className={`bg-rowan-surface border border-rowan-yellow/30 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Info size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-rowan-text text-sm font-semibold">Rowan MVP pilot</p>
          <p className="text-rowan-muted text-xs mt-1 leading-relaxed">
            Early release — real traders handle each order. Payouts may take longer than the estimate.
            Only trade amounts you can afford to wait on.
          </p>
          <p className="text-rowan-muted text-xs mt-2">
            Something wrong? Contact support before sending more funds.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <a
              href={whatsappSupportUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-rowan-yellow/15 text-rowan-yellow text-xs font-medium px-3 py-2 rounded-lg min-h-9"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
            <a
              href={mailtoSupportUrl()}
              className="inline-flex items-center gap-1.5 bg-rowan-surface border border-rowan-border text-rowan-text text-xs font-medium px-3 py-2 rounded-lg min-h-9"
            >
              <Mail size={14} />
              {SUPPORT_EMAIL}
            </a>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-rowan-muted text-xs mt-3 min-h-9"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
