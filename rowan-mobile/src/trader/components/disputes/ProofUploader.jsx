import { useState } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Upload, Camera, ImagePlus, Trash2 } from 'lucide-react';

/**
 * ProofUploader — upload proof of payment via Capacitor camera.
 * Props: onFileSelected(base64, fileName, ext), currentFile
 */
export default function ProofUploader({ onFileSelected, currentFile }) {
  const [showSheet, setShowSheet] = useState(false);
  const [preview, setPreview] = useState(currentFile || null);

  const handleCapture = async (source) => {
    setShowSheet(false);
    try {
      const photo = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
      });
      const ext = photo.format || 'jpeg';
      const fileName = `proof_${Date.now()}.${ext}`;
      setPreview(`data:image/${ext};base64,${photo.base64String}`);
      onFileSelected?.(photo.base64String, fileName, ext);
    } catch {}
  };

  const handleRemove = () => {
    setPreview(null);
    onFileSelected?.(null, null, null);
  };

  return (
    <div>
      <label className="block text-rowan-muted text-xs mb-1">Upload proof of payment</label>
      <p className="text-rowan-muted text-[10px] mb-2">
        Screenshot or receipt showing the mobile money transfer was sent
      </p>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-rowan-green/40 mb-2">
          <img src={preview} alt="Proof" className="w-full h-40 object-cover" />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-rowan-bg/80 rounded-full w-7 h-7 flex items-center justify-center"
          >
            <Trash2 size={14} className="text-rowan-red" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSheet(true)}
          className="w-full border-2 border-dashed border-rowan-border rounded-xl py-8 flex flex-col items-center gap-2 active:border-rowan-yellow transition-colors"
        >
          <Upload size={32} className="text-rowan-muted mb-3" />
          <span className="text-rowan-muted text-sm">Tap to upload proof</span>
        </button>
      )}

      {/* Source selection sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowSheet(false)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-rowan-border rounded-full mx-auto mb-4" />
            <button
              onClick={() => handleCapture(CameraSource.Camera)}
              className="flex items-center gap-3 w-full py-4 text-rowan-text text-sm font-medium border-b border-rowan-border text-left"
            >
              <Camera size={22} className="text-rowan-yellow" />
              Take Photo
            </button>
            <button
              onClick={() => handleCapture(CameraSource.Photos)}
              className="flex items-center gap-3 w-full py-4 text-rowan-text text-sm font-medium border-b border-rowan-border text-left"
            >
              <ImagePlus size={22} className="text-rowan-yellow" />
              Choose from Gallery
            </button>
            <button
              onClick={() => setShowSheet(false)}
              className="w-full py-3 mt-3 text-rowan-muted text-sm text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
