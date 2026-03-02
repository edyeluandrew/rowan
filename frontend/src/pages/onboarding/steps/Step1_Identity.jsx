import { useState } from 'react';
import Button from '../../../components/ui/Button';

/**
 * Step1_Identity — Personal Information form.
 * Props: formData, setFormData, goNext
 */
export default function Step1_Identity({ formData, setFormData, goNext }) {
  const saved = formData.identity || {};
  const [fullName, setFullName] = useState(saved.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState(saved.dateOfBirth || '');
  const [nationality, setNationality] = useState(saved.nationality || '');
  const [idType, setIdType] = useState(saved.idType || '');
  const [idNumber, setIdNumber] = useState(saved.idNumber || '');
  const [idExpiry, setIdExpiry] = useState(saved.idExpiry || '');
  const [countryOfIssue, setCountryOfIssue] = useState(saved.countryOfIssue || '');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Full legal name is required';
    if (!dateOfBirth) {
      e.dateOfBirth = 'Date of birth is required';
    } else {
      const dob = new Date(dateOfBirth);
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 18) e.dateOfBirth = 'You must be 18 or older to register as a trader';
    }
    if (!nationality.trim()) e.nationality = 'Nationality is required';
    if (!idType) e.idType = 'ID type is required';
    if (!idNumber.trim()) e.idNumber = 'ID number is required';
    if (!idExpiry) {
      e.idExpiry = 'ID expiry date is required';
    } else if (new Date(idExpiry) <= new Date()) {
      e.idExpiry = 'ID must not be expired';
    }
    if (!countryOfIssue.trim()) e.countryOfIssue = 'Country of issue is required';
    return e;
  };

  const handleContinue = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setFormData((prev) => ({
      ...prev,
      identity: { fullName, dateOfBirth, nationality, idType, idNumber, idExpiry, countryOfIssue },
    }));
    goNext();
  };

  const inputCls = 'bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full focus:outline-none focus:border-rowan-yellow placeholder-rowan-muted text-sm';

  return (
    <div>
      <h2 className="text-rowan-text font-bold text-xl">Tell us about yourself</h2>
      <p className="text-rowan-muted text-sm mt-1 mb-6">
        This information must match your government-issued ID
      </p>

      {/* Full Legal Name */}
      <label className="block mb-1 text-rowan-muted text-xs">Full Legal Name</label>
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="As shown on your ID"
        className={inputCls}
      />
      {errors.fullName && <p className="text-rowan-red text-xs mt-1">{errors.fullName}</p>}

      {/* Date of Birth */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">Date of Birth</label>
      <input
        type="date"
        value={dateOfBirth}
        onChange={(e) => setDateOfBirth(e.target.value)}
        className={inputCls}
      />
      {errors.dateOfBirth && <p className="text-rowan-red text-xs mt-1">{errors.dateOfBirth}</p>}

      {/* Nationality */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">Nationality</label>
      <input
        type="text"
        value={nationality}
        onChange={(e) => setNationality(e.target.value)}
        placeholder="e.g. Ugandan"
        className={inputCls}
      />
      {errors.nationality && <p className="text-rowan-red text-xs mt-1">{errors.nationality}</p>}

      {/* ID Type */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">ID Type</label>
      <select
        value={idType}
        onChange={(e) => setIdType(e.target.value)}
        className={inputCls}
      >
        <option value="" className="text-rowan-muted">Select ID type</option>
        <option value="national_id">National ID</option>
        <option value="passport">Passport</option>
      </select>
      {errors.idType && <p className="text-rowan-red text-xs mt-1">{errors.idType}</p>}

      {/* ID Number */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">ID Number</label>
      <input
        type="text"
        value={idNumber}
        onChange={(e) => setIdNumber(e.target.value)}
        placeholder="Enter your ID number"
        className={inputCls}
      />
      {errors.idNumber && <p className="text-rowan-red text-xs mt-1">{errors.idNumber}</p>}

      {/* ID Expiry Date */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">ID Expiry Date</label>
      <input
        type="date"
        value={idExpiry}
        onChange={(e) => setIdExpiry(e.target.value)}
        className={inputCls}
      />
      {errors.idExpiry && <p className="text-rowan-red text-xs mt-1">{errors.idExpiry}</p>}

      {/* Country of Issue */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">Country of Issue</label>
      <input
        type="text"
        value={countryOfIssue}
        onChange={(e) => setCountryOfIssue(e.target.value)}
        placeholder="e.g. Uganda"
        className={inputCls}
      />
      {errors.countryOfIssue && <p className="text-rowan-red text-xs mt-1">{errors.countryOfIssue}</p>}

      <div className="mt-8">
        <Button variant="primary" size="lg" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
