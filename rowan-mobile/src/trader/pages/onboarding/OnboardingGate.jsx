import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { getOnboardingStatus } from '../../api/onboarding';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OnboardingWizard from './OnboardingWizard';

/**
 * OnboardingGate — layout route wrapper.
 * If onboarding status is NOT 'VERIFIED', shows the OnboardingWizard.
 * If 'VERIFIED', renders child routes via Outlet.
 */
export default function OnboardingGate() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const data = await getOnboardingStatus();
      // Backend returns { verificationStatus, ready, ... }. Treat `ready === true`
      // as fully verified; otherwise surface the wizard. Fall back to legacy
      // `status` field for backwards compatibility.
      if (data?.ready === true || data?.verificationStatus === 'VERIFIED' || data?.status === 'VERIFIED') {
        setStatus('VERIFIED');
      } else {
        setStatus(data?.verificationStatus || data?.status || 'NOT_STARTED');
      }
    } catch (err) {
      // Network/auth failure — safer to send the trader through onboarding
      // than to silently let an unverified trader into the dashboard.
      console.warn('[OnboardingGate] status check failed, defaulting to wizard', err);
      setStatus('NOT_STARTED');
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

  return <Outlet />;
}
