import { useState } from 'react';
import DocumentUploader from '../../../components/onboarding/DocumentUploader';
import Button from '../../../components/ui/Button';

/**
 * Step2_Documents — ID front, ID back, selfie uploads via Capacitor Camera.
 * Props: formData, setFormData, goNext
 */
export default function Step2_Documents({ formData, setFormData, goNext }) {
  const saved = formData.documents || {};
  const idType = formData.identity?.idType || 'national_id';
  const idBackRequired = idType === 'national_id';

  const [idFront, setIdFront] = useState(saved.idFront || null);
  const [idBack, setIdBack] = useState(saved.idBack || null);
  const [selfie, setSelfie] = useState(saved.selfie || null);
  const [error, setError] = useState(null);

  const handleFile = (setter) => (base64, name, ext) => {
    if (base64 === null) {
      setter(null);
    } else {
      setter({ base64, name, ext });
    }
  };

  const handleContinue = () => {
    setError(null);
    if (!idFront) {
      setError('Front of your ID is required');
      return;
    }
    if (idBackRequired && !idBack) {
      setError('Back of your National ID is required');
      return;
    }
    if (!selfie) {
      setError('A selfie holding your ID is required');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      documents: { idFront, idBack, selfie },
    }));
    goNext();
  };

  return (
    <div>
      <h2 className="text-rowan-text font-bold text-xl">Upload your documents</h2>
      <p className="text-rowan-muted text-sm mt-1 mb-6">
        We need to verify your identity. All documents are encrypted and stored securely.
      </p>

      <div className="space-y-4">
        <DocumentUploader
          label="Front of your National ID or Passport"
          required
          onFileSelected={handleFile(setIdFront)}
          currentFile={idFront}
        />

        <DocumentUploader
          label="Back of your National ID"
          required={idBackRequired}
          hint={!idBackRequired ? 'Optional for Passport holders' : undefined}
          onFileSelected={handleFile(setIdBack)}
          currentFile={idBack}
        />

        <DocumentUploader
          label="A clear selfie holding your ID next to your face"
          required
          onFileSelected={handleFile(setSelfie)}
          currentFile={selfie}
        />
      </div>

      <p className="text-rowan-muted text-xs text-center mt-4">
        JPG, PNG or PDF · Max 10MB per file
      </p>

      {error && <p className="text-rowan-red text-sm text-center mt-3">{error}</p>}

      <div className="mt-8">
        <Button variant="primary" size="lg" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
