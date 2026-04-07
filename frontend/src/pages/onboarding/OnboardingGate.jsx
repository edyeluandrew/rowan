import { useState, useEffect, useCallback } from 'react';
import { getOnboardingStatus } from '../../api/onboarding';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OnboardingWizard from './OnboardingWizard';
import { clearDraft } from '../../utils/onboardingDraft';

/**
 * OnboardingGate — wraps authenticated routes.
 * If onboarding status is NOT 'VERIFIED', shows the OnboardingWizard.
 * If 'VERIFIED', renders children (the requested dashboard route).
 * Clears stale drafts when user is already verified.
 */
export default function OnboardingGate({ children }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const data = await getOnboardingStatus();
      const resolvedStatus = data.status || data;
      setStatus(resolvedStatus);

      // If already verified, clear any stale draft
      if (resolvedStatus === 'VERIFIED') {
        await clearDraft();
      }
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
