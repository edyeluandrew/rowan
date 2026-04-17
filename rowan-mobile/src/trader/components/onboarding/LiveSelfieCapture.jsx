/**
 * LiveSelfieCapture.jsx — Live selfie capture with motion-based liveness verification.
 * 
 * Features:
 * - Guided capture UI with clear instructions
 * - Real-time camera preview
 * - Motion-based liveness detection (capture 2 frames with delay)
 * - Brightness/contrast validation
 * - Confirmation screen showing captured image
 * - Retry mechanism with clear messaging
 * - Integration with DocumentUploader workflow
 * 
 * Props:
 * - onCapture(base64, metadata) — called with captured selfie + liveness result
 * - currentFile — existing selfie (if any)
 * - onCancel — called when user cancels
 */

import { useState } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AlertCircle, Check, RotateCcw, Camera as CameraIcon, CheckCircle, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  compareImagesForMotion,
  validateImageBrightnessContrast,
  assessLiveness,
  generateLivenessResult,
  sleep,
} from '../../utils/livenessCheck';
import { validateBase64Integrity, formatFileSize, getBase64SizeBytes } from '../../utils/fileValidation';
import { requestCameraPermission } from '../../utils/permissions';
import { logError } from '../../utils/errorTracking';

const CAPTURE_STATES = {
  READY: 'ready',
  INSTRUCTING: 'instructing',
  CAPTURING_FRAME_1: 'capturing_frame_1',
  ANALYZING_MOTION: 'analyzing_motion',
  RESULT: 'result',
  CONFIRM: 'confirm',
  ERROR: 'error',
};

