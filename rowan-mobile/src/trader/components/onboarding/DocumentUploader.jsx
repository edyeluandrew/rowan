import { useState } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Upload, Camera as CameraIcon, ImagePlus, AlertCircle, RotateCcw, Loader } from 'lucide-react';
import { validateFile, formatFileSize, getBase64SizeBytes, validateBase64Integrity, checkForDuplicate } from '../../utils/fileValidation';
import { requestCameraPermission, requestPhotosPermission, formatPermissionError } from '../../utils/permissions';
import { logError } from '../../utils/errorTracking';

/**
 * DocumentUploader — dashed border upload area using Capacitor Camera plugin.
 * Enhanced with permission handling, better error recovery, and validation.
 * Props: label, required, hint, onFileSelected(base64, fileName, ext), currentFile, constraints
 */
export default function DocumentUploader({ label, required, hint, onFileSelected, currentFile, constraints = {} }) {
  const [showSheet, setShowSheet] = useState(false);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [permissionError, setPermissionError] = useState(null);

  const maxRetries = 2;

  const handleCaptureComplete = (base64, fileName, ext) => {
    // 1. Check base64 integrity
    const integrityError = validateBase64Integrity(base64);
    if (integrityError) {
      const errMsg = 'File corrupted: ' + integrityError;
      setError(errMsg);
      logError('DocumentUploader.handleCaptureComplete', new Error('Base64 integrity check failed'), {
        fileName,
        ext,
        integrityError,
        fileSize: base64?.length,
      });
      if (retryCount < maxRetries) {
        setRetryCount((r) => r + 1);
      }
      return;
    }

    // 2. Validate file according to constraints
    const validation = validateFile(base64, fileName, ext, {
      maxSizeMB: constraints.maxSizeMB || 10,
      allowedTypes: constraints.allowedTypes || ['jpeg', 'png', 'pdf'],
      requireDimensionsForImages: constraints.requireDimensionsForImages !== false,
    });

    if (!validation.valid) {
      setError(validation.error);
      logError('DocumentUploader.handleCaptureComplete', new Error('File validation failed'), {
        fileName,
        ext,
        validationError: validation.error,
        constraints,
      });
      if (retryCount < maxRetries) {
        setRetryCount((r) => r + 1);
      }
      return;
    }

    // 3. Check for duplicates (if caller provides comparison)
    if (currentFile?.base64 && checkForDuplicate(currentFile, { base64, name: fileName, ext })) {
      const errMsg = 'This appears to be the same file as currently uploaded. Please select a different file.';
      setError(errMsg);
      logError('DocumentUploader.handleCaptureComplete', new Error('Duplicate file detected'), {
        fileName,
        ext,
      });
      return;
    }

    // File is valid, clear error and notify parent
    setError(null);
    setRetryCount(0);
    setPermissionError(null);
    logError('DocumentUploader.handleCaptureComplete', new Error('File validation successful'), {
      fileName,
      ext,
      fileSize: base64?.length,
    }, { level: 'info' });
    onFileSelected?.(base64, fileName, ext);
  };

  const capture = async (source) => {
    setShowSheet(false);
    setError(null);
    setPermissionError(null);
    setCapturing(true);

    const sourceLabel = source === CameraSource.Camera ? 'Camera' : 'Gallery';

    try {
      // Check permission before capturing
      const permCheck = source === CameraSource.Camera
        ? await requestCameraPermission()
        : await requestPhotosPermission();

      if (!permCheck.granted) {
        setPermissionError({
          message: permCheck.error,
          hasSettings: !!permCheck.settingsUrl,
        });
        logError('DocumentUploader', new Error(`Permission denied: ${sourceLabel}`), {
          source: sourceLabel,
          permissionError: permCheck.error,
        });
        setCapturing(false);
        return;
      }

      // Capture photo with error handling
      const photo = await CapCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
        width: 1200,
        height: 1200,
        promptLabelHeader: 'Select Photo',
        promptLabelCancel: 'Cancel',
        promptLabelPicture: 'Recent Photos',
        promptLabelPhoto: 'Camera',
      });

      if (!photo.base64String) {
        const errMsg = 'Failed to capture photo: no data received. Please try again.';
        setError(errMsg);
        logError('DocumentUploader', new Error('No base64 data from camera'), {
          source: sourceLabel,
          photoKeys: Object.keys(photo || {}),
        });
        if (retryCount < maxRetries) {
          setRetryCount((r) => r + 1);
        }
        setCapturing(false);
        return;
      }

      const ext = photo.format || 'jpeg';
      const fileName = `upload_${Date.now()}.${ext}`;
      logError('DocumentUploader', new Error('Capture successful'), {
        source: sourceLabel,
        ext,
        fileName,
      });
      handleCaptureComplete(photo.base64String, fileName, ext);
    } catch (err) {
      const errMsg = err?.message || '';
      
      logError('DocumentUploader', err, {
        source: sourceLabel,
        errorMessage: errMsg,
        retryCount,
      });

      // Don't show error if user cancelled
      if (errMsg.includes('User cancelled') || errMsg.includes('cancelled')) {
        setCapturing(false);
        return;
      }

      // Handle permission denied
      if (errMsg.includes('Permission') || errMsg.includes('permission')) {
        setPermissionError({
          message: source === CameraSource.Camera
            ? 'Camera permission is required. Enable it in your phone settings.'
            : 'Gallery permission is required. Enable it in your phone settings.',
          hasSettings: true,
        });
      } else {
        setError('Failed to capture photo. Please try again.');
      }

      console.error('[DocumentUploader] Capture error:', err);
      if (retryCount < maxRetries) {
        setRetryCount((r) => r + 1);
      }
    } finally {
      setCapturing(false);
    }
  };

  const handleRemove = () => {
    onFileSelected?.(null, null, null);
    setError(null);
    setRetryCount(0);
    setPermissionError(null);
  };

  // Preview state: file uploaded and valid
  if (currentFile?.base64) {
    const fileSizeBytes = getBase64SizeBytes(currentFile.base64);
    const fileSizeStr = formatFileSize(fileSizeBytes);
    return (
      <div className="border border-rowan-border rounded-lg overflow-hidden">
        {/* Thumbnail preview */}
        <img
          src={`data:image/${currentFile.ext || 'jpeg'};base64,${currentFile.base64}`}
          alt={label}
          className="w-full max-h-40 object-cover rounded-t-lg bg-rowan-surface"
          loading="lazy"
        />
        {/* File info footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-rowan-surface">
          <div className="flex-1 min-w-0">
            <p className="text-rowan-muted text-xs truncate">{currentFile.name}</p>
            <p className="text-rowan-muted text-xs">{fileSizeStr}</p>
          </div>
          <button 
            onClick={handleRemove} 
            className="text-rowan-red text-xs font-medium ml-2 shrink-0 hover:opacity-75 transition-opacity"
            title="Remove this file"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-2 border-dashed border-rowan-border rounded-lg p-6 text-center">
        <Upload size={32} className="text-rowan-muted mb-2 mx-auto" />
        <p className="text-rowan-text font-medium text-sm">{label}</p>
        {required && <span className="text-rowan-red text-xs">*</span>}
        {hint && <p className="text-rowan-muted text-xs mt-1">{hint}</p>}
        
        <button
          type="button"
          onClick={() => setShowSheet(true)}
          disabled={capturing}
          className="mt-3 border border-rowan-border text-rowan-text text-sm px-4 py-2 rounded transition-colors active:bg-rowan-surface disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          {capturing && <Loader size={14} className="animate-spin" />}
          {capturing ? 'Processing...' : 'Upload Photo'}
        </button>
        
        {/* Validation error */}
        {error && (
          <div className="mt-3 p-3 bg-rowan-red/10 rounded-md border border-rowan-red/30">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-rowan-red mt-0.5 shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-rowan-red text-xs font-medium">{error}</p>
                {retryCount < maxRetries && (
                  <button
                    onClick={() => setShowSheet(true)}
                    className="text-rowan-red text-xs underline mt-1 flex items-center gap-1 hover:opacity-75 transition-opacity"
                  >
                    <RotateCcw size={12} />
                    Try again
                  </button>
                )}
                {retryCount >= maxRetries && (
                  <p className="text-rowan-red text-xs mt-1">
                    Max retries reached. Please try removing and re-uploading.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Permission error */}
        {permissionError && (
          <div className="mt-3 p-3 bg-rowan-yellow/10 rounded-md border border-rowan-yellow/30">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-rowan-yellow mt-0.5 shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-rowan-yellow text-xs font-medium">{permissionError.message}</p>
                {permissionError.hasSettings && (
                  <p className="text-rowan-yellow text-xs mt-1">
                    Open Settings → Apps → {typeof getAppName() === 'string' ? getAppName() : 'this app'} → Permissions to enable.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom sheet — Take Photo / Choose from Gallery */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => !capturing && setShowSheet(false)}
        >
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-4">Upload Photo</h3>
            
            <button
              onClick={() => capture(CameraSource.Camera)}
              disabled={capturing}
              className="w-full py-3 text-rowan-text text-sm font-medium rounded-md bg-rowan-bg border border-rowan-border mb-3 active:bg-rowan-border transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {capturing ? <Loader size={14} className="animate-spin" /> : <CameraIcon size={16} />}
              {capturing ? 'Processing...' : 'Take Photo'}
            </button>
            
            <button
              onClick={() => capture(CameraSource.Photos)}
              disabled={capturing}
              className="w-full py-3 text-rowan-text text-sm font-medium rounded-md bg-rowan-bg border border-rowan-border mb-3 active:bg-rowan-border transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {capturing ? <Loader size={14} className="animate-spin" /> : <ImagePlus size={16} />}
              {capturing ? 'Processing...' : 'Choose from Gallery'}
            </button>
            
            <button
              onClick={() => setShowSheet(false)}
              disabled={capturing}
              className="w-full py-3 text-rowan-muted text-sm rounded-md disabled:opacity-50 transition-opacity"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Helper to get app name from manifest or fallback.
 */
function getAppName() {
  // Try to get from Capacitor config or app metadata
  if (typeof window !== 'undefined' && window.Capacitor) {
    try {
      return 'Rowan';
    } catch (e) {
      return 'Rowan';
    }
  }
  return 'Rowan';
}
