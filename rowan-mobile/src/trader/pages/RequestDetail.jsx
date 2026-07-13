import { LockKeyhole, ChevronLeft, Copy, CopyCheck } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequest, confirmRequest, confirmFiatReceived, verifyUsdcLock, acceptRequest } from '../api/trader';
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
import LockUsdcButton from '../components/wallet/LockUsdcButton';
import { isManualP2pTransaction } from '../../wallet/utils/transactions';

const SELL_STEPS = ['USDC in escrow', 'Send fiat', 'Get USDC'];
const BUY_STEPS = ['Lock USDC', 'Customer pays MoMo', 'Confirm MoMo', 'Done'];

function StepIndicator({ currentStep, steps = SELL_STEPS }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((label, i) => {
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
              {i < steps.length - 1 && (
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
  const [verifyingUsdc, setVerifyingUsdc] = useState(false);
  const [usdcVerifyMsg, setUsdcVerifyMsg] = useState(null);
  const [accepting, setAccepting] = useState(false);

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
    on('user_sent_payment', handleUpdate);
    return () => {
      off('transaction_update', handleUpdate);
      off('tx_update', handleUpdate);
      off('tx_complete', handleUpdate);
      off('user_sent_payment', handleUpdate);
    };
  }, [id, on, off, fetchTx]);

  const txState = (tx?.state || tx?.status || '').toUpperCase();
  // Trust DB order_side only. Manual USDC cash-outs also have preferred_payout_setting_id
  // + usdc_amount — the old heuristic wrongly treated those as BUY and hid "I have sent fiat".
  const isBuyOrderEarly = tx && String(tx.order_side || tx.orderSide || 'SELL').toUpperCase() === 'BUY';

  useEffect(() => {
    if (!tx || !isBuyOrderEarly) return undefined;
    if (!['ESCROW_LOCKED', 'FIAT_PAYOUT_SUBMITTED'].includes(txState)) return undefined;
    const timer = setInterval(() => { fetchTx(); }, 4000);
    return () => clearInterval(timer);
  }, [tx, txState, isBuyOrderEarly, fetchTx]);

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
  const getStep = (forBuy = false) => {
    if (!tx) return 0;
    const state = (tx.state || tx.status || '').toUpperCase();
    if (['DISPUTE_OPENED', 'DISPUTE_RELEASE_PENDING', 'DISPUTE_REFUND_PENDING'].includes(state)) {
      return state === 'DISPUTE_RELEASE_PENDING' ? 3 : 2;
    }
    if (state === 'COMPLETE') return forBuy ? 4 : 3;

    if (forBuy) {
      if (state === 'FIAT_PAYOUT_SUBMITTED' || state === 'USER_CONFIRMATION_PENDING') return 2;
      if (state === 'ESCROW_LOCKED') return 1;
      if (state === 'TRADER_MATCHED') return 0;
      return 0;
    }

    if (state === 'FIAT_PAYOUT_SUBMITTED' || state === 'USER_CONFIRMATION_PENDING') return 2;
    if (state === 'TRADER_MATCHED') return 1;
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
  const step = getStep(isBuyOrderEarly);
  const isBuyOrder = isBuyOrderEarly;
  const isPayoutStep = !isBuyOrder && ['TRADER_MATCHED'].includes(txState);
  const isBuyLockStep = isBuyOrder && txState === 'TRADER_MATCHED' && !!tx.matched_at;
  const isBuyConfirmStep = isBuyOrder && txState === 'FIAT_PAYOUT_SUBMITTED';
  const isBuyWaitingCustomer = isBuyOrder && txState === 'ESCROW_LOCKED';
  const isAwaitingConfirmation = step === 2;
  const isComplete = isBuyOrder ? step >= 4 : step >= 3;
  const buyEscrowLocked = isBuyOrder && ['ESCROW_LOCKED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING', 'COMPLETE'].includes(txState);

  const handleConfirmBuyReceived = async () => {
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
  };

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
        <Badge type="status" value={txState || tx.state || tx.status} />
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

      {/* Order type banner */}
      <div
        className={`rounded-xl p-3 mb-4 border ${
          isBuyOrder
            ? 'bg-rowan-yellow/10 border-rowan-yellow/30'
            : 'bg-rowan-green/10 border-rowan-green/30'
        }`}
      >
        <p className={`text-sm font-semibold ${isBuyOrder ? 'text-rowan-yellow' : 'text-rowan-green'}`}>
          {isBuyOrder ? 'Customer buying USDC' : 'Customer selling USDC'}
        </p>
        <p className="text-rowan-muted text-xs mt-1">
          {isBuyOrder
            ? 'You lock USDC in escrow. Customer sends you mobile money. Then you confirm MoMo → USDC goes to them.'
            : 'Customer USDC is already in escrow. You send them mobile money (fiat). When they confirm → escrow releases USDC to your Rowan wallet.'}
        </p>
      </div>

      {/* USDC escrow / lock banner */}
      {isBuyLockStep ? (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-3 mb-4 flex items-center gap-2">
          <LockKeyhole size={20} className="text-rowan-yellow" />
          <div>
            <span className="text-rowan-yellow text-xs font-medium">Your turn: lock USDC in escrow</span>
            <p className="text-rowan-muted text-[10px] mt-0.5">
              Send USDC from your Rowan wallet (not fiat yet).
            </p>
          </div>
        </div>
      ) : (buyEscrowLocked || !isBuyOrder) ? (
        <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-3 mb-4 flex items-center gap-2">
          <LockKeyhole size={20} className="text-rowan-green" />
          <div>
            <span className="text-rowan-green text-xs font-medium">
              {isBuyOrder ? 'Your USDC is locked in escrow' : 'Customer USDC is in escrow'}
            </span>
            {tx.escrow_address && (
              <p className="text-rowan-muted text-[10px] mt-0.5 font-mono">
                {formatAddress(tx.escrow_address)}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Step indicator */}
      <StepIndicator currentStep={step} steps={isBuyOrder ? BUY_STEPS : SELL_STEPS} />

      {/* Payment window countdown */}
      {(tx.payment_expires_at || tx.sla_expires_at) && !isComplete && step <= 1 && (
        <div className="mb-4">
          <SlaCountdown expiresAt={tx.payment_expires_at || tx.sla_expires_at} />
        </div>
      )}

      {/* Sell: waiting until matched / accepted */}
      {!isBuyOrder && txState === 'ESCROW_LOCKED' && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4">
          <p className="text-rowan-yellow text-sm font-semibold">Accept this request to send fiat</p>
          <p className="text-rowan-muted text-xs mt-1">
            Customer USDC is in escrow. After you accept, you&apos;ll see their MoMo details and the <strong className="text-rowan-text">I have sent fiat</strong> button.
          </p>
          <Button
            className="mt-3"
            loading={accepting}
            onClick={async () => {
              setAccepting(true);
              try {
                await acceptRequest(tx.id);
                await fetchTx();
                refresh();
              } catch (err) {
                alert(err.response?.data?.error || err.message || 'Could not accept');
              } finally {
                setAccepting(false);
              }
            }}
          >
            Accept request
          </Button>
        </div>
      )}

      {/* Buy order actions — above chat so trader sees next step immediately */}
      {isBuyLockStep && (
        <div className="bg-rowan-surface border border-rowan-yellow/40 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-rowan-yellow text-xs font-semibold uppercase">Step 1: Lock USDC in escrow</h3>
          <p className="text-rowan-muted text-xs">
            Send exactly <strong className="text-rowan-text">{Number(tx.usdc_amount).toFixed(4)} USDC</strong> from your <strong className="text-rowan-text">Rowan wallet</strong> below — no Freighter or external app needed.
          </p>
          <LockUsdcButton
            tx={tx}
            onLocked={async () => {
              setUsdcVerifyMsg(null);
              try {
                const result = await verifyUsdcLock(tx.id);
                if (result.status === 'locked' || result.status === 'already_locked') {
                  setUsdcVerifyMsg({ type: 'ok', text: 'USDC locked! Customer can now pay you.' });
                  await fetchTx();
                  refresh();
                } else if (result.status === 'wrong_sender') {
                  setUsdcVerifyMsg({ type: 'error', text: result.message });
                } else {
                  setUsdcVerifyMsg({
                    type: 'ok',
                    text: 'USDC sent! Wait ~30 seconds, then tap "I\'ve sent USDC — check now" if it does not update automatically.',
                  });
                }
              } catch (err) {
                setUsdcVerifyMsg({ type: 'error', text: err.response?.data?.error || 'Sent — tap check now below' });
              }
            }}
            onError={(msg) => setUsdcVerifyMsg({ type: 'error', text: msg })}
          />
          <p className="text-rowan-muted text-[10px] text-center">— or send manually —</p>
          <p className="text-rowan-text text-xs font-mono break-all bg-rowan-bg rounded-lg p-2">{tx.escrow_address || 'Escrow address'}</p>
          <p className="text-rowan-muted text-xs">Memo: <span className="text-rowan-text font-mono">{tx.escrow_memo}</span></p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 border border-rowan-border"
              onClick={() => {
                navigator.clipboard.writeText(tx.escrow_address || '');
                alert('Escrow address copied');
              }}
            >
              Copy address
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 border border-rowan-border"
              onClick={() => {
                navigator.clipboard.writeText(tx.escrow_memo || '');
                alert('Memo copied');
              }}
            >
              Copy memo
            </Button>
          </div>
          {usdcVerifyMsg && (
            <p className={`text-xs ${usdcVerifyMsg.type === 'error' ? 'text-rowan-red' : 'text-rowan-green'}`}>
              {usdcVerifyMsg.text}
            </p>
          )}
          <Button
            loading={verifyingUsdc}
            variant="ghost"
            size="lg"
            className="border border-rowan-border"
            onClick={async () => {
              setVerifyingUsdc(true);
              setUsdcVerifyMsg(null);
              try {
                const result = await verifyUsdcLock(tx.id);
                if (result.status === 'locked' || result.status === 'already_locked') {
                  setUsdcVerifyMsg({ type: 'ok', text: 'USDC locked! Customer can now pay you.' });
                  await fetchTx();
                  refresh();
                } else {
                  setUsdcVerifyMsg({
                    type: 'error',
                    text: result.message || 'Payment not found yet — wait 30s and try again.',
                  });
                }
              } catch (err) {
                setUsdcVerifyMsg({ type: 'error', text: err.response?.data?.error || 'Could not verify USDC' });
              } finally {
                setVerifyingUsdc(false);
              }
            }}
          >
            I&apos;ve sent USDC — check now
          </Button>
        </div>
      )}

      {isBuyWaitingCustomer && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4 border border-rowan-border">
          <p className="text-rowan-text text-sm font-semibold">Step 2: Waiting for customer payment</p>
          <p className="text-rowan-muted text-xs mt-2">
            USDC is locked. The customer must pay your MoMo and tap <strong className="text-rowan-text">&quot;I&apos;ve sent payment&quot;</strong> on their wallet app.
          </p>
          <p className="text-rowan-yellow text-xs mt-2">
            The <strong>I have received payment</strong> button appears here only after they do that.
          </p>
        </div>
      )}

      {isBuyConfirmStep && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4 space-y-2 border-2 border-rowan-yellow/50">
          <p className="text-rowan-text text-sm font-semibold">Step 3: Confirm you received MoMo</p>
          <p className="text-rowan-muted text-xs">Check your mobile money balance, then tap the button below to release USDC to the customer.</p>
          {tx.payout_reference && (
            <p className="text-rowan-muted text-xs">Reference: <span className="text-rowan-text font-mono">{tx.payout_reference}</span></p>
          )}
        </div>
      )}

      {/* Order chat */}
      {(tx.state === 'REFUNDED' || tx.state === 'FAILED') && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-3 mb-4">
          <p className="text-rowan-red text-sm">This order was cancelled by the buyer.</p>
        </div>
      )}

      {!isComplete && tx.state !== 'REFUNDED' && tx.state !== 'FAILED' && (isManualP2pTransaction(tx) || isBuyOrder) && (
        <OrderChat
          transactionId={tx.id}
          txState={tx.state || tx.status}
          counterpartyName="Customer"
          viewerRole="trader"
        />
      )}

      {tx.state === 'DISPUTE_OPENED' && tx.dispute_id && (
        <DisputeEvidenceSection
          disputeId={tx.dispute_id}
          uploadEvidence={uploadTraderDisputeEvidence}
          listEvidence={listTraderDisputeEvidence}
        />
      )}

      {/* Dispute/Status Cards — sell flow only at FIAT_PAYOUT_SUBMITTED (buy uses Step 3 card above) */}
      {['FIAT_PAYOUT_SUBMITTED', 'DISPUTE_OPENED', 'DISPUTE_RELEASE_PENDING', 'DISPUTE_REFUND_PENDING', 'REFUNDED'].includes(txState)
        && !(isBuyOrder && txState === 'FIAT_PAYOUT_SUBMITTED') && (
        <div className="mb-4">
          <TraderDisputeStatusCard state={txState} data={tx} />
        </div>
      )}

      {/* Transaction Summary */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-rowan-muted text-xs">Order type</span>
          <span className={`text-xs font-semibold ${isBuyOrder ? 'text-rowan-yellow' : 'text-rowan-green'}`}>
            {isBuyOrder ? 'Buy (you sell USDC)' : 'Sell (you send fiat)'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-rowan-muted text-xs">Network</span>
          <Badge type="network" value={tx.network} />
        </div>
        <div className="flex justify-between">
          <span className="text-rowan-muted text-xs">
            {isBuyOrder ? 'Fiat you receive' : 'Fiat you send'}
          </span>
          <span className="text-rowan-text text-sm font-semibold">
            {formatCurrency(tx.fiat_amount, tx.fiat_currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-rowan-muted text-xs">
            {isBuyOrder ? 'USDC you lock' : 'USDC you receive'}
          </span>
          <span className="text-rowan-text text-sm font-mono">
            {parseFloat(tx.usdc_amount || tx.xlm_amount || 0).toFixed(4)} USDC
          </span>
        </div>
        {tx.rate && (
          <div className="flex justify-between">
            <span className="text-rowan-muted text-xs">Rate</span>
            <span className="text-rowan-text text-sm">
              1 USDC ≈ {formatCurrency(tx.rate, tx.fiat_currency)}
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

      {/* Sell: where USDC will land */}
      {!isBuyOrder && (tx.trader_stellar_address || tx.stellar_address) && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-muted text-[10px] uppercase tracking-wider mb-1">Your USDC wallet</p>
          <p className="text-rowan-text text-xs font-mono break-all">
            {tx.trader_stellar_address || tx.stellar_address}
          </p>
          <p className="text-rowan-muted text-[10px] mt-2">
            After the customer confirms MoMo, escrow releases USDC here. Manage it in Rowan Wallet.
          </p>
          <button
            type="button"
            onClick={() => navigate('/trader/wallet')}
            className="text-rowan-green text-xs font-medium mt-2 min-h-9"
          >
            Open Rowan Wallet →
          </button>
        </div>
      )}

      {/* Payout Instructions — sell / cashout only (trader sends fiat) */}
      {isPayoutStep && (
        <div className="bg-rowan-surface border-2 border-rowan-green/40 rounded-xl p-4 mb-4">
          <h3 className="text-rowan-green text-xs font-semibold mb-1 uppercase tracking-wider">
            Your turn: send mobile money
          </h3>
          <p className="text-rowan-muted text-xs mb-3">
            Do not send USDC. Pay fiat to the customer below, then tap <strong className="text-rowan-text">I have sent fiat</strong>.
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-rowan-muted text-xs mb-1">
                Send {formatCurrency(tx.fiat_amount, tx.fiat_currency)} via {network.label || tx.network} to:
              </p>
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
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tx.payout_phone);
                      alert('Phone copied!');
                    }}
                    className="text-rowan-green text-xs font-medium"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${tx.fiat_amount}`);
                  alert('Amount copied!');
                }}
                className="text-rowan-muted text-xs font-medium flex-1 py-3 min-h-11 border border-rowan-border rounded-xl"
              >
                Copy amount
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="text-rowan-bg text-xs font-semibold flex-1 py-3 min-h-11 bg-rowan-green rounded-xl"
              >
                I have sent fiat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment submitted — waiting for user */}
      {isAwaitingConfirmation && !isBuyOrder && (
        <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4 text-center mb-4">
          <p className="text-rowan-green text-sm font-medium">
            Fiat marked as sent
          </p>
          <p className="text-rowan-muted text-xs mt-1">
            Waiting for the customer to confirm they received MoMo. Then escrow releases USDC to your wallet.
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

      {isBuyConfirmStep && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-rowan-bg/95 border-t border-rowan-yellow/30 backdrop-blur-sm">
          <Button loading={confirmingBuy} size="lg" className="w-full" onClick={handleConfirmBuyReceived}>
            I received MoMo — release USDC
          </Button>
        </div>
      )}
    </div>
  );
}
