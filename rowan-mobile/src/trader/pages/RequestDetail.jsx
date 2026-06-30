import { LockKeyhole, ChevronLeft, Copy, CopyCheck } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequest, confirmRequest, confirmFiatReceived } from '../api/trader';
import { useSocket } from '../context/SocketContext';
import { useRequests } from '../hooks/useRequests';
import { useCountdown } from '../hooks/useCountdown';
import { formatCurrency, formatAddress } from '../utils/format';
import { NETWORKS, TX_STATES, PHONE_REVEAL_TIMEOUT_MS } from '../utils/constants';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmPayoutModal from '../components/modals/ConfirmPayoutModal';
import TraderDisputeStatusCard from '../components/disputes/TraderDisputeStatusCard';
import UsdcReceiptCard from '../components/wallet/UsdcReceiptCard';
import OrderChat from '../components/chat/OrderChat';
import DisputeEvidenceSection from '../../wallet/components/disputes/DisputeEvidenceSection';
import { uploadTraderDisputeEvidence, listTraderDisputeEvidence } from '../api/disputes';
import TraderReviewModal from '../components/reviews/TraderReviewModal';
import { getTraderReviewStatus } from '../api/reviews';
import useJoinOrder from '../hooks/useJoinOrder';
import { isManualP2pTransaction } from '../../wallet/utils/transactions';

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
  const { refresh } = useRequests();

  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [revealTimer, setRevealTimer] = useState(null);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [confirmingBuy, setConfirmingBuy] = useState(false);

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

  useJoinOrder(tx && isManualP2pTransaction(tx) ? id : null);

  useEffect(() => {
    if (!tx || (tx.state !== 'COMPLETE' && tx.status !== 'COMPLETE')) return;
    let cancelled = false;
    getTraderReviewStatus(tx.id)
      .then((data) => {
        if (!cancelled && !data?.submitted) setShowReviewModal(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tx?.id, tx?.state, tx?.status]);

  // Listen for real-time updates
  useEffect(() => {
    const handleUpdate = (payload) => {
      const txId = payload?.id || payload?.transactionId || payload?.request_id;
      if (txId === id) {
        fetchTx();
      }
    };
    on('transaction_update', handleUpdate);
    on('tx_update', handleUpdate);
    on('tx_complete', handleUpdate);
    return () => {
      off('transaction_update', handleUpdate);
      off('tx_update', handleUpdate);
      off('tx_complete', handleUpdate);
    };
  }, [id, on, off, fetchTx]);

  // Reveal phone auto-hide after 30s
  const handleReveal = () => {
    setPhoneRevealed(true);
    if (revealTimer) clearTimeout(revealTimer);
    const timer = setTimeout(() => setPhoneRevealed(false), PHONE_REVEAL_TIMEOUT_MS);
    setRevealTimer(timer);
  };

  const handlePayoutSubmitted = useCallback(async () => {
    // Refresh the global pending/active lists after payout submission
    // This ensures the request moves from pending to active without bounce
    await refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [revealTimer]);

  // Determine step from state
  const getStep = () => {
    if (!tx) return 0;
    const state = (tx.state || tx.status || '').toUpperCase();
    // Dispute states don't progress in the normal step flow
    if (['DISPUTE_OPENED', 'DISPUTE_RELEASE_PENDING', 'DISPUTE_REFUND_PENDING'].includes(state)) {
      return state === 'DISPUTE_RELEASE_PENDING' ? 3 : 2; // Show dispute but don't allow payout
    }
    // Map database states to UI steps:
    // Step 3: Transaction complete
    if (state === 'COMPLETE') return 3;
    // Step 2: Payment submitted, waiting for customer confirmation (FIAT_PAYOUT_SUBMITTED, USER_CONFIRMATION_PENDING)
    if (state === 'FIAT_PAYOUT_SUBMITTED' || state === 'USER_CONFIRMATION_PENDING') return 2;
    // Step 1: Payout ready - trader matched and should send fiat
    // (includes TRADER_MATCHED state where trader is assigned)
    if (state === 'TRADER_MATCHED') return 1;
    // Step 0: Earlier states (QUOTE_CONFIRMED, ESCROW_LOCKED)
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
  const isBuyOrder = (tx.order_side || tx.orderSide) === 'BUY'
    || (Number(tx.usdc_amount) > 0 && Number(tx.xlm_amount) === 0 && !!tx.preferred_payout_setting_id);
  const isPayoutStep = step === 1 && !isBuyOrder;
  const isBuyLockStep = isBuyOrder && tx.state === 'TRADER_MATCHED' && tx.matched_at;
  const isBuyConfirmStep = isBuyOrder && tx.state === 'FIAT_PAYOUT_SUBMITTED';
  const isBuyWaitingCustomer = isBuyOrder && tx.state === 'ESCROW_LOCKED';
  const isAwaitingConfirmation = step === 2;
  const isComplete = step >= 3;
  const buyEscrowLocked = isBuyOrder && ['ESCROW_LOCKED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING', 'COMPLETE'].includes(tx.state);

  const orderShortId = tx?.id
    ? `ROW-${tx.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`
    : '';

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderShortId);
      setCopiedOrderId(true);
      setTimeout(() => setCopiedOrderId(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

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

      {orderShortId && (
        <button
          type="button"
          onClick={handleCopyOrderId}
          className="flex items-center gap-1.5 text-rowan-muted text-xs mb-4 min-h-8"
        >
          <span>Order {orderShortId}</span>
          {copiedOrderId ? <CopyCheck size={12} className="text-rowan-green" /> : <Copy size={12} />}
          {copiedOrderId && <span className="text-rowan-green text-[10px]">Copied!</span>}
        </button>
      )}

      {/* USDC escrow / lock banner */}
      {isBuyLockStep ? (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-3 mb-4 flex items-center gap-2">
          <LockKeyhole size={20} className="text-rowan-yellow" />
          <div>
            <span className="text-rowan-yellow text-xs font-medium">Lock USDC in escrow</span>
            <p className="text-rowan-muted text-[10px] mt-0.5">
              Send USDC to escrow with the memo below to continue.
            </p>
          </div>
        </div>
      ) : (buyEscrowLocked || !isBuyOrder) ? (
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
      ) : null}

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Payment window countdown */}
      {(tx.payment_expires_at || tx.sla_expires_at) && !isComplete && step <= 1 && (
        <div className="mb-4">
          <SlaCountdown expiresAt={tx.payment_expires_at || tx.sla_expires_at} />
        </div>
      )}

      {/* Buy order actions — above chat so trader sees next step immediately */}
      {isBuyLockStep && (
        <div className="bg-rowan-surface border border-rowan-yellow/40 rounded-xl p-4 mb-4 space-y-2">
          <h3 className="text-rowan-yellow text-xs font-semibold uppercase">Step 1: Lock USDC in escrow</h3>
          <p className="text-rowan-muted text-xs">Send exactly {Number(tx.usdc_amount).toFixed(4)} USDC to:</p>
          <p className="text-rowan-text text-xs font-mono break-all">{tx.escrow_address || 'Escrow address'}</p>
          <p className="text-rowan-muted text-xs">Memo: <span className="text-rowan-text font-mono">{tx.escrow_memo}</span></p>
          <p className="text-rowan-muted text-[11px] pt-1">After this, the customer gets your MoMo details and can tap &quot;I&apos;ve sent payment&quot;.</p>
        </div>
      )}

      {isBuyWaitingCustomer && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4">
          <p className="text-rowan-text text-sm font-semibold">Step 2: Waiting for customer payment</p>
          <p className="text-rowan-muted text-xs mt-2">
            USDC is locked. Customer will send mobile money to your verified {network.label || tx.network} number, then tap &quot;I&apos;ve sent payment&quot;.
          </p>
        </div>
      )}

      {isBuyConfirmStep && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4 space-y-3 border-2 border-rowan-yellow/50">
          <p className="text-rowan-text text-sm font-semibold">Step 3: Confirm you received MoMo</p>
          <p className="text-rowan-muted text-xs">Check your mobile money balance, then tap below to release USDC to the customer.</p>
          {tx.payout_reference && (
            <p className="text-rowan-muted text-xs">Reference: <span className="text-rowan-text font-mono">{tx.payout_reference}</span></p>
          )}
          <Button
            loading={confirmingBuy}
            size="lg"
            onClick={async () => {
              setConfirmingBuy(true);
              try {
                await confirmFiatReceived(tx.id);
                await fetchTx();
                refresh();
              } catch (err) {
                alert(err.response?.data?.error || 'Could not confirm');
              } finally {
                setConfirmingBuy(false);
              }
            }}
          >
            I have received payment
          </Button>
        </div>
      )}

      {/* Order chat */}
      {(tx.state === 'REFUNDED' || tx.state === 'FAILED') && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-3 mb-4">
          <p className="text-rowan-red text-sm">This order was cancelled by the buyer.</p>
        </div>
      )}

      {!isComplete && tx.state !== 'REFUNDED' && tx.state !== 'FAILED' && isManualP2pTransaction(tx) && (
        <OrderChat transactionId={tx.id} txState={tx.state || tx.status} />
      )}

      {tx.state === 'DISPUTE_OPENED' && tx.dispute_id && (
        <DisputeEvidenceSection
          disputeId={tx.dispute_id}
          uploadEvidence={uploadTraderDisputeEvidence}
          listEvidence={listTraderDisputeEvidence}
        />
      )}

      {/* Dispute/Status Cards */}
      {['FIAT_PAYOUT_SUBMITTED', 'DISPUTE_OPENED', 'DISPUTE_RELEASE_PENDING', 'DISPUTE_REFUND_PENDING', 'REFUNDED'].includes(tx.state) && (
        <div className="mb-4">
          <TraderDisputeStatusCard state={tx.state} data={tx} />
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

      {/* Payout Instructions — sell / cashout only */}
      {isPayoutStep && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4">
          <h3 className="text-rowan-yellow text-xs font-semibold mb-3 uppercase tracking-wider">
            Payout Instructions
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-rowan-muted text-xs mb-1">Send {formatCurrency(tx.fiat_amount, tx.fiat_currency)} to:</p>
            </div>
            <div className="bg-rowan-bg rounded-lg p-3 space-y-2">
              <div>
                <p className="text-rowan-muted text-xs mb-1">Recipient Name</p>
                <p className="text-rowan-text text-sm font-semibold">{tx.payout_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-rowan-muted text-xs mb-1">Phone Number</p>
                <div className="flex items-center gap-2">
                  <p className="text-rowan-text text-sm font-mono flex-1">{tx.payout_phone || 'Unknown'}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tx.payout_phone);
                      alert('Phone copied!');
                    }}
                    className="text-rowan-yellow text-xs font-medium"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${tx.fiat_amount}`);
                  alert('Amount copied!');
                }}
                className="text-rowan-yellow text-xs font-medium flex-1 py-2 border border-rowan-yellow rounded"
              >
                Copy Amount
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="text-rowan-yellow text-xs font-medium flex-1 py-2 border border-rowan-yellow rounded hover:bg-rowan-yellow/10"
              >
                I've Sent Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment submitted — waiting for user */}
      {isAwaitingConfirmation && !isBuyOrder && (
        <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4 text-center mb-4">
          <p className="text-rowan-green text-sm font-medium">
            Payment proof submitted
          </p>
          <p className="text-rowan-muted text-xs mt-1">
            Waiting for user confirmation.
          </p>
        </div>
      )}

      {/* Complete state — USDC release receipt */}
      {isComplete && (
        <UsdcReceiptCard
          tx={tx}
          onViewWallet={() => navigate('/trader/wallet')}
        />
      )}

      {/* Confirm Payout Modal */}
      <ConfirmPayoutModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        request={tx}
        onPayoutSubmitted={handlePayoutSubmitted}
      />

      {showReviewModal && isComplete && (
        <TraderReviewModal
          transactionId={tx.id}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </div>
  );
}
