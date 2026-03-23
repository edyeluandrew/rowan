import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Lock, Smartphone } from 'lucide-react'
import { getPreference, setPreference } from '../utils/storage'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const slides = [
  {
    Icon: Star,
    title: 'ROWAN',
    titleClass: 'text-rowan-yellow text-4xl font-bold tracking-widest text-center',
    subtitle: 'Cash out XLM to mobile money instantly',
  },
  {
    Icon: Lock,
    title: 'Your wallet, your keys',
    titleClass: 'text-rowan-text text-2xl font-bold text-center',
    subtitle: 'Private key never leaves your device. We never hold your funds',
  },
  {
    Icon: Smartphone,
    title: 'MTN MoMo, M-Pesa, Airtel and more',
    titleClass: 'text-rowan-text text-2xl font-bold text-center',
    subtitle: 'Cash out to any mobile money network across East Africa',
  },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const complete = await getPreference('rowan_onboarding_complete')
      if (!cancelled && complete === 'true') {
        navigate('/wallet-setup', { replace: true })
      } else if (!cancelled) {
        setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [navigate])

  const handleGetStarted = async () => {
    await setPreference('rowan_onboarding_complete', 'true')
    navigate('/wallet-setup')
  }

  if (checking) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  const slide = slides[currentSlide]
  const isLast = currentSlide === slides.length - 1

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <slide.Icon size={64} className="text-rowan-yellow mx-auto" />
        <h1 className={`${slide.titleClass} mt-8`}>{slide.title}</h1>
        <p className="text-rowan-muted text-sm text-center mt-3 px-8">{slide.subtitle}</p>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === currentSlide ? 'bg-rowan-yellow' : 'bg-rowan-border'
            }`}
          />
        ))}
      </div>

      <div className="px-6 pb-8">
        {isLast ? (
          <Button onClick={handleGetStarted}>Get Started</Button>
        ) : (
          <Button onClick={() => setCurrentSlide((s) => s + 1)}>Next</Button>
        )}
      </div>
    </div>
  )
}
