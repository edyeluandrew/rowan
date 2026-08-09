/**
 * Landing — responsive, simple, exquisite.
 * Desktop: brand + features | actions.
 * Mobile: stacked hero → Get started.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { getSecure } from './shared/utils/storage'
import { formatAddress } from './wallet/utils/format'
import WalletTwoFactorLoginModal from './wallet/pages/WalletTwoFactorLoginModal'
import { FeatureGrid, TrustLine } from './wallet/components/onboarding/OnboardingBits'

export default function Login() {
  const { loginWithWallet, setWalletAuthAfter2FA } = useAuth()
  const navigate = useNavigate()
  const [storedPublicKey, setStoredPublicKey] = useState(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState(null)
  const [show2faModal, setShow2faModal] = useState(false)
  const [tempUserId, setTempUserId] = useState(null)

  useEffect(() => {
    ;(async () => {
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

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-rowan-bg text-rowan-text">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_10%_0%,rgba(18,184,26,0.14),transparent_50%),radial-gradient(ellipse_70%_40%_at_100%_100%,rgba(18,184,26,0.06),transparent_45%)]"
        aria-hidden
      />

      <div className="relative mx-auto min-h-[100dvh] w-full max-w-6xl grid lg:grid-cols-2 lg:items-stretch">
        {/* Brand panel */}
        <section className="flex flex-col justify-center px-5 sm:px-8 lg:px-12 pt-10 pb-6 lg:py-16 safe-top">
          <p className="font-serif text-4xl sm:text-5xl lg:text-6xl text-rowan-green tracking-tight leading-none">
            Rowan
          </p>
          <h1 className="mt-4 sm:mt-5 font-serif text-2xl sm:text-3xl lg:text-[2.15rem] text-rowan-text leading-snug max-w-md">
            USDC that meets mobile money
          </h1>
          <p className="mt-3 text-sm sm:text-base text-rowan-muted leading-relaxed max-w-md font-sans">
            Buy and sell dollar stablecoin with MTN, Airtel, and cash out locally — escrow protected.
          </p>
          <FeatureGrid className="mt-8 sm:mt-10 max-w-md" />
        </section>

        {/* Actions panel */}
        <section className="flex items-end lg:items-center justify-center px-5 sm:px-8 lg:px-12 pb-8 pt-2 lg:py-16 safe-bottom">
          <div className="w-full max-w-md rounded-3xl bg-white border border-rowan-border shadow-[0_16px_48px_rgba(11,15,12,0.08)] p-6 sm:p-8">
            {storedPublicKey ? (
              <>
                <p className="text-xs uppercase tracking-[0.14em] text-rowan-muted font-sans mb-2">
                  Welcome back
                </p>
                <h2 className="font-serif text-2xl text-rowan-text">Open your wallet</h2>
                <p className="mt-2 text-sm text-rowan-muted font-sans">
                  A wallet is ready on this device.
                </p>
                <p className="mt-4 font-mono text-xs sm:text-sm text-rowan-text bg-rowan-mint rounded-2xl px-3.5 py-3 break-all">
                  {formatAddress(storedPublicKey)}
                </p>
                {walletError && (
                  <p className="text-rowan-red text-sm mt-3">{walletError}</p>
                )}
                <button
                  type="button"
                  disabled={walletLoading}
                  onClick={handleOpenWallet}
                  className="mt-6 w-full min-h-12 rounded-2xl bg-rowan-green text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 transition active:scale-[0.99]"
                >
                  {walletLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Opening…
                    </>
                  ) : (
                    <>
                      Open wallet
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/import-wallet')}
                  className="w-full mt-3 min-h-11 text-sm text-rowan-muted hover:text-rowan-text font-sans"
                >
                  Use a different wallet
                </button>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-[0.14em] text-rowan-muted font-sans mb-2">
                  New here?
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl text-rowan-text">Get started</h2>
                <p className="mt-2 text-sm text-rowan-muted font-sans leading-relaxed">
                  Create a free wallet in about a minute, or import one you already use on Stellar.
                </p>
                {walletError && (
                  <p className="text-rowan-red text-sm mt-3">{walletError}</p>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/wallet-setup')}
                  className="mt-6 w-full min-h-12 rounded-2xl bg-rowan-green text-white font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[0.99] shadow-[0_8px_24px_rgba(18,184,26,0.25)]"
                >
                  Get started
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/import-wallet')}
                  className="w-full mt-3 min-h-12 rounded-2xl border border-rowan-border text-rowan-text font-medium hover:bg-rowan-mint/40 transition font-sans"
                >
                  I already have a wallet
                </button>
              </>
            )}

            <div className="mt-6 pt-5 border-t border-rowan-border/70">
              <TrustLine />
            </div>
          </div>
        </section>
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
