import { LockKeyhole, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequest, confirmRequest } from '../api/trader';
import { useSocket } from '../context/SocketContext';
import { useCountdown } from '../hooks/useCountdown';
import { formatCurrency, formatAddress } from '../utils/format';
import { NETWORKS, TX_STATES } from '../utils/constants';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmPayoutModal from '../components/modals/ConfirmPayoutModal';

const STEPS = ['Escrow Funded', 'Payout Sent', 'Complete'];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={label} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div
                  className={`h-0.5 flex-1 ${done ? 'bg-rowan-green' : 'bg-rowan-border'}`}
                />
              )}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  done
                    ? 'bg-rowan-green text-rowan-bg'
                    : active
                    ? 'border-2 border-rowan-yellow text-rowan-yellow'
                    : 'border border-rowan-border text-rowan-muted'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${done ? 'bg-rowan-green' : 'bg-rowan-border'}`}
                />
              )}
            </div>
            <span
              className={`text-[10px] mt-1 ${
                done ? 'text-rowan-green' : active ? 'text-rowan-yellow' : 'text-rowan-muted'
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SlaCountdown({ expiresAt }) {
  const { formattedTime, isExpired } = useCountdown({ endTime: expiresAt });
  return (
    <div
      className={`text-center py-2 rounded-lg text-sm font-mono ${
        isExpired
          ? 'bg-rowan-red/15 text-rowan-red'
          : 'bg-rowan-yellow/10 text-rowan-yellow'
      }`}
    >
      {isExpired ? 'SLA Expired' : `SLA Countdown: ${formattedTime}`}
    </div>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { on, off } = useSocket();

  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [revealTimer, setRevealTimer] = useState(null);

  const fetchTx = useCallback(async () => {
    try {
      const { data } = await getRequest(id);
      setTx(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTx();
  }, [fetchTx]);

  // Listen for real-time updates
  useEffect(() => {
    const handleUpdate = (payload) => {
      if (payload?.id === id || payload?.request_id === id) {
        fetchTx();
      }
    };
    on('transaction_update', handleUpdate);
    return () => off('transaction_update', handleUpdate);
  }, [id, on, off, fetchTx]);

  // Reveal phone auto-hide after 30s
  const handleReveal = () => {
    setPhoneRevealed(true);
    if (revealTimer) clearTimeout(revealTimer);
    const timer = setTimeout(() => setPhoneRevealed(false), 30000);
    setRevealTimer(timer);
  };

  useEffect(() => {
    return () => {
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [revealTimer]);

  // Determine step from state
  const getStep = () => {
    if (!tx) return 0;
    const state = tx.state || tx.status;
    if (state === 'completed' || state === 'released') return 3;
    if (state === 'payout_confirmed' || state === 'releasing') return 2;
    if (state === 'accepted' || state === 'in_progress') return 1;
    return 0;
  };

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={28} className="text-rowan-yellow" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rowan-bg min-h-screen px-4 pt-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted text-sm mb-4">
          ← Back
        </button>
        <div className="bg-rowan-red/10 rounded-xl p-4 text-rowan-red text-sm">{error}</div>
      </div>
    );
  }

  const network = NETWORKS[tx.network] || {};
  const step = getStep();
  const isPayoutStep = step === 1;
  const isComplete = step >= 3;

  return (
    <div className="bg-rowan-bg min-h-screen px-4 pt-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg flex-1">Request Detail</h1>
        <Badge type="status" value={tx.state || tx.status} />
      </div>

      {/* USDC Escrow Banner */}
      <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-3 mb-4 flex items-center gap-2">
        <LockKeyhole size={20} className="text-rowan-green" />
        <div>
          <span className="text-rowan-green text-xs font-medium">USDC Escrowed on Stellar</span>
          {tx.escrow_address && (
            <p className="text-rowan-muted text-[10px] mt-0.5 font-mono">
              {formatAddress(tx.escrow_address)}
            </p>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* SLA Countdown */}
      {tx.sla_expires_at && !isComplete && (
        <div className="mb-4">
          <SlaCountdown expiresAt={tx.sla_expires_at} />
        </div>
      )}

      {/* Transaction Summary */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-rowan-muted text-xs">Network</span>
          <Badge type="network" value={tx.network} />
        </div>
        <div className="flex justify-between">
          <span className="text-rowan-muted text-xs">Fiat Amount</span>
          <span className="text-rowan-text text-sm font-semibold">
            {formatCurrency(tx.fiat_amount, tx.fiat_currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-rowan-muted text-xs">XLM Amount</span>
          <span className="text-rowan-text text-sm font-mono">
            {parseFloat(tx.xlm_amount || 0).toFixed(2)} XLM
          </span>
        </div>
        {tx.rate && (
          <div className="flex justify-between">
            <span className="text-rowan-muted text-xs">Rate</span>
            <span className="text-rowan-text text-sm">
              1 XLM = {formatCurrency(tx.rate, tx.fiat_currency)}
            </span>
          </div>
        )}
        {tx.fee && (
          <div className="flex justify-between">
            <span className="text-rowan-muted text-xs">Fee</span>
            <span className="text-rowan-muted text-sm">
              {formatCurrency(tx.fee, tx.fiat_currency)}
            </span>
          </div>
        )}
      </div>

      {/* Payout Instructions */}
      {isPayoutStep && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4">
          <h3 className="text-rowan-yellow text-xs font-semibold mb-3 uppercase tracking-wider">
            Payout Instructions
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-rowan-muted text-xs">Recipient</span>
              <span className="text-rowan-text text-sm">{tx.recipient_name || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rowan-muted text-xs">Phone</span>
              {phoneRevealed ? (
                <span className="text-rowan-text text-sm font-mono">{tx.recipient_phone}</span>
              ) : (
                <button
                  onClick={handleReveal}
                  className="text-rowan-yellow text-xs font-medium underline"
                >
                  Reveal Number
                </button>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-rowan-muted text-xs">Network</span>
              <span className="text-rowan-text text-sm">{network.label || tx.network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rowan-muted text-xs">Send Exactly</span>
              <span className="text-rowan-green text-sm font-bold">
                {formatCurrency(tx.fiat_amount, tx.fiat_currency)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payout Button */}
      {isPayoutStep && (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => setShowConfirm(true)}
        >
          Confirm Payout Sent
        </Button>
      )}

      {/* Complete state */}
      {isComplete && (
        <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4 text-center">
          <CheckCircle2 size={36} className="text-rowan-green block mx-auto mb-2" />
          <p className="text-rowan-green text-sm font-medium">Transaction Complete</p>
          {tx.stellar_tx_hash && (
            <p className="text-rowan-muted text-[10px] font-mono mt-1 break-all">
              {tx.stellar_tx_hash}
            </p>
          )}
        </div>
      )}

      {/* Confirm Payout Modal */}
      <ConfirmPayoutModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        request={tx}
      />
    </div>
  );
}
