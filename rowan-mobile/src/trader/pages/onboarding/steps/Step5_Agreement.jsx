import { useState, useEffect, useCallback, useRef } from 'react';
import { getAgreement, confirmAgreement, submitOnboarding } from '../../../api/onboarding';
import AgreementViewer from '../../../components/onboarding/AgreementViewer';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Button from '../../../components/ui/Button';
import { validateFile, getBase64SizeBytes, validateBase64Integrity } from '../../../trader/utils/fileValidation';
import { AlertCircle, Check } from 'lucide-react';

/**
 * Convert a base64 + ext to a File object for multipart upload.
 * With error-checking for corrupted data.
 */
function base64ToFile(base64, fileName, mimeType) {
  try {
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Invalid base64 string');
    }

    const byteChars = atob(base64);
    if (!byteChars || byteChars.length === 0) {
      throw new Error('Base64 decode produced empty data');
    }

    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i);
    }

    return new File([new Uint8Array(byteNums)], fileName, { type: mimeType });
  } catch (err) {
    console.error('[base64ToFile] Conversion error:', err);
    throw new Error(`Failed to prepare file: ${err.message}`);
  }
}

/**
 * Validate all files before submission.
 * NOTE: Liveness result is optional but recommended. If not present, user used fallback gallery upload.
 */
function validateDocuments(docs) {
  const constraints = {
    maxSizeMB: 10,
    allowedTypes: ['jpeg', 'png', 'pdf'],
    requireDimensionsForImages: true,
  };

  if (!docs.idFront?.base64) {
    return { valid: false, error: 'ID Front document is missing' };
  }

  // Check integrity first
  const idFrontIntegrity = validateBase64Integrity(docs.idFront.base64);
  if (idFrontIntegrity) {
    return { valid: false, error: `ID Front is corrupted: ${idFrontIntegrity}` };
  }

  const idFrontVal = validateFile(docs.idFront.base64, docs.idFront.name, docs.idFront.ext, constraints);
  if (!idFrontVal.valid) {
    return { valid: false, error: 'ID Front: ' + idFrontVal.error };
  }

  if (docs.idBack && docs.idBack.base64) {
    const idBackIntegrity = validateBase64Integrity(docs.idBack.base64);
    if (idBackIntegrity) {
      return { valid: false, error: `ID Back is corrupted: ${idBackIntegrity}` };
    }

    const idBackVal = validateFile(docs.idBack.base64, docs.idBack.name, docs.idBack.ext, constraints);
    if (!idBackVal.valid) {
      return { valid: false, error: 'ID Back: ' + idBackVal.error };
    }
  }

  if (!docs.selfie?.base64) {
    return { valid: false, error: 'Selfie document is missing' };
  }

  const selfieIntegrity = validateBase64Integrity(docs.selfie.base64);
  if (selfieIntegrity) {
    return { valid: false, error: `Selfie is corrupted: ${selfieIntegrity}` };
  }

  const selfieVal = validateFile(docs.selfie.base64, docs.selfie.name, docs.selfie.ext, constraints);
  if (!selfieVal.valid) {
    return { valid: false, error: 'Selfie: ' + selfieVal.error };
  }

  // Liveness check: if present, ensure it passed
  if (docs.livenessResult) {
    if (docs.livenessResult.livenessAssessment === 'FAIL') {
      return {
        valid: false,
        error: 'Liveness verification failed. Please retake your selfie.',
      };
    }
  }

  return { valid: true };
}

/**
 * Step5_Agreement — Read, agree, and submit the full application.
 * Enhanced with:
 * - Upload progress tracking
 * - Retry logic for network failures
 * - Payload validation
 * - Better error recovery
 * Props: formData, goNext
 */
