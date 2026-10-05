import { useState, useEffect } from 'react';
import RowanLogo from './components/RowanLogo';

/**
 * SplashScreen — shown while AuthContext bootstraps from secure storage.
 */
export default function SplashScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    console.log('[SplashScreen] 🚀 Mounted - app is alive and rendering');
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-rowan-bg">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_45%,rgba(240,185,11,0.12),transparent_60%)]"
        aria-hidden="true"
      />
      <RowanLogo size={56} withWordmark={false} className="relative" />
      <p className="relative mt-5 text-2xl font-bold tracking-tight text-rowan-green">Rowan</p>
      <p className="relative mt-1.5 h-5 text-sm text-rowan-muted">Loading{dots}</p>
    </div>
  );
}
