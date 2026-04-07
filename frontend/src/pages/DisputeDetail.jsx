import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ShieldAlert, ArrowLeftRight, CalendarDays,
  MessageCircle, DollarSign, Signal, Radio, Landmark,
  AlertTriangle, Hourglass, Upload, ShieldCheck,
} from 'lucide-react';
import { getDispute, respondToDispute } from '../api/disputes';
import { useToast } from '../hooks/useToast';
import DisputeStatusBadge from '../components/disputes/DisputeStatusBadge';
import ProofUploader from '../components/disputes/ProofUploader';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatCurrency, formatDate, formatTimeAgo } from '../utils/format';
import Badge from '../components/ui/Badge';

export default function DisputeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success: successToast, error: errorToast } = useToast();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [proofData, setProofData] = useState({ base64: null, fileName: null, ext: null });
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDispute(id);
        setDispute(data.dispute || data);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* Countdown timer for 24h deadline */
  useEffect(() => {
    if (!dispute || dispute.status !== 'OPEN') return;
    const deadline = new Date(dispute.created_at || dispute.createdAt).getTime() + 24 * 60 * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      if (remaining <= 0) {
        setCountdown('00:00:00');
        clearInterval(timerRef.current);
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [dispute]);

  const handleSubmit = async () => {
    if (!proofData.base64) { errorToast('Missing Proof', 'Proof of payment is required'); return; }
    if (!responseText.trim()) { errorToast('Missing Response', 'Please describe the payment you made'); return; }

    setSubmitting(true);
    try {
      /* Convert base64 to File */
      const byteChars = atob(proofData.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: `image/${proofData.ext || 'jpeg'}` });
      const file = new File([blob], proofData.fileName || 'proof.jpeg', { type: blob.type });

      await respondToDispute(id, responseText.trim(), file);
      successToast('Dispute Response Submitted', 'Our team will review your response');
      setDispute((prev) => ({ ...prev, status: 'UNDER_REVIEW', traderResponse: responseText.trim(), respondedAt: new Date().toISOString() }));
    } catch (err) {
      errorToast('Submission Failed', err.response?.data?.error || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const d = dispute || {};
  const hasResponded = d.traderResponse || d.trader_response || d.respondedAt || d.responded_at;
  const isResolved = d.status === 'RESOLVED_TRADER_WIN' || d.status === 'RESOLVED_USER_WIN';

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={28} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <ShieldAlert size={20} className="text-rowan-red" />
        <h1 className="text-rowan-text font-semibold text-lg flex-1">Dispute Detail</h1>
        <DisputeStatusBadge status={d.status} />
      </div>

      <div className="px-4">
        {/* Success banner */}
        {success && (
          <div className="bg-rowan-green/15 border border-rowan-green/30 rounded-xl p-4 mt-4">
            <p className="text-rowan-green text-sm font-bold">Your response has been submitted.</p>
            <p className="text-rowan-muted text-xs mt-1">Our team will review within 24 hours.</p>
          </div>
        )}

        {/* Dispute Summary */}
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mt-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 text-rowan-muted">
              <ArrowLeftRight size={13} /> Transaction Ref
            </span>
            <span className="text-rowan-text font-mono">{d.reference || d.transaction_id || d.id}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 text-rowan-muted">
              <CalendarDays size={13} /> Date Raised
            </span>
            <span className="text-rowan-text">{formatDate(d.created_at || d.createdAt)}</span>
          </div>
          <div>
            <span className="flex items-center gap-1.5 text-rowan-muted text-xs">
              <MessageCircle size={13} /> User Claim
            </span>
            <p className="text-rowan-muted text-sm leading-relaxed mt-1">{d.reason || d.userClaim || 'No details provided'}</p>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 text-rowan-muted">
              <DollarSign size={13} /> Amount Disputed
            </span>
            <span className="text-rowan-red font-bold tabular-nums">
              {formatCurrency(d.fiat_amount || d.amount || 0, d.fiat_currency || d.currency || 'UGX')}
            </span>
          </div>
          {d.network && (
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-rowan-muted">
                {d.network?.includes('MTN') ? <Signal size={13} /> : d.network?.includes('AIRTEL') ? <Radio size={13} /> : <Landmark size={13} />}
                Network
              </span>
              <Badge type="network" value={d.network} />
            </div>
          )}
        </div>

        {/* What this means */}
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
            <p className="text-rowan-yellow text-sm">
              A user has reported they did not receive their mobile money. You must provide proof of payment within 24 hours. Failure to respond may result in account suspension.
            </p>
          </div>
        </div>

        {/* Countdown timer */}
        {d.status === 'OPEN' && countdown && (
          <div className="text-center mt-4">
            <div className="flex items-center gap-2 justify-center mb-2">
              <Hourglass size={16} className="text-rowan-muted" />
              <p className="text-rowan-muted text-xs">Respond within</p>
            </div>
            <p className="text-rowan-text text-4xl font-bold tabular-nums font-mono">
              {countdown}
            </p>
            <p className="text-rowan-muted text-xs mt-2">
              If you do not respond, the dispute will be decided against you.
            </p>
          </div>
        )}

        {/* Response form — only when OPEN and not responded */}
        {d.status === 'OPEN' && !hasResponded && !success && (
          <div className="mt-4">
            <h3 className="text-rowan-text font-bold text-sm mb-3">Your Response</h3>

            <ProofUploader
              onFileSelected={(base64, fileName, ext) => setProofData({ base64, fileName, ext })}
            />

            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Describe the payment you made — include the mobile money transaction ID if available."
              className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-4 py-3 w-full h-32 resize-none focus:outline-none focus:border-rowan-yellow placeholder-rowan-muted text-sm mt-3"
            />

            {error && <p className="text-rowan-red text-sm text-center mt-2">{error}</p>}

            <div className="mt-4">
              <Button variant="primary" size="lg" onClick={handleSubmit} loading={submitting}>
                <span className="flex items-center justify-center gap-2">
                  <Upload size={16} />
                  Submit Response
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Already responded */}
        {hasResponded && !isResolved && (
          <div className="bg-rowan-surface border border-rowan-green/30 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={18} className="text-rowan-green" />
              <p className="text-rowan-green font-bold text-sm">Your Response Submitted</p>
            </div>
            <p className="text-rowan-muted text-sm">
              {d.traderResponse || d.trader_response}
            </p>
            <span className="inline-flex items-center gap-1 bg-rowan-green/15 text-rowan-green text-xs px-2 py-1 rounded mt-2">
              <ShieldCheck size={12} /> Proof uploaded
            </span>
            <p className="text-rowan-muted text-xs mt-1">
              Submitted {formatTimeAgo(d.respondedAt || d.responded_at)}
            </p>
          </div>
        )}

        {/* Resolution */}
        {isResolved && (
          <div
            className={`bg-rowan-surface border rounded-xl p-4 mt-4 ${
              d.status === 'RESOLVED_TRADER_WIN' ? 'border-rowan-green/30' : 'border-rowan-red/30'
            }`}
          >
            <p className={`font-bold text-sm mb-2 ${
              d.status === 'RESOLVED_TRADER_WIN' ? 'text-rowan-green' : 'text-rowan-red'
            }`}>
              Dispute Resolved
            </p>
            <p className="text-rowan-muted text-sm">
              {d.resolutionNote || d.resolution_note || 'The dispute has been reviewed and a decision was made.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
