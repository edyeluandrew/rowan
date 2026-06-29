import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, X, CircleCheckBig } from 'lucide-react';
import { submitTraderReview } from '../api/reviews';
import Button from '../components/ui/Button';

const MAX_COMMENT = 200;

export default function TraderReviewModal({ transactionId, onClose, onSubmitted }) {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      onSubmitted?.();
      onClose?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, onClose, onSubmitted]);

  const handleSubmit = async () => {
    if (rating == null) return;
    setLoading(true);
    setError(null);
    try {
      await submitTraderReview({ transactionId, rating, comment: comment.trim() || undefined });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Review could not be submitted. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-rowan-surface border border-rowan-border rounded-2xl w-full max-w-md p-8 text-center">
          <CircleCheckBig size={48} className="text-rowan-green mx-auto mb-4" />
          <p className="text-rowan-text font-bold text-lg">Thank you for your review!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-rowan-surface border border-rowan-border rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-rowan-text font-bold text-lg">How was your experience?</h2>
          <button type="button" onClick={onClose} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
            <X size={20} />
          </button>
        </div>
        <p className="text-rowan-muted text-sm mb-5">Rate this customer</p>
        <div className="flex gap-4 justify-center mb-5">
          <button
            type="button"
            onClick={() => setRating(1)}
            className={`flex flex-col items-center gap-2 p-5 rounded-xl border min-w-[120px] ${
              rating === 1 ? 'border-rowan-green bg-rowan-green/10' : 'border-rowan-border bg-rowan-bg'
            }`}
          >
            <ThumbsUp size={32} className={rating === 1 ? 'text-rowan-green' : 'text-rowan-muted'} />
          </button>
          <button
            type="button"
            onClick={() => setRating(-1)}
            className={`flex flex-col items-center gap-2 p-5 rounded-xl border min-w-[120px] ${
              rating === -1 ? 'border-rowan-red bg-rowan-red/10' : 'border-rowan-border bg-rowan-bg'
            }`}
          >
            <ThumbsDown size={32} className={rating === -1 ? 'text-rowan-red' : 'text-rowan-muted'} />
          </button>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
          placeholder="Add a comment (optional)"
          rows={3}
          className="w-full bg-rowan-bg border border-rowan-border rounded-xl px-3 py-2 text-sm text-rowan-text mb-1"
        />
        <p className="text-rowan-muted text-xs text-right mb-4">{comment.length}/{MAX_COMMENT}</p>
        {error && <p className="text-rowan-red text-xs mb-3">{error}</p>}
        <Button onClick={handleSubmit} loading={loading} disabled={rating == null}>
          Submit Review
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-rowan-muted text-sm mt-3 min-h-11"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
