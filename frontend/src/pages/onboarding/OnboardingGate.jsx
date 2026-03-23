import { useState, useEffect, useCallback } from 'react';
import { getOnboardingStatus } from '../../api/onboarding';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OnboardingWizard from './OnboardingWizard';

/**
 * OnboardingGate — wraps authenticated routes.
 * If onboarding status is NOT 'VERIFIED', shows the OnboardingWizard.
 * If 'VERIFIED', renders children (the requested dashboard route).
 */
export default function OnboardingGate({ children }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const data = await getOnboardingStatus();
      setStatus(data.status || data);
    } catch {
      /* On error (e.g. endpoint not yet deployed), let trader through */
      setStatus('VERIFIED');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} className="text-rowan-yellow" />
      </div>
    );
  }

  if (status !== 'VERIFIED') {
    return <OnboardingWizard />;
  }

  return children;
}
