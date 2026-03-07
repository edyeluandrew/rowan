import { useState, useEffect } from 'react';

/**
 * SplashScreen — shown while AuthContext bootstraps from secure storage.
 */
export default function SplashScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-rowan-yellow text-5xl font-bold tracking-widest">ROWAN</h1>
      <p className="text-rowan-muted text-sm mt-4 h-5">Loading{dots}</p>
    </div>
  );
}
