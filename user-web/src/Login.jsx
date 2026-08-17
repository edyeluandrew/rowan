/**
 * Public landing page for https://rowanpay.app/
 * Hero → rails → how it works → features → bills → security → coverage → FAQ → CTA → footer.
 * Also the wallet entry point (create / open / import).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, ShieldCheck, Zap, Smartphone } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { getSecure } from './shared/utils/storage'
import { formatAddress } from './wallet/utils/format'
import WalletTwoFactorLoginModal from './wallet/pages/WalletTwoFactorLoginModal'
import { TrustLine } from './wallet/components/onboarding/OnboardingBits'
import LandingStoryVisual from './components/LandingStoryVisual'
import SiteHeader from './components/landing/SiteHeader'
import Reveal from './components/landing/Reveal'
import {
  RailsStrip,
  HowItWorks,
  Features,
  BillsSection,
  Security,
  Coverage,
  Faq,
  FaqJsonLd,
  SiteFooter,
} from './components/landing/Sections'

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

  const primaryAction = () => {
    if (storedPublicKey) return handleOpenWallet()
    return navigate('/wallet-setup')
  }
  const primaryLabel = storedPublicKey ? 'Open wallet' : 'Get started'

  return (
    <div className="relative min-h-[100dvh] bg-rowan-bg text-rowan-text">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(18,184,26,0.14),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_100%,rgba(18,184,26,0.06),transparent_45%)]"
        aria-hidden="true"
      />

      <div className="relative">
        <SiteHeader ctaLabel={primaryLabel} onCta={primaryAction} />

        <main>
          {/* —— Hero —— */}
          <section className="pt-8 pb-14 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24" aria-labelledby="rowan-hero-heading">
            <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
              <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
                <div>
                  <Reveal>
                    <p className="inline-flex items-center gap-2 rounded-full border border-rowan-green/30 bg-rowan-mint px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-rowan-green-dark font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-rowan-green animate-pulse" aria-hidden="true" />
                      Live in Uganda
                    </p>
                  </Reveal>

                  <Reveal delay={80}>
                    <h1
                      id="rowan-hero-heading"
                      className="mt-5 font-serif text-[2rem] leading-[1.15] sm:text-[2.6rem] lg:text-[3.1rem] text-rowan-text"
                    >
                      Payment and liquidity infrastructure for Africa
                    </h1>
                  </Reveal>

                  <Reveal delay={140}>
                    <p className="mt-4 max-w-lg text-base sm:text-lg text-rowan-muted font-sans leading-relaxed">
                      Buy and sell USDC with local traders on MTN or Airtel, and spend on airtime, data and bills.
                      Escrow protected, in one wallet.
                    </p>
                  </Reveal>

                  <Reveal delay={200}>
                    <div className="mt-7 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={primaryAction}
                        disabled={walletLoading}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rowan-green px-6 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(18,184,26,0.28)] transition active:scale-[0.99] disabled:opacity-60"
                      >
                        {walletLoading ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
                            Opening…
                          </>
                        ) : (
                          <>
                            {primaryLabel}
                            <ArrowRight size={18} aria-hidden="true" />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/import-wallet')}
                        className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-rowan-border bg-white px-6 text-sm font-medium text-rowan-text transition hover:bg-rowan-mint/50 font-sans"
                      >
                        {storedPublicKey ? 'Use a different wallet' : 'I already have a wallet'}
                      </button>
                    </div>
                  </Reveal>

                  {storedPublicKey && (
                    <p className="mt-4 inline-block font-mono text-xs text-rowan-text bg-rowan-mint rounded-xl px-3 py-2">
                      {formatAddress(storedPublicKey)}
                    </p>
                  )}

                  {walletError && (
                    <p className="mt-3 text-sm text-rowan-red" role="alert">{walletError}</p>
                  )}

                  <Reveal delay={260}>
                    <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 list-none p-0 m-0">
                      {[
                        { Icon: ShieldCheck, label: 'Escrow protected' },
                        { Icon: Zap, label: 'Payouts in minutes' },
                        { Icon: Smartphone, label: 'MTN & Airtel' },
                      ].map(({ Icon, label }) => (
                        <li key={label} className="flex items-center gap-2">
                          <Icon size={15} className="text-rowan-green" aria-hidden="true" />
                          <span className="text-xs sm:text-sm text-rowan-muted font-sans">{label}</span>
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                </div>

                <Reveal className="flex justify-center lg:justify-end" delay={120}>
                  <LandingStoryVisual />
                </Reveal>
              </div>
            </div>
          </section>

          <RailsStrip />
          <HowItWorks />
          <Features />
          <BillsSection />
          <Security />
          <Coverage />
          <Faq />

          {/* —— Closing CTA —— */}
          <section className="py-16 sm:py-20 lg:py-24" aria-labelledby="rowan-cta-heading">
            <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
              <Reveal>
                <div className="relative overflow-hidden rounded-3xl border border-rowan-green/25 bg-rowan-mint px-6 py-10 sm:px-10 sm:py-14 text-center">
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(18,184,26,0.18),transparent_60%)]"
                    aria-hidden="true"
                  />
                  <div className="relative mx-auto max-w-xl">
                    <h2 id="rowan-cta-heading" className="font-serif text-2xl sm:text-3xl lg:text-[2.1rem] text-rowan-text leading-snug">
                      {storedPublicKey ? 'Your wallet is ready' : 'Create your wallet in about a minute'}
                    </h2>
                    <p className="mt-3 text-sm sm:text-base text-rowan-muted font-sans leading-relaxed">
                      {storedPublicKey
                        ? 'Pick up where you left off. Everything stays on this device.'
                        : 'Free to create, no paperwork to start, and your keys never leave your device.'}
                    </p>

                    <div className="mt-7 flex flex-col sm:flex-row sm:justify-center gap-3">
                      <button
                        type="button"
                        onClick={primaryAction}
                        disabled={walletLoading}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rowan-green px-7 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(18,184,26,0.28)] transition active:scale-[0.99] disabled:opacity-60"
                      >
                        {primaryLabel}
                        <ArrowRight size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/import-wallet')}
                        className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-rowan-border bg-white px-7 text-sm font-medium text-rowan-text transition hover:bg-white/70 font-sans"
                      >
                        Import a wallet
                      </button>
                    </div>

                    <div className="mt-7">
                      <TrustLine />
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>

      <FaqJsonLd />

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
