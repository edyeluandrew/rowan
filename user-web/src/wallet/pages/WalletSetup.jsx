import { useNavigate } from 'react-router-dom'
import { PlusCircle, Download, ArrowRight, ChevronRight } from 'lucide-react'
import OnboardingShell from '../components/layout/OnboardingShell'

export default function WalletSetup() {
  const navigate = useNavigate()

  return (
    <OnboardingShell
      step={1}
      stepTotal={3}
      title="Your wallet"
      subtitle="Choose how you want to begin. You can always import another key later."
    >
      <button
        type="button"
        onClick={() => navigate('/create-wallet')}
        className="group w-full text-left rounded-2xl border-2 border-rowan-green/30 bg-rowan-mint/40 hover:bg-rowan-mint hover:border-rowan-green/50 transition p-4 sm:p-5 mb-3 min-h-11"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 rounded-2xl bg-rowan-green flex items-center justify-center shrink-0">
            <PlusCircle size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-rowan-text font-sans text-base">Create new wallet</p>
            <p className="text-sm text-rowan-muted mt-1 leading-relaxed font-sans">
              Generate a fresh Stellar keypair on this device. Best if you&apos;re new.
            </p>
          </div>
          <ArrowRight size={18} className="text-rowan-green shrink-0 mt-1 opacity-70 group-hover:opacity-100" />
        </div>
      </button>

      <button
        type="button"
        onClick={() => navigate('/import-wallet')}
        className="group w-full text-left rounded-2xl border border-rowan-border bg-rowan-bg/50 hover:bg-white hover:border-rowan-green/30 transition p-4 sm:p-5 min-h-11"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 rounded-2xl bg-white border border-rowan-border flex items-center justify-center shrink-0">
            <Download size={22} className="text-rowan-green" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-rowan-text font-sans text-base">Import existing</p>
            <p className="text-sm text-rowan-muted mt-1 leading-relaxed font-sans">
              Paste a secret key that starts with S.
            </p>
          </div>
          <ChevronRight size={18} className="text-rowan-muted shrink-0 mt-1 group-hover:text-rowan-green" />
        </div>
      </button>
    </OnboardingShell>
  )
}
