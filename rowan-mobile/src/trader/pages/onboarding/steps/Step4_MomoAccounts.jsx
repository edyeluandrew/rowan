import { useState } from 'react';
import MomoAccountRow from '../../../components/onboarding/MomoAccountRow';
import Button from '../../../components/ui/Button';

/**
 * Step4_MomoAccounts — Mobile Money verification with OTP.
 * Props: formData, setFormData, goNext
 */
export default function Step4_MomoAccounts({ formData, setFormData, goNext }) {
  const [accounts, setAccounts] = useState([{ id: Date.now() }]);
  const [verifiedMap, setVerifiedMap] = useState({});
  const [error, setError] = useState(null);

  const addAccount = () => {
    setAccounts((prev) => [...prev, { id: Date.now() }]);
  };

  const removeAccount = (index) => {
    setAccounts((prev) => prev.filter((_, i) => i !== index));
    setVerifiedMap((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleVerified = (index, accountData) => {
    setVerifiedMap((prev) => ({ ...prev, [index]: accountData }));
  };

  const verifiedCount = Object.keys(verifiedMap).length;

  const handleContinue = () => {
    setError(null);
    if (verifiedCount < 1) {
      setError('At least one mobile money account must be verified to proceed');
      return;
    }
    const verifiedAccounts = Object.values(verifiedMap);
    setFormData((prev) => ({
      ...prev,
      momoAccounts: verifiedAccounts,
    }));
    goNext();
  };

  return (
    <div>
      <h2 className="text-rowan-text font-bold text-xl">Verify your mobile money accounts</h2>
      <p className="text-rowan-muted text-sm mt-1 mb-6">
        We verify ownership of each account you'll use for payouts. You need at least one verified account.
      </p>

      {/* Add Account button */}
      <button
        type="button"
        onClick={addAccount}
        className="w-full py-3 rounded-md border border-rowan-yellow text-rowan-yellow text-sm font-medium mb-4 active:bg-rowan-yellow/10 transition-colors"
      >
        + Add Account
      </button>

      {/* Account rows */}
      {accounts.map((acc, i) => (
        <MomoAccountRow
          key={acc.id}
          index={i}
          onVerified={handleVerified}
          onRemove={removeAccount}
        />
      ))}

      {error && <p className="text-rowan-red text-sm text-center mt-3">{error}</p>}

      {verifiedCount > 0 && (
        <p className="text-rowan-green text-xs text-center mt-2">
          {verifiedCount} account{verifiedCount > 1 ? 's' : ''} verified
        </p>
      )}

      <div className="mt-8">
        <Button variant="primary" size="lg" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
