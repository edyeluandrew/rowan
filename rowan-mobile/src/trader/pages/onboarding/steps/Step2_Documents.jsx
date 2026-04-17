import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import DocumentUploader from '../../../components/onboarding/DocumentUploader';
import LiveSelfieCapture from '../../../components/onboarding/LiveSelfieCapture';
import Button from '../../../components/ui/Button';
import { validateFile, getBase64SizeBytes, formatFileSize } from '../../../utils/fileValidation';

/**
 * Step2_Documents — ID front, ID back, selfie uploads via Capacitor Camera.
 * Props: formData, setFormData, goNext
 * 
 * Enhanced with:
 * - Document status summary
 * - Visual indicators (checkmarks for complete, warnings for missing)
 * - Better validation error messaging
 * - File size tracking
 */
export default function Step2_Documents({ formData, setFormData, goNext }) {
  const saved = formData.documents || {};
  const idType = formData.identity?.idType || 'national_id';
  const idBackRequired = idType === 'national_id';

  const [idFront, setIdFront] = useState(saved.idFront || null);
  const [idBack, setIdBack] = useState(saved.idBack || null);
  const [selfie, setSelfie] = useState(saved.selfie || null);
  const [livenessResult, setLivenessResult] = useState(saved.livenessResult || null);
  const [showLiveCapture, setShowLiveCapture] = useState(false);
  const [error, setError] = useState(null);
  const [validationState, setValidationState] = useState({});

  const constraints = {
    maxSizeMB: 10,
    allowedTypes: ['jpeg', 'png', 'pdf'],
    requireDimensionsForImages: true,
  };

  const handleFile = (setter) => (base64, name, ext) => {
    if (base64 === null) {
      setter(null);
    } else {
      setter({ base64, name, ext });
    }
  };

  // Pre-submission validation — validate all files
  const validateAllFiles = () => {
    const newState = {};
    let hasError = false;

    // Validate ID Front
    if (!idFront?.base64) {
      newState.idFront = { valid: false, error: 'Required' };
      setError('Front of your ID is required');
      hasError = true;
    } else {
      const idFrontValidation = validateFile(idFront.base64, idFront.name, idFront.ext, constraints);
      newState.idFront = { valid: idFrontValidation.valid, error: idFrontValidation.error };
      if (!idFrontValidation.valid) {
        setError('ID Front: ' + idFrontValidation.error);
        hasError = true;
      }
    }

    // Validate ID Back (if required)
    if (idBackRequired) {
      if (!idBack?.base64) {
        newState.idBack = { valid: false, error: 'Required' };
        if (!hasError) {
          setError('Back of your National ID is required');
          hasError = true;
        }
      } else {
        const idBackValidation = validateFile(idBack.base64, idBack.name, idBack.ext, constraints);
        newState.idBack = { valid: idBackValidation.valid, error: idBackValidation.error };
        if (!idBackValidation.valid && !hasError) {
          setError('ID Back: ' + idBackValidation.error);
          hasError = true;
        }
      }
    } else {
      // Not required, but if present, validate it
      if (idBack?.base64) {
        const idBackValidation = validateFile(idBack.base64, idBack.name, idBack.ext, constraints);
        newState.idBack = { valid: idBackValidation.valid, error: idBackValidation.error };
        if (!idBackValidation.valid && !hasError) {
          setError('ID Back: ' + idBackValidation.error);
          hasError = true;
        }
      }
    }

    // Validate Selfie
    if (!selfie?.base64) {
      newState.selfie = { valid: false, error: 'Required' };
      if (!hasError) {
        setError('A selfie holding your ID is required');
        hasError = true;
      }
    } else {
      const selfieValidation = validateFile(selfie.base64, selfie.name, selfie.ext, constraints);
      newState.selfie = { valid: selfieValidation.valid, error: selfieValidation.error };
      if (!selfieValidation.valid && !hasError) {
        setError('Selfie: ' + selfieValidation.error);
        hasError = true;
      }
    }

    setValidationState(newState);
    return !hasError;
  };

  const handleContinue = () => {
    setError(null);
    if (!validateAllFiles()) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      documents: { idFront, idBack, selfie, livenessResult },
    }));
    goNext();
  };

  // Helper to display file size for uploaded files
  const getFileSizeDisplay = (file) => {
    if (!file?.base64) return '';
    const bytes = getBase64SizeBytes(file.base64);
    return formatFileSize(bytes);
  };

  // Compute progress: how many docs are uploaded
  const docsUploaded = [idFront, idBackRequired && idBack, selfie].filter(Boolean).length;
  const docsRequired = 2 + (idBackRequired ? 1 : 0);
  const allDocsUploaded = docsUploaded === docsRequired;

  // Helper to render status badge
  const renderStatusBadge = (isUploaded, isRequired) => {
    if (isUploaded) {
      return (
        <div className="flex items-center gap-1 text-rowan-green text-xs">
          <Check size={14} />
          <span>Ready</span>
        </div>
      );
    }
    if (isRequired) {
      return (
        <div className="flex items-center gap-1 text-rowan-yellow text-xs">
          <AlertCircle size={14} />
          <span>Required</span>
        </div>
      );
    }
    return (
      <div className="text-rowan-muted text-xs">
        Optional
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-rowan-text font-bold text-xl">Upload your documents</h2>
      <p className="text-rowan-muted text-sm mt-1 mb-6">
        We need to verify your identity. All documents are encrypted and stored securely.
      </p>

      {/* Progress indicator */}
      <div className="mb-6 p-4 bg-rowan-surface border border-rowan-border rounded-lg">
        <div className="flex items-end gap-2 mb-2">
          <p className="text-rowan-text font-semibold text-sm">Progress</p>
          <p className="text-rowan-muted text-xs">{docsUploaded}/{docsRequired}</p>
        </div>
        <div className="w-full bg-rowan-bg rounded-full h-2 overflow-hidden">
          <div
            className="bg-rowan-yellow h-full transition-all duration-300"
            style={{ width: `${(docsUploaded / docsRequired) * 100}%` }}
          />
        </div>
        {allDocsUploaded && (
          <p className="text-rowan-green text-xs mt-2 flex items-center gap-1">
            <Check size={12} />
            All required documents uploaded
          </p>
        )}
      </div>

      {/* Document sections */}
      <div className="space-y-4">
        {/* ID Front */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              <label className="text-rowan-text text-sm font-medium">Front of your National ID or Passport</label>
              <span className="text-rowan-red text-xs">*</span>
            </div>
            {renderStatusBadge(!!idFront?.base64, true)}
          </div>
          <DocumentUploader
            label="Front of your National ID or Passport"
            required
            onFileSelected={handleFile(setIdFront)}
            currentFile={idFront}
            constraints={constraints}
          />
        </div>

        {/* ID Back */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              <label className="text-rowan-text text-sm font-medium">Back of your National ID</label>
              {!idBackRequired && <span className="text-rowan-muted text-xs ml-2">(Optional for Passport)</span>}
              {idBackRequired && <span className="text-rowan-red text-xs">*</span>}
            </div>
            {renderStatusBadge(!!idBack?.base64, idBackRequired)}
          </div>
          <DocumentUploader
            label="Back of your National ID"
            required={idBackRequired}
            hint={!idBackRequired ? 'Optional for Passport holders' : undefined}
            onFileSelected={handleFile(setIdBack)}
            currentFile={idBack}
            constraints={constraints}
          />
        </div>

        {/* Selfie with Live Verification */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              <label className="text-rowan-text text-sm font-medium">Live Selfie with ID</label>
              <span className="text-rowan-red text-xs">*</span>
            </div>
            {renderStatusBadge(!!selfie?.base64, true)}
          </div>

          {/* Show LiveSelfieCapture or regular uploader based on showLiveCapture */}
          {showLiveCapture ? (
            <div className="border border-rowan-border rounded-lg p-4 bg-rowan-surface">
              <LiveSelfieCapture
                onCapture={(base64, fileName, ext, livenessData) => {
                  setSelfie({ base64, name: fileName, ext });
                  setLivenessResult(livenessData);
                  setShowLiveCapture(false);
                  setError(null);
                }}
                currentFile={selfie}
                onCancel={() => setShowLiveCapture(false)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Option to capture live selfie */}
              <button
                type="button"
                onClick={() => setShowLiveCapture(true)}
                className="w-full p-4 border-2 border-dashed border-rowan-border rounded-lg hover:border-rowan-yellow hover:bg-rowan-surface/50 transition-colors text-center"
              >
                <div className="flex items-center justify-center gap-2 text-rowan-text hover:text-rowan-yellow">
                  <span className="text-lg">📱</span>
                  <span className="text-sm font-medium">Capture Live Selfie</span>
                </div>
                <p className="text-rowan-muted text-xs mt-1">Recommended: Higher security with liveness verification</p>
              </button>

              {/* Or use regular uploader as fallback */}
              <details className="cursor-pointer">
                <summary className="text-rowan-muted text-xs font-medium hover:text-rowan-text">
                  Or upload photo from gallery
                </summary>
                <div className="mt-3">
                  <DocumentUploader
                    label="Selfie from gallery (not recommended for KYC)"
                    required={false}
                    hint="For best results, use live capture instead"
                    onFileSelected={handleFile(setSelfie)}
                    currentFile={selfie}
                    constraints={constraints}
                  />
                </div>
              </details>
            </div>
          )}

          {/* Liveness result summary */}
          {livenessResult && (
            <div className="mt-2 p-3 bg-rowan-green/10 border border-rowan-green rounded-lg">
              <div className="flex items-start gap-2">
                <Check size={14} className="text-rowan-green mt-0.5 shrink-0" />
                <div className="text-xs text-rowan-text">
                  <p className="font-medium">Liveness Verified</p>
                  <p className="text-rowan-muted text-xs mt-0.5">
                    Assessment: {livenessResult.livenessAssessment} | Score: {livenessResult.confidenceScore}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-rowan-muted text-xs text-center mt-4">
        Supported: JPG, PNG, PDF · Max 10MB per file
      </p>

      {/* File size summary — only show if docs are uploaded */}
      {(idFront || idBack || selfie) && (
        <div className="mt-4 p-3 bg-rowan-surface rounded-md border border-rowan-border">
          <p className="text-rowan-muted text-xs font-medium mb-2">Uploaded files:</p>
          <div className="space-y-1 text-rowan-muted text-xs">
            <p className="flex items-center gap-2">
              {idFront ? <Check size={12} className="text-rowan-green" /> : <span className="w-3" />}
              ID Front: {getFileSizeDisplay(idFront) || '—'}
            </p>
            {idBackRequired && (
              <p className="flex items-center gap-2">
                {idBack ? <Check size={12} className="text-rowan-green" /> : <span className="w-3" />}
                ID Back: {getFileSizeDisplay(idBack) || '—'}
              </p>
            )}
            <p className="flex items-center gap-2">
              {selfie ? <Check size={12} className="text-rowan-green" /> : <span className="w-3" />}
              Selfie: {getFileSizeDisplay(selfie) || '—'}
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-rowan-red/10 rounded-md border border-rowan-red/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-rowan-red mt-0.5 shrink-0" />
          <p className="text-rowan-red text-xs">{error}</p>
        </div>
      )}

      <div className="mt-8">
        <Button 
          variant="primary" 
          size="lg" 
          onClick={handleContinue}
          disabled={!allDocsUploaded}
        >
          Continue
        </Button>
        {!allDocsUploaded && (
          <p className="text-rowan-muted text-xs text-center mt-2">
            {docsRequired - docsUploaded} more document{docsRequired - docsUploaded > 1 ? 's' : ''} needed
          </p>
        )}
      </div>
    </div>
  );
}
