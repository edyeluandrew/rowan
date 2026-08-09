import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function SplashScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-rowan-bg flex flex-col items-center justify-center px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,rgba(18,184,26,0.12),transparent_60%)]"
        aria-hidden
      />
      <p className="relative font-serif text-5xl sm:text-6xl text-rowan-green tracking-tight">
        Rowan
      </p>
      <div className="relative flex items-center gap-2 mt-6 text-rowan-muted">
        <RefreshCw size={14} className="animate-spin text-rowan-green" />
        <p className="text-sm font-sans">Loading{dots}</p>
      </div>
    </div>
  );
}
