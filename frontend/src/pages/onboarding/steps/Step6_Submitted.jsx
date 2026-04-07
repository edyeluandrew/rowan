import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getOnboardingStatus } from '../../../api/onboarding';
import { ONBOARDING_VERIFIED_REDIRECT_MS } from '../../../utils/constants';

/**
 * Step6_Submitted — Application submitted confirmation screen.
 * No step indicator, no back button.
 */
export default function Step6_Submitted() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);
  const [isVerified, setIsVerified] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const data = await getOnboardingStatus();
      const status = data.status || data;
      if (status === 'VERIFIED') {
        setIsVerified(true);
        setMessage('You have been verified!');
        setTimeout(() => navigate('/home', { replace: true }), ONBOARDING_VERIFIED_REDIRECT_MS);
      } else {
        setMessage('No update yet — your application is still being reviewed.');
      }
    } catch {
      setMessage('Failed to check status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      {/* Envelope icon */}
      <MailCheck size={56} className="text-rowan-yellow animate-bounce" />

      <h2 className="text-rowan-text text-2xl font-bold mt-6">Application Submitted</h2>
      <p className="text-rowan-muted text-sm text-center mt-2 px-8">
        Your application is under review. We'll notify you within 24-48 hours. Do not close the app — you'll receive a notification when your status changes.
      </p>

      {/* Status timeline */}
      <div className="bg-rowan-surface border border-rowan-border rounded-md p-4 mt-8 w-full">
        {/* Submitted */}
        <div className="flex items-center gap-3 py-3 border-b border-rowan-border">
          <div className="w-5 h-5 rounded-full bg-rowan-green flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-rowan-text text-sm flex-1">Submitted</span>
          <span className="bg-rowan-green/15 text-rowan-green text-xs px-2 py-0.5 rounded">Done</span>
        </div>

        {/* Under Review */}
        <div className="flex items-center gap-3 py-3 border-b border-rowan-border">
          <div className="w-5 h-5 rounded-full border-2 border-rowan-yellow flex items-center justify-center shrink-0">
            <div className="w-2 h-2 rounded-full bg-rowan-yellow animate-pulse" />
          </div>
          <span className="text-rowan-text text-sm flex-1">Under Review</span>
          <span className="bg-rowan-yellow/15 text-rowan-yellow text-xs px-2 py-0.5 rounded">In Progress</span>
        </div>

        {/* Verified */}
        <div className="flex items-center gap-3 py-3">
          <div className="w-5 h-5 rounded-full border border-rowan-border shrink-0" />
          <span className="text-rowan-muted text-sm flex-1">Verified</span>
          <span className="bg-rowan-border/30 text-rowan-muted text-xs px-2 py-0.5 rounded">Waiting</span>
        </div>
      </div>

      {/* What happens next */}
      <div className="mt-6 w-full">
        <h3 className="text-rowan-text font-semibold text-sm mb-3">What happens next</h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="text-rowan-yellow font-bold text-sm shrink-0">1.</span>
            <span className="text-rowan-muted text-sm">Our team reviews your documents (24-48 hours)</span>
          </div>
          <div className="flex gap-3">
            <span className="text-rowan-yellow font-bold text-sm shrink-0">2.</span>
            <span className="text-rowan-muted text-sm">You receive a notification when verified</span>
          </div>
          <div className="flex gap-3">
            <span className="text-rowan-yellow font-bold text-sm shrink-0">3.</span>
            <span className="text-rowan-muted text-sm">You can start receiving cash-out requests immediately after verification</span>
          </div>
        </div>
      </div>

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={checking}
        className="w-full mt-8 py-3 rounded-md border border-rowan-yellow text-rowan-yellow text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {checking && (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        )}
        Refresh Status
      </button>

      {message && (
        <p className={`text-sm text-center mt-3 ${isVerified ? 'text-rowan-green' : 'text-rowan-muted'}`}>
          {message}
        </p>
      )}

      {/* Logout link */}
      <button
        onClick={handleLogout}
        className="text-rowan-muted text-xs underline text-center mt-6"
      >
        Not your account? Log out
      </button>
    </div>
  );
}
