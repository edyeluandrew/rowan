import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { generateKeypair, fundTestUsdcWallet, loadAccountBalances } from '../utils/stellar'
import { setSecure } from '../utils/storage'
import { WALLET_GEN_DELAY_MS, TESTNET_AUTO_USDC_AMOUNT, CURRENT_NETWORK } from '../utils/constants'
import { getHorizonUrl } from '../../shared/utils/config'
import AddressDisplay from '../components/wallet/AddressDisplay'
import Button from '../components/ui/Button'
import OnboardingShell from '../components/layout/OnboardingShell'

export default function CreateWallet() {
  const navigate = useNavigate()
  const [keypair, setKeypair] = useState(null)
  const [generating, setGenerating] = useState(true)
  const [statusMessage, setStatusMessage] = useState('Generating your wallet...')
  const [testUsdcReady, setTestUsdcReady] = useState(null)
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const kp = generateKeypair()
      await setSecure('rowan_stellar_keypair', JSON.stringify(kp))
      await setSecure('rowan_wallet_created_at', new Date().toISOString())
      if (cancelled) return

      setStatusMessage('Adding test USDC to your wallet...')
      let funded = false
      try {
        const horizonUrl = getHorizonUrl()
        const result = await fundTestUsdcWallet({
          secretKey: kp.secretKey,
          publicKey: kp.publicKey,
          horizonUrl,
        })
        funded = result.usdcFunded !== false && result.skipped !== 'already_has_usdc'
          ? !!result.usdcFunded
          : (result.usdcBalance ?? 0) >= 1
        if (!funded && CURRENT_NETWORK.isTest) {
          const balances = await loadAccountBalances(kp.publicKey, horizonUrl)
          funded = balances.usdc >= 1
        }
      } catch {
        funded = false
      }

      if (!cancelled) {
        setKeypair(kp)
        setTestUsdcReady(CURRENT_NETWORK.isTest ? funded : null)
        setGenerating(false)
      }
    }, WALLET_GEN_DELAY_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  if (generating) {
    return (
      <OnboardingShell
        step={1}
        stepTotal={3}
        title="Creating wallet"
        subtitle={statusMessage}
      >
        <div className="flex flex-col items-center py-10 sm:py-14">
          <div className="w-14 h-14 rounded-full bg-rowan-mint flex items-center justify-center">
            <RefreshCw size={28} className="text-rowan-green animate-spin-slow" />
          </div>
          <p className="text-rowan-muted text-sm mt-5 font-sans text-center">
            Almost there…
          </p>
        </div>
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell
      step={2}
      stepTotal={3}
      title="Wallet ready"
      subtitle="Your Stellar address is set. Back up the secret key so you never lose access."
    >
      <div className="bg-rowan-bg border border-rowan-border rounded-2xl p-4 flex justify-center mb-4">
        <AddressDisplay address={keypair?.publicKey} />
      </div>

      {CURRENT_NETWORK.isTest && testUsdcReady === true && (
        <div className="bg-rowan-mint border border-rowan-green/25 rounded-2xl p-3.5 mb-3">
          <p className="text-rowan-text text-sm font-medium font-sans">
            {TESTNET_AUTO_USDC_AMOUNT} test USDC added — try buy, sell, or airtime next.
          </p>
        </div>
      )}

      {CURRENT_NETWORK.isTest && testUsdcReady === false && (
        <div className="bg-rowan-mint/70 border border-rowan-border rounded-2xl p-3.5 mb-3">
          <p className="text-rowan-text text-sm font-sans">
            Test USDC will finish loading after you sign up — usually a few seconds.
          </p>
        </div>
      )}

      <div className="bg-rowan-bg border border-rowan-border rounded-2xl p-3.5 mb-6 flex items-start gap-2.5">
        <TriangleAlert size={18} className="text-rowan-green flex-shrink-0 mt-0.5" />
        <p className="text-rowan-text text-sm leading-relaxed font-sans">
          Without a backup, lost access cannot be recovered.
        </p>
      </div>

      <Button onClick={() => navigate('/backup-wallet')}>Back up now</Button>

      {!showSkipWarning ? (
        <button
          type="button"
          onClick={() => setShowSkipWarning(true)}
          className="text-rowan-muted text-sm text-center mt-4 min-h-11 w-full font-sans"
        >
          Skip for now
        </button>
      ) : (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-2xl p-4 mt-4">
          <p className="text-rowan-red text-sm mb-3 font-sans">
            You will not recover this wallet without a backup.
          </p>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="text-rowan-red text-sm font-bold underline min-h-11 font-sans"
          >
            Yes, skip backup
          </button>
        </div>
      )}
    </OnboardingShell>
  )
}
