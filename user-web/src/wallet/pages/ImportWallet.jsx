import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { isValidSecretKey, keypairFromSecret, fundTestUsdcWallet } from '../utils/stellar'
import { CURRENT_NETWORK } from '../utils/constants'
import { getHorizonUrl } from '../../shared/utils/config'
import { setSecure } from '../utils/storage'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import OnboardingShell from '../components/layout/OnboardingShell'

export default function ImportWallet() {
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)

  const valid = isValidSecretKey(secret)

  useEffect(() => () => setSecret(''), [])

  const handleImport = async () => {
    if (!valid) return
    setLoading(true)
    try {
      const kp = keypairFromSecret(secret)
      const keypairData = {
        publicKey: kp.publicKey(),
        secretKey: kp.secret(),
      }
      await setSecure('rowan_stellar_keypair', JSON.stringify(keypairData))
      await setSecure('rowan_wallet_created_at', new Date().toISOString())
      if (CURRENT_NETWORK.isTest) {
        try {
          await fundTestUsdcWallet({
            secretKey: keypairData.secretKey,
            publicKey: keypairData.publicKey,
            horizonUrl: getHorizonUrl(),
          })
        } catch {
          /* Home auto-retries test USDC funding */
        }
      }
      navigate('/register')
    } catch {
      /* invalid key */
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingShell
      step={1}
      stepTotal={2}
      title="Import wallet"
      subtitle="Paste your Stellar secret key. It starts with S and stays on this device only."
    >
      <label className="block text-xs font-medium text-rowan-muted uppercase tracking-wider mb-2 font-sans">
        Secret key
      </label>
      <Input
        type={show ? 'text' : 'password'}
        value={secret}
        onChange={(e) => { setSecret(e.target.value); setTouched(true) }}
        placeholder="S…"
        error={touched && secret && !valid}
        className="font-mono pr-20"
        rightElement={
          <div className="flex items-center gap-2">
            {valid && <CheckCircle2 size={16} className="text-rowan-green" />}
            <button type="button" onClick={() => setShow(!show)} className="text-rowan-muted p-1" aria-label={show ? 'Hide' : 'Show'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        }
      />

      {touched && secret && !valid && (
        <p className="text-rowan-red text-xs mt-2 font-sans">Invalid secret key format</p>
      )}

      <div className="mt-6">
        <Button onClick={handleImport} disabled={!valid} loading={loading}>
          Continue
        </Button>
      </div>

      <div className="flex items-start gap-2 mt-5">
        <TriangleAlert size={15} className="text-rowan-green flex-shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs leading-relaxed font-sans">
          Never share this key. Rowan never sends it to our servers.
        </p>
      </div>
    </OnboardingShell>
  )
}
