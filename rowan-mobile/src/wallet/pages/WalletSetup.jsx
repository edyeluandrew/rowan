import { useNavigate } from 'react-router-dom'
import { PlusCircle, Download, Shield } from 'lucide-react'

export default function WalletSetup() {
  const navigate = useNavigate()

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-16">
      <h1 className="text-rowan-yellow font-bold text-2xl tracking-widest text-center mb-2">
        ROWAN
      </h1>
      <h2 className="text-rowan-text text-xl font-bold text-center mb-8">
        Your Stellar Wallet
      </h2>

      {/* Create New Wallet */}
      <button
        onClick={() => navigate('/create-wallet')}
        className="bg-rowan-surface border border-rowan-yellow rounded-xl p-5 flex items-start gap-4 mb-4 text-left min-h-11"
      >
        <PlusCircle size={28} className="text-rowan-yellow flex-shrink-0 mt-1" />
        <div>
          <p className="text-rowan-text font-bold">New Wallet</p>
          <p className="text-rowan-muted text-sm mt-1">
            Generate a brand new Stellar wallet. Perfect if you don&apos;t have one yet
          </p>
        </div>
      </button>

      {/* Import Existing Wallet */}
      <button
        onClick={() => navigate('/import-wallet')}
        className="bg-rowan-surface border border-rowan-border rounded-xl p-5 flex items-start gap-4 mb-4 text-left min-h-11"
      >
        <Download size={28} className="text-rowan-muted flex-shrink-0 mt-1" />
        <div>
          <p className="text-rowan-text font-bold">Import Wallet</p>
          <p className="text-rowan-muted text-sm mt-1">
            Import using your secret key. For existing Stellar wallets
          </p>
        </div>
      </button>

      {/* Security note */}
      <div className="flex items-center gap-2 justify-center mt-auto pb-8">
        <Shield size={14} className="text-rowan-muted" />
        <p className="text-rowan-muted text-xs text-center">
          Your private key is stored securely on this device using hardware encryption
        </p>
      </div>
    </div>
  )
}
