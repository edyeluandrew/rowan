import { useState } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Upload, Camera as CameraIcon, ImagePlus } from 'lucide-react';

/**
 * DocumentUploader — dashed border upload area using Capacitor Camera plugin.
 * Props: label, required, hint, onFileSelected(base64, fileName), currentFile
 */
export default function DocumentUploader({ label, required, hint, onFileSelected, currentFile }) {
  const [showSheet, setShowSheet] = useState(false);
  const [error, setError] = useState(null);

  const capture = async (source) => {
    setShowSheet(false);
    setError(null);
    try {
      const photo = await CapCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
        width: 1200,
        height: 1200,
      });
      const ext = photo.format || 'jpeg';
      const fileName = `upload_${Date.now()}.${ext}`;
      onFileSelected?.(photo.base64String, fileName, ext);
    } catch (err) {
      if (err?.message !== 'User cancelled photos app') {
        setError('Failed to capture photo. Please try again.');
      }
    }
  };

  const handleRemove = () => {
    onFileSelected?.(null, null, null);
  };

  if (currentFile?.base64) {
    return (
      <div className="border border-rowan-border rounded-lg overflow-hidden">
        <img
          src={`data:image/${currentFile.ext || 'jpeg'};base64,${currentFile.base64}`}
          alt={label}
          className="w-full max-h-40 object-cover rounded-t-lg"
        />
        <div className="flex items-center justify-between px-3 py-2 bg-rowan-surface">
          <span className="text-rowan-muted text-xs truncate flex-1">{currentFile.name}</span>
          <button onClick={handleRemove} className="text-rowan-red text-xs font-medium ml-2">
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-2 border-dashed border-rowan-border rounded-lg p-6 text-center">
        <Upload size={32} className="text-rowan-muted mb-2" />
        <p className="text-rowan-text font-medium text-sm">{label}</p>
        {required && <span className="text-rowan-red text-xs">*</span>}
        {hint && <p className="text-rowan-muted text-xs mt-1">{hint}</p>}
        <button
          type="button"
          onClick={() => setShowSheet(true)}
          className="mt-3 border border-rowan-border text-rowan-text text-sm px-4 py-2 rounded transition-colors active:bg-rowan-surface"
        >
          Upload Photo
        </button>
        {error && <p className="text-rowan-red text-xs mt-2">{error}</p>}
      </div>

      {/* Bottom sheet */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowSheet(false)}
        >
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-4">Upload Photo</h3>
            <button
              onClick={() => capture(CameraSource.Camera)}
              className="w-full py-3 text-rowan-text text-sm font-medium rounded-md bg-rowan-bg border border-rowan-border mb-3 active:bg-rowan-border transition-colors"
            >
              <CameraIcon size={16} className="inline mr-2" />Take Photo
            </button>
            <button
              onClick={() => capture(CameraSource.Photos)}
              className="w-full py-3 text-rowan-text text-sm font-medium rounded-md bg-rowan-bg border border-rowan-border mb-3 active:bg-rowan-border transition-colors"
            >
              <ImagePlus size={16} className="inline mr-2" />Choose from Gallery
            </button>
            <button
              onClick={() => setShowSheet(false)}
              className="w-full py-3 text-rowan-muted text-sm rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
