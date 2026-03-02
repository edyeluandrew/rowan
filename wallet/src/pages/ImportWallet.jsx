import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { isValidSecretKey, keypairFromSecret } from '../utils/stellar'
import { setSecure } from '../utils/storage'
import Button from '../components/ui/Button'

export default function ImportWallet() {
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)

  const valid = isValidSecretKey(secret)

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
      navigate('/register')
    } catch {
      /* import failed — invalid key */
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-16">
      <h2 className="text-rowan-text text-xl font-bold text-center mb-2">Import Wallet</h2>
      <p className="text-rowan-muted text-sm text-center mb-6">
        Enter your Stellar secret key. Keys start with S
      </p>

      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={secret}
          onChange={(e) => { setSecret(e.target.value); setTouched(true) }}
          placeholder="S..."
          className={`bg-rowan-surface border text-rowan-text font-mono rounded-xl px-4 py-4 w-full text-sm focus:outline-none pr-20 min-h-11 ${
            valid
              ? 'border-rowan-green focus:border-rowan-green'
              : touched && secret
              ? 'border-rowan-red focus:border-rowan-red'
              : 'border-rowan-border focus:border-rowan-yellow'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {valid && <CheckCircle2 size={16} className="text-rowan-green" />}
          <button onClick={() => setShow(!show)} className="text-rowan-muted p-1">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {touched && secret && !valid && (
        <p className="text-rowan-red text-xs mt-2">Invalid secret key format</p>
      )}

      <div className="mt-6">
        <Button onClick={handleImport} disabled={!valid} loading={loading}>
          Import Wallet
        </Button>
      </div>

      <div className="flex items-start gap-2 mt-6">
        <TriangleAlert size={16} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs">
          Your key is stored locally using hardware encryption. It is never sent to our servers
        </p>
      </div>
    </div>
  )
}
