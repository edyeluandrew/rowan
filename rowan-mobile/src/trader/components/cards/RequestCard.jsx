import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import Badge from '../ui/Badge';
import CountdownTimer from '../ui/CountdownTimer';
import Button from '../ui/Button';
import { formatCurrency } from '../../utils/format';
import { acceptRequest, declineRequest } from '../../api/trader';
import { useState } from 'react';

export default function RequestCard({ request, onRemove }) {
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptRequest(request.id);
      navigate(`/trader/requests/${request.id}`);
    } catch (err) {
      // Most common cause: request expired or was re-matched (HTTP 409/404).
      // Drop the card from the list instead of leaving a stale entry.
      const msg = err?.message || 'Could not accept request';
      const expired = /expired|already|not found|wrong state/i.test(msg);
      if (expired) {
        onRemove?.(request.id);
      }
      alert(expired ? 'This request expired or was already accepted.' : msg);
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await declineRequest(request.id);
      onRemove?.(request.id);
    } catch (err) {
      const msg = err?.message || 'Could not decline request';
      const expired = /expired|already|not found|declinable/i.test(msg);
      if (expired) {
        onRemove?.(request.id);
      } else {
        alert(msg);
      }
      setDeclining(false);
      setShowDeclineConfirm(false);
    }
  };

  const txRef = request.reference || request.id?.slice?.(0, 8) || '';

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-md p-4 mb-3 animate-slide-down">
      {/* Row 1: Network + Ref */}
      <div className="flex justify-between items-center">
        <Badge type="network" value={request.network} />
        <span className="text-rowan-muted text-xs font-mono">{txRef}</span>
      </div>

      {/* Row 2: Fiat + XLM */}
      <div className="mt-3">
        <div className="text-rowan-text text-2xl font-bold tabular-nums">
          {formatCurrency(request.fiat_amount, request.fiat_currency)}
        </div>
        <div className="text-rowan-muted text-xs">
          {formatCurrency(request.xlm_amount, 'XLM')} XLM
        </div>
      </div>

      {/* Row 3: USDC locked */}
      <div className="mt-3">
        <span className="inline-flex items-center gap-1.5 border border-rowan-yellow rounded px-3 py-1.5 text-rowan-yellow text-sm font-bold">
          <LockKeyhole size={14} className="inline" /> {formatCurrency(request.usdc_amount, 'USDC')} IN ESCROW
        </span>
      </div>

      {/* Row 4: Timer + Actions */}
      <div className="mt-3 flex justify-between items-center">
        <CountdownTimer endTime={request.accept_deadline || request.expires_at} />
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            fullWidth={false}
            loading={accepting}
            onClick={handleAccept}
            className="px-5"
          >
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            fullWidth={false}
            onClick={() => setShowDeclineConfirm(true)}
            className="border-rowan-red text-rowan-red px-5"
          >
            Decline
          </Button>
        </div>
      </div>

      {/* Decline confirmation bottom sheet */}
      {showDeclineConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowDeclineConfirm(false)}>
          <div className="bg-rowan-surface rounded-t-2xl p-6 w-full" onClick={(e) => e.stopPropagation()}>
            <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6" />
            <h3 className="text-rowan-text font-bold text-lg mb-2">Decline Request?</h3>
            <p className="text-rowan-muted text-sm mb-6">
              This request will be reassigned to another trader. Frequent declines may affect your trust score.
            </p>
            <div className="flex flex-col gap-3">
              <Button variant="danger" loading={declining} onClick={handleDecline}>
                Yes, Decline
              </Button>
              <Button variant="ghost" onClick={() => setShowDeclineConfirm(false)} className="text-rowan-muted border-rowan-border">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