export default function LiveSelfieCapture({ onCapture, currentFile, onCancel }) {
  const [state, setState] = useState(CAPTURE_STATES.READY);
  const [capturedBase64, setCapturedBase64] = useState(null);
  const [livenessResult, setLivenessResult] = useState(null);
  const [error, setError] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [progress, setProgress] = useState('');
  const [countdown, setCountdown] = useState(0);

  const maxRetries = 3;

  /**
   * Start guided capture flow: instructions → capture → analyze → result
   */
  const handleStartCapture = async () => {
    setError(null);
    setPermissionError(null);

    // Check camera permission first
    const permCheck = await requestCameraPermission();
    if (!permCheck.granted) {
      setPermissionError({
        message: permCheck.error,
        hasSettings: !!permCheck.settingsUrl,
      });
      logError('LiveSelfieCapture', new Error('Camera permission denied'), {
        permissionError: permCheck.error,
      });
      return;
    }

    setState(CAPTURE_STATES.INSTRUCTING);
    await sleep(500);
    await guidedCapture();
  };

  /**
   * Guided capture with instructions and countdown
   */
  const guidedCapture = async () => {
    try {
      setProgress('Preparing camera...');
      setState(CAPTURE_STATES.CAPTURING_FRAME_1);

      // Countdown before first capture (3...2...1...)
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await sleep(1000);
      }
      setCountdown(0);

      // Capture first frame
      setProgress('Capturing...');
      const photo1 = await CapCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        width: 1200,
        height: 1200,
      });

      if (!photo1.base64String) {
        throw new Error('Failed to capture photo: no data received');
      }

      const base64_1 = photo1.base64String;
      logError('LiveSelfieCapture', new Error('Frame 1 captured successfully'), {
        frameSize: base64_1.length,
      }, { level: 'info' });

      // Wait 1 second before second capture (to detect motion)
      setProgress('Hold still...');
      setCountdown(1);
      await sleep(1000);
      setCountdown(0);

      // Capture second frame
      setProgress('Capturing second frame...');
      const photo2 = await CapCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        width: 1200,
        height: 1200,
      });

      if (!photo2.base64String) {
        throw new Error('Failed to capture second photo');
      }

      const base64_2 = photo2.base64String;
      logError('LiveSelfieCapture', new Error('Frame 2 captured successfully'), {
        frameSize: base64_2.length,
      }, { level: 'info' });

      // Analyze liveness
      await analyzeLiveness(base64_1, base64_2);
    } catch (err) {
      // Don't show error if user cancelled
      if (err?.message?.includes('cancelled') || err?.message?.includes('User')) {
        setState(CAPTURE_STATES.READY);
        return;
      }

      logError('LiveSelfieCapture.guidedCapture', err, {
        retryCount,
        state,
      });

      setError(err.message || 'Capture failed. Please try again.');
      setState(CAPTURE_STATES.ERROR);

      if (retryCount < maxRetries) {
        setRetryCount(r => r + 1);
      }
    }
  };

  /**
   * Analyze captured frame for liveness indicators
   */
  const analyzeLiveness = async (base64_1, base64_2) => {
    try {
      setProgress('Analyzing liveness...');
      setState(CAPTURE_STATES.ANALYZING_MOTION);
      await sleep(500);

      // 1. Check integrity of both frames
      const integrityErr1 = validateBase64Integrity(base64_1);
      const integrityErr2 = validateBase64Integrity(base64_2);

      if (integrityErr1 || integrityErr2) {
        throw new Error(`Image corrupted: ${integrityErr1 || integrityErr2}`);
      }

      // 2. Compare frames for motion
      const motionAnalysis = compareImagesForMotion(base64_1, base64_2);
      if (motionAnalysis.error) {
        throw new Error(`Motion analysis failed: ${motionAnalysis.error}`);
      }

      logError('LiveSelfieCapture', new Error('Motion analysis complete'), {
        motionScore: motionAnalysis.motionScore,
        motionDetected: motionAnalysis.motionDetected,
        confidence: motionAnalysis.confidence,
      }, { level: 'info' });

      // 3. Validate brightness/contrast of first frame
      const brightnessAnalysis = validateImageBrightnessContrast(base64_1);
      if (!brightnessAnalysis.valid) {
        throw new Error(
          `Image quality issue: ${
            brightnessAnalysis.checks?.brightnessTooLow
              ? 'Image too dark'
              : brightnessAnalysis.checks?.brightnessTooHigh
              ? 'Image too bright'
              : 'Image too blurry'
          }`
        );
      }

      logError('LiveSelfieCapture', new Error('Brightness analysis complete'), {
        brightness: brightnessAnalysis.brightness,
        contrast: brightnessAnalysis.contrast,
      }, { level: 'info' });

      // 4. Generate liveness result
      const result = generateLivenessResult(motionAnalysis, brightnessAnalysis);

      setLivenessResult(result);
      setCapturedBase64(base64_1); // Use first frame as final selfie
      setState(CAPTURE_STATES.RESULT);

      logError('LiveSelfieCapture', new Error('Liveness assessment complete'), {
        assessment: result.livenessAssessment,
        score: result.confidenceScore,
        passed: result.passed,
      }, { level: 'info' });
    } catch (err) {
      logError('LiveSelfieCapture.analyzeLiveness', err, {
        retryCount,
      });

      setError(err.message || 'Liveness analysis failed');
      setState(CAPTURE_STATES.ERROR);
    }
  };

  /**
   * User confirms captured selfie is acceptable
   */
  const handleConfirmSelfie = () => {
    if (!capturedBase64 || !livenessResult) {
      setError('Missing capture or analysis data');
      return;
    }

    setState(CAPTURE_STATES.CONFIRM);

    // Call parent with results
    const ext = 'jpeg';
    const fileName = `selfie_live_${Date.now()}.${ext}`;

    onCapture?.(capturedBase64, fileName, ext, livenessResult);

    logError('LiveSelfieCapture', new Error('Selfie confirmed by user'), {
      assessment: livenessResult.livenessAssessment,
      score: livenessResult.confidenceScore,
      fileName,
    }, { level: 'info' });

    // Reset state after brief delay
    setTimeout(() => {
      setState(CAPTURE_STATES.READY);
      setCapturedBase64(null);
      setLivenessResult(null);
      setRetryCount(0);
    }, 1000);
  };

  /**
   * User rejects captured selfie and wants to retry
   */
  const handleRetry = () => {
    setError(null);
    setCapturedBase64(null);
    setLivenessResult(null);
    setProgress('');
    setState(CAPTURE_STATES.READY);

    // Auto-start capture after brief delay
    setTimeout(() => handleStartCapture(), 300);
  };

  /**
   * Cancel the entire process
   */
  const handleCancel = () => {
    setState(CAPTURE_STATES.READY);
    setCapturedBase64(null);
    setLivenessResult(null);
    setError(null);
    setProgress('');
    setRetryCount(0);
    onCancel?.();
  };

  // ====== RENDER STATES ======

  // READY: Initial state, show start button
  if (state === CAPTURE_STATES.READY) {
    return (
      <div className="space-y-4">
        {currentFile?.base64 && (
          <div className="p-3 bg-rowan-green/10 border border-rowan-green rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="text-rowan-green mt-0.5 shrink-0" />
              <div>
                <p className="text-rowan-text text-sm font-medium">Selfie captured</p>
                <p className="text-rowan-muted text-xs">You can replace it with a new live capture below</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 bg-rowan-surface border border-rowan-border rounded-lg">
          <h3 className="text-rowan-text font-semibold text-sm mb-2">Live Selfie Capture</h3>
          <p className="text-rowan-muted text-xs mb-3">
            For security, we'll verify your selfie is a live capture (not a photo). The process takes about 10 seconds.
          </p>
          <ul className="text-rowan-muted text-xs space-y-1 mb-4">
            <li>✓ Good lighting</li>
            <li>✓ Face clearly visible</li>
            <li>✓ Camera at arm's length</li>
          </ul>
        </div>

        {permissionError && (
          <div className="p-3 bg-rowan-red/10 border border-rowan-red rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-rowan-red mt-0.5 shrink-0" />
              <div>
                <p className="text-rowan-text text-sm font-medium">Camera permission required</p>
                <p className="text-rowan-muted text-xs mt-1">{permissionError.message}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleStartCapture}
            className="flex-1 bg-rowan-yellow text-rowan-bg hover:bg-rowan-yellow/90"
          >
            <CameraIcon size={16} className="mr-2" />
            Start Live Capture
          </Button>
          <Button onClick={handleCancel} variant="secondary" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // INSTRUCTING: Show instructions before capture
  if (state === CAPTURE_STATES.INSTRUCTING) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-rowan-surface border border-rowan-border rounded-lg text-center">
          <h3 className="text-rowan-text font-bold text-lg mb-4">Get Ready for Live Capture</h3>
          <div className="space-y-3 text-rowan-muted text-sm">
            <p>📱 Hold steady</p>
            <p>😊 Face the camera</p>
            <p>💡 Ensure good lighting</p>
            <p>⏱️ Keep still for 2 seconds</p>
          </div>
          <p className="text-rowan-yellow text-xs mt-4 font-medium">Starting capture...</p>
        </div>
        <LoadingSpinner size={32} className="text-rowan-yellow mx-auto" />
      </div>
    );
  }

  // CAPTURING: Show countdown and status
  if (state === CAPTURE_STATES.CAPTURING_FRAME_1) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-rowan-surface border border-rowan-border rounded-lg text-center">
          {countdown > 0 && (
            <div className="text-6xl font-bold text-rowan-yellow mb-4 animate-pulse">{countdown}</div>
          )}
          <p className="text-rowan-text font-medium">{progress}</p>
          <p className="text-rowan-muted text-xs mt-2">Do not move...</p>
        </div>
        <LoadingSpinner size={32} className="text-rowan-yellow mx-auto" />
      </div>
    );
  }

  // ANALYZING: Show analysis progress
  if (state === CAPTURE_STATES.ANALYZING_MOTION) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-rowan-surface border border-rowan-border rounded-lg text-center">
          <h3 className="text-rowan-text font-semibold mb-4">Verifying liveness...</h3>
          <div className="space-y-2 text-rowan-muted text-xs mb-4">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-rowan-yellow rounded-full animate-bounce"></div>
              Analyzing motion
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-rowan-yellow rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              Checking image quality
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-rowan-yellow rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              Generating assessment
            </div>
          </div>
        </div>
        <LoadingSpinner size={32} className="text-rowan-yellow mx-auto" />
      </div>
    );
  }

  // RESULT: Show liveness assessment
  if (state === CAPTURE_STATES.RESULT && livenessResult) {
    const isPassed = livenessResult.passed;
    const statusColor = isPassed ? 'rowan-green' : 'rowan-yellow';
    const statusIcon = isPassed ? Check : AlertCircle;

    return (
      <div className="space-y-4">
        <div className={`p-4 bg-${statusColor}/10 border border-${statusColor} rounded-lg`}>
          <div className="flex items-start gap-3">
            {isPassed ? (
              <CheckCircle size={20} className={`text-${statusColor} shrink-0 mt-0.5`} />
            ) : (
              <AlertCircle size={20} className={`text-${statusColor} shrink-0 mt-0.5`} />
            )}
            <div className="flex-1">
              <h3 className={`text-rowan-text font-semibold text-sm`}>
                {isPassed ? 'Liveness Verified' : 'Marginal Liveness'}
              </h3>
              <p className="text-rowan-muted text-xs mt-1">
                {isPassed
                  ? 'Your live capture is confirmed. Please review the image below.'
                  : 'Limited motion detected. Please ensure good lighting and hold steady during capture.'}
              </p>

              {livenessResult.assessmentReasons && livenessResult.assessmentReasons.length > 0 && (
                <ul className="text-rowan-muted text-xs mt-2 space-y-1">
                  {livenessResult.assessmentReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-rowan-muted">
                  Motion: {livenessResult.motionScore.toFixed(0)}%
                </span>
                <span className="text-rowan-muted">
                  Confidence: {livenessResult.confidenceScore}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        {capturedBase64 && (
          <div className="border border-rowan-border rounded-lg overflow-hidden">
            <img
              src={`data:image/jpeg;base64,${capturedBase64}`}
              alt="Captured selfie"
              className="w-full max-h-60 object-cover bg-rowan-surface"
            />
            <div className="p-3 bg-rowan-surface">
              <p className="text-rowan-muted text-xs">
                File size: {formatFileSize(getBase64SizeBytes(capturedBase64))}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleConfirmSelfie}
            className="flex-1 bg-rowan-yellow text-rowan-bg hover:bg-rowan-yellow/90"
          >
            <Check size={16} className="mr-2" />
            Use This Selfie
          </Button>
          <Button
            onClick={handleRetry}
            variant="secondary"
            className="flex-1"
            disabled={retryCount >= maxRetries}
          >
            <RotateCcw size={16} className="mr-2" />
            Retry
          </Button>
        </div>

        {retryCount >= maxRetries && (
          <p className="text-rowan-muted text-xs text-center">
            Maximum retries reached. You can still use this selfie or cancel to try later.
          </p>
        )}
      </div>
    );
  }

  // CONFIRM: Show confirmation state briefly
  if (state === CAPTURE_STATES.CONFIRM) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-rowan-green/10 border border-rowan-green rounded-lg text-center">
          <CheckCircle size={48} className="text-rowan-green mx-auto mb-3" />
          <h3 className="text-rowan-text font-bold">Selfie Saved</h3>
          <p className="text-rowan-muted text-sm mt-2">Your live selfie has been captured and verified.</p>
        </div>
      </div>
    );
  }

  // ERROR: Show error with retry option
  if (state === CAPTURE_STATES.ERROR) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-rowan-red/10 border border-rowan-red rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-rowan-red shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-rowan-text font-semibold text-sm">Capture Failed</h3>
              <p className="text-rowan-muted text-xs mt-1">{error}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-rowan-muted text-xs">
          <p className="font-medium">Tips for better results:</p>
          <ul className="space-y-1">
            <li>✓ Use good natural lighting</li>
            <li>✓ Hold camera at arm's length</li>
            <li>✓ Face camera directly</li>
            <li>✓ Move your head slightly during capture</li>
          </ul>
        </div>

        <div className="flex gap-2">
          {retryCount < maxRetries && (
            <Button onClick={handleRetry} className="flex-1 bg-rowan-yellow text-rowan-bg hover:bg-rowan-yellow/90">
              <RotateCcw size={16} className="mr-2" />
              Try Again
            </Button>
          )}
          <Button onClick={handleCancel} variant="secondary" className="flex-1">
            Cancel
          </Button>
        </div>

        {retryCount >= maxRetries && (
          <p className="text-rowan-muted text-xs text-center">Maximum retries reached. Please try again later.</p>
        )}
      </div>
    );
  }

  // Fallback
  return null;
}