export default function Step5_Agreement({ formData, goNext }) {
  const [content, setContent] = useState(null);
  const [agreementVersion, setAgreementVersion] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef(null);

  const maxRetries = 2;
  const submitTimeoutMs = 120000; // 2 minutes

  useEffect(() => {
    (async () => {
      try {
        const data = await getAgreement();
        setContent(data.content || data.agreement || '');
        setAgreementVersion(data.version || data.agreementVersion || '1.0');
      } catch (err) {
        console.error('[Agreement] Load error:', err);
        setError('Failed to load agreement. Please try again.');
      } finally {
        setFetchLoading(false);
      }
    })();
  }, []);

  const handleScrolledToBottom = useCallback(() => {
    setScrolledToBottom(true);
  }, []);

  const handleRetry = async () => {
    setError(null);
    setRetryCount(0);
    await handleSubmit();
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    setUploadProgress(0);

    // Create abort controller for timeout
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, submitTimeoutMs);

    try {
      /* 1. Pre-validate all documents */
      setUploadProgress(5);
      const docs = formData.documents || {};
      const docValidation = validateDocuments(docs);
      if (!docValidation.valid) {
        setError(docValidation.error);
        setSubmitting(false);
        clearTimeout(timeoutId);
        return;
      }

      /* 2. Confirm agreement */
      setUploadProgress(10);
      try {
        await confirmAgreement(true, agreementVersion);
      } catch (err) {
        console.error('[Agreement] Confirmation error:', err);
        if (retryCount < maxRetries) {
          setError('Failed to confirm agreement. Retrying...');
          setRetryCount(r => r + 1);
          setTimeout(() => handleSubmit(), 1000);
          clearTimeout(timeoutId);
          return;
        }
        throw new Error('Could not confirm agreement after multiple attempts');
      }

      /* 3. Build and validate multipart/form-data */
      setUploadProgress(20);
      const fd = new FormData();

      try {
        /* Identity fields */
        const id = formData.identity || {};
        fd.append('fullName', id.fullName || '');
        fd.append('dateOfBirth', id.dateOfBirth || '');
        fd.append('nationality', id.nationality || '');
        fd.append('idType', id.idType || '');
        fd.append('idNumber', id.idNumber || '');
        fd.append('idExpiry', id.idExpiry || '');
        fd.append('countryOfIssue', id.countryOfIssue || '');

        /* Document files — convert base64 with mime type detection */
        if (docs.idFront?.base64) {
          const mimeType = `image/${docs.idFront.ext || 'jpeg'}`;
          fd.append('idFront', base64ToFile(docs.idFront.base64, docs.idFront.name, mimeType));
        }

        if (docs.idBack?.base64) {
          const mimeType = `image/${docs.idBack.ext || 'jpeg'}`;
          fd.append('idBack', base64ToFile(docs.idBack.base64, docs.idBack.name, mimeType));
        }

        if (docs.selfie?.base64) {
          const mimeType = `image/${docs.selfie.ext || 'jpeg'}`;
          fd.append('selfie', base64ToFile(docs.selfie.base64, docs.selfie.name, mimeType));
        }

        /* Liveness verification result — include if available */
        if (docs.livenessResult) {
          fd.append('livenessResult', JSON.stringify(docs.livenessResult));
          fd.append('livenessAssessment', docs.livenessResult.livenessAssessment || '');
          fd.append('livenessScore', String(docs.livenessResult.confidenceScore || 0));
          fd.append('motionDetected', String(docs.livenessResult.motionDetected || false));
        }

        /* Binance fields */
        const b = formData.binance || {};
        fd.append('binanceUid', b.binanceUid || '');
        fd.append('binanceTradeCount', String(b.binanceTradeCount || ''));
        fd.append('binanceCompletionRate', String(b.binanceCompletionRate || ''));
        fd.append('binanceActiveMonths', b.binanceActiveMonths || '');

        if (b.screenshot?.base64) {
          const screenshotMime = `image/${b.screenshot.ext || 'jpeg'}`;
          fd.append('binanceScreenshot', base64ToFile(b.screenshot.base64, b.screenshot.name, screenshotMime));
        }

        /* MoMo accounts as JSON */
        const momoAccounts = formData.momoAccounts || [];
        if (!Array.isArray(momoAccounts) || momoAccounts.length === 0) {
          setError('At least one mobile money account is required');
          setSubmitting(false);
          clearTimeout(timeoutId);
          return;
        }
        fd.append('momoAccounts', JSON.stringify(momoAccounts));

        setUploadProgress(40);
      } catch (err) {
        console.error('[Submission] FormData build error:', err);
        setError(`Failed to prepare submission: ${err.message}`);
        setSubmitting(false);
        clearTimeout(timeoutId);
        return;
      }

      /* 4. Submit with progress tracking */
      setUploadProgress(50);
      try {
        // Note: axios doesn't provide native request body progress,
        // so we show a generic progress spinner instead
        await submitOnboarding(fd);
        setUploadProgress(100);
        setTimeout(() => goNext(), 500);
      } catch (err) {
        // Network error retry logic
        const errMsg = (err.response?.data?.error || err.message || '').toLowerCase();
        const isNetworkError = err.code === 'ERR_NETWORK' || 
                               err.message?.includes('timeout') ||
                               err.message?.includes('Network');

        if (isNetworkError && retryCount < maxRetries) {
          setError(`Connection error. Retrying... (${retryCount + 1}/${maxRetries})`);
          setRetryCount(r => r + 1);
          setTimeout(() => handleSubmit(), 2000);
          clearTimeout(timeoutId);
          return;
        }

        // Enhanced error messages
        if (errMsg.includes('file') || errMsg.includes('document')) {
          setError('Document upload failed. Check file formats and try again.');
        } else if (errMsg.includes('network') || errMsg.includes('timeout')) {
          setError('Network timeout. Check your connection and try again.');
        } else if (errMsg.includes('email')) {
          setError('Email verification failed. Please use a valid email.');
        } else if (errMsg.includes('already')) {
          setError('Account already exists with this information.');
        } else {
          setError(err.response?.data?.error || 'Submission failed. Please try again.');
        }

        console.error('[Submission] Error:', err);
        throw err;
      }
    } catch (err) {
      // Final error state
      setSubmitting(false);
    } finally {
      clearTimeout(timeoutId);
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
              ? 'border-rowan-border hover:border-rowan-yellow'
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

      {/* Upload progress */}
      {submitting && uploadProgress > 0 && (
        <div className="mt-4 p-4 bg-rowan-surface border border-rowan-border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-rowan-text text-sm font-medium">Uploading documents...</p>
            <p className="text-rowan-muted text-xs">{uploadProgress}%</p>
          </div>
          <div className="w-full bg-rowan-bg rounded-full h-2 overflow-hidden">
            <div
              className="bg-rowan-yellow h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message with retry */}
      {error && (
        <div className="mt-4 p-3 bg-rowan-red/10 rounded-md border border-rowan-red/30">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-rowan-red mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-rowan-red text-xs font-medium">{error}</p>
              {!submitting && retryCount < maxRetries && (
                <button
                  onClick={handleRetry}
                  className="text-rowan-red text-xs underline mt-2 hover:opacity-75 transition-opacity"
                >
                  Try again
                </button>
              )}
              {!submitting && retryCount >= maxRetries && (
                <p className="text-rowan-red text-xs mt-2">
                  Max retries reached. Please check your connection and try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={!agreed || submitting}
          loading={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </Button>
        {submitting && (
          <p className="text-rowan-muted text-xs text-center mt-2">
            Please wait while we upload your documents. This may take a few moments.
          </p>
        )}
      </div>
    </div>
  );
}
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
