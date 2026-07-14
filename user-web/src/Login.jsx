/**
 * Casual-user web entry — wallet only (no trader).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Lock, Smartphone, ArrowRight, Monitor } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { getSecure } from './shared/utils/storage'
import { formatAddress } from './wallet/utils/format'
import WalletTwoFactorLoginModal from './wallet/pages/WalletTwoFactorLoginModal'

const SLIDES = [
  { Icon: Star, title: 'Your USDC wallet', desc: 'Buy and sell USDC with mobile money across East Africa.' },
  { Icon: Lock, title: 'Escrow protected', desc: 'Funds stay locked until both sides confirm the trade.' },
  { Icon: Smartphone, title: 'Express or pick a trader', desc: 'Auto-match the best rate, or choose who you trade with.' },
]

export default function Login() {
  const { loginWithWallet, setWalletAuthAfter2FA } = useAuth()
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)
  const [storedPublicKey, setStoredPublicKey] = useState(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState(null)
  const [show2faModal, setShow2faModal] = useState(false)
  const [tempUserId, setTempUserId] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSecure('rowan_stellar_keypair')
        if (!stored) return
        const kp = JSON.parse(stored)
        if (kp?.publicKey) setStoredPublicKey(kp.publicKey)
      } catch {
        /* no wallet */
      }
    })()
  }, [])

  const handleOpenWallet = async () => {
    setWalletLoading(true)
    setWalletError(null)
    try {
      const response = await loginWithWallet()
      if (response?.requiresTwoFactorVerification === true) {
        setTempUserId(response.userId)
        setShow2faModal(true)
      } else {
        navigate('/wallet/home', { replace: true })
      }
    } catch (err) {
      setWalletError(err.message || 'Could not open wallet')
    } finally {
      setWalletLoading(false)
    }
  }

  const handleWalletAfter2FA = async (verifyResponse) => {
    setWalletLoading(true)
    setWalletError(null)
    try {
      const keypair = await getSecure('rowan_stellar_keypair')
      const kpData = keypair ? JSON.parse(keypair) : null
      await setWalletAuthAfter2FA(
        verifyResponse.token,
        verifyResponse.user || { id: tempUserId },
        kpData,
      )
      setShow2faModal(false)
      setTempUserId(null)
      navigate('/wallet/home', { replace: true })
    } catch (err) {
      setWalletError(err.message || 'Verification failed. Please try again.')
    } finally {
      setWalletLoading(false)
    }
  }

  const SlideIcon = SLIDES[slide].Icon

  return (
    <div className="min-h-screen bg-rowan-bg text-rowan-text">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 text-rowan-green text-sm font-semibold mb-4">
            <Monitor size={16} />
            Rowan Web
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-3">Rowan</h1>
          <p className="text-rowan-muted text-lg mb-8 max-w-md">
            Buy and sell USDC with MTN, Airtel, and M-Pesa — same flows as the app, on your browser.
          </p>

          <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-6 mb-6 min-h-[140px]">
            <SlideIcon size={28} className="text-rowan-green mb-3" />
            <p className="text-rowan-text font-semibold text-lg">{SLIDES[slide].title}</p>
            <p className="text-rowan-muted text-sm mt-2">{SLIDES[slide].desc}</p>
            <div className="flex gap-1.5 mt-4">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-rowan-green' : 'w-1.5 bg-rowan-border'}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2 bg-rowan-surface border border-rowan-border rounded-2xl p-6 lg:p-8 shadow-sm">
          {storedPublicKey ? (
            <>
              <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Wallet on this device</p>
              <p className="text-rowan-text font-mono text-sm mb-6">{formatAddress(storedPublicKey)}</p>
              {walletError && <p className="text-rowan-red text-sm mb-4">{walletError}</p>}
              <button
                type="button"
                disabled={walletLoading}
                onClick={handleOpenWallet}
                className="w-full min-h-12 rounded-xl bg-rowan-green text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {walletLoading ? 'Opening…' : 'Open wallet'}
                {!walletLoading && <ArrowRight size={18} />}
              </button>
              <button
                type="button"
                onClick={() => navigate('/import-wallet')}
                className="w-full mt-3 min-h-11 text-rowan-muted text-sm"
              >
                Import a different wallet
              </button>
            </>
          ) : (
            <>
              <h2 className="text-rowan-text text-xl font-bold mb-2">Get started</h2>
              <p className="text-rowan-muted text-sm mb-6">
                Create a new Stellar wallet in the browser, or import one you already use.
              </p>
              {walletError && <p className="text-rowan-red text-sm mb-4">{walletError}</p>}
              <button
                type="button"
                onClick={() => navigate('/wallet-setup')}
                className="w-full min-h-12 rounded-xl bg-rowan-green text-white font-semibold inline-flex items-center justify-center gap-2"
              >
                Create wallet
                <ArrowRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/import-wallet')}
                className="w-full mt-3 min-h-11 rounded-xl border border-rowan-border text-rowan-text font-medium"
              >
                Import wallet
              </button>
            </>
          )}
        </div>
      </div>

      <WalletTwoFactorLoginModal
        isVisible={show2faModal}
        userId={tempUserId}
        onSuccess={handleWalletAfter2FA}
        onCancel={() => {
          setShow2faModal(false)
          setTempUserId(null)
          setWalletError('Authentication cancelled. Please try again.')
        }}
      />
    </div>
  )
}
