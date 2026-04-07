import { useState, useEffect, useCallback } from 'react';
import { getAgreement, confirmAgreement, submitOnboarding } from '../../../api/onboarding';
import AgreementViewer from '../../../components/onboarding/AgreementViewer';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Button from '../../../components/ui/Button';
import { normalizeAgreementResponse } from '../../../utils/agreementNormalizer';

/**
 * Convert a base64 + ext to a File object for multipart upload.
 */
function base64ToFile(base64, fileName, mimeType) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  return new File([new Uint8Array(byteNums)], fileName, { type: mimeType });
}

/**
 * Step5_Agreement — Read, agree, and submit the full application.
 * Props: formData, goNext, onSubmissionComplete (callback when submitted)
 */
export default function Step5_Agreement({ formData, goNext, onSubmissionComplete }) {
  const [content, setContent] = useState(null);
  const [agreementVersion, setAgreementVersion] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAgreement();
        const normalized = normalizeAgreementResponse(data);
        setContent(normalized.content);
        setAgreementVersion(normalized.version);
      } catch {
        setError('Failed to load agreement. Please try again.');
      } finally {
        setFetchLoading(false);
      }
    })();
  }, []);

  const handleScrolledToBottom = useCallback(() => {
    setScrolledToBottom(true);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      /* 1. Confirm agreement */
      await confirmAgreement(true, agreementVersion);

      /* 2. Build multipart/form-data with all collected data */
      const fd = new FormData();

      /* Identity fields */
      const id = formData.identity || {};
      fd.append('fullName', id.fullName || '');
      fd.append('dateOfBirth', id.dateOfBirth || '');
      fd.append('nationality', id.nationality || '');
      fd.append('idType', id.idType || '');
      fd.append('idNumber', id.idNumber || '');
      fd.append('idExpiry', id.idExpiry || '');
      fd.append('countryOfIssue', id.countryOfIssue || '');

      /* Document files */
      const docs = formData.documents || {};
      if (docs.idFront?.base64) {
        fd.append('idFront', base64ToFile(docs.idFront.base64, docs.idFront.name, `image/${docs.idFront.ext || 'jpeg'}`));
      }
      if (docs.idBack?.base64) {
        fd.append('idBack', base64ToFile(docs.idBack.base64, docs.idBack.name, `image/${docs.idBack.ext || 'jpeg'}`));
      }
      if (docs.selfie?.base64) {
        fd.append('selfie', base64ToFile(docs.selfie.base64, docs.selfie.name, `image/${docs.selfie.ext || 'jpeg'}`));
      }

      /* Binance fields */
      const b = formData.binance || {};
      fd.append('binanceUid', b.binanceUid || '');
      fd.append('binanceTradeCount', String(b.binanceTradeCount || ''));
      fd.append('binanceCompletionRate', String(b.binanceCompletionRate || ''));
      fd.append('binanceActiveMonths', b.binanceActiveMonths || '');
      if (b.screenshot?.base64) {
        fd.append('binanceScreenshot', base64ToFile(b.screenshot.base64, b.screenshot.name, `image/${b.screenshot.ext || 'jpeg'}`));
      }

      /* MoMo accounts as JSON */
      fd.append('momoAccounts', JSON.stringify(formData.momoAccounts || []));

      /* 3. Submit */
      await submitOnboarding(fd);
      
      // Clear draft on successful submission
      if (onSubmissionComplete) {
        await onSubmissionComplete();
      }
      
      goNext();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={28} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-rowan-text font-bold text-xl">Trader Agreement</h2>
      <p className="text-rowan-muted text-sm mt-1 mb-4">
        Read the full agreement before signing.
      </p>

      <AgreementViewer content={content} onScrolledToBottom={handleScrolledToBottom} />

      {/* Checkbox */}
      <div className="flex items-start gap-3 mt-4">
        <button
          type="button"
          onClick={() => scrolledToBottom && setAgreed((v) => !v)}
          disabled={!scrolledToBottom}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
            agreed
              ? 'bg-rowan-yellow border-rowan-yellow'
              : scrolledToBottom
              ? 'border-rowan-border'
              : 'border-rowan-border opacity-50'
          }`}
        >
          {agreed && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span
          className={`text-rowan-text text-sm ${!scrolledToBottom ? 'opacity-50' : ''}`}
        >
          I have read and agree to the Rowan Trader Agreement
        </span>
      </div>

      {!scrolledToBottom && (
        <p className="text-rowan-muted text-xs mt-2">
          Please scroll through the entire agreement to enable this checkbox.
        </p>
      )}

      {agreementVersion && (
        <p className="text-rowan-muted text-xs mt-2">
          Version {agreementVersion} — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {error && <p className="text-rowan-red text-sm text-center mt-3">{error}</p>}

      <div className="mt-6">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={!agreed}
          loading={submitting}
        >
          Submit Application
        </Button>
      </div>
    </div>
  );
}
