import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { getSecure, setSecure } from '../../../shared/utils/storage';
import { buildAndSignUsdcPayment, submitTransaction, isValidSecretKey, keypairFromSecret } from '../../../wallet/utils/stellar';
import { verifyWalletAddress } from '../../api/wallet';

const TRADER_KEY_STORAGE = 'rowan_trader_stellar_keypair';

/**
 * One-tap send USDC from trader's imported Rowan wallet key to escrow.
 */
export default function LockUsdcButton({ tx, onLocked, onError }) {
  const [sending, setSending] = useState(false);
  const [importSecret, setImportSecret] = useState('');
  const [importing, setImporting] = useState(false);
  const [localPublicKey, setLocalPublicKey] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const linkedAddress = tx?.trader_stellar_address || tx?.stellar_address || '';
  const escrowAddress = tx?.escrow_address || '';
  const memo = tx?.escrow_memo || '';
  const usdcAmount = Number(tx?.usdc_amount || 0);
  const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL;

  useEffect(() => {
    (async () => {
      const stored = await getSecure(TRADER_KEY_STORAGE);
      if (stored) {
        try {
          const kp = JSON.parse(stored);
          setLocalPublicKey(kp.publicKey || null);
        } catch {
          setLocalPublicKey(null);
        }
      }
    })();
  }, []);

  const handleImport = async () => {
    const secret = importSecret.trim();
    if (!isValidSecretKey(secret)) {
      onError?.('Enter a valid Stellar secret key (starts with S)');
      return;
    }
    setImporting(true);
    try {
      const kp = keypairFromSecret(secret);
      const publicKey = kp.publicKey();
      await setSecure(TRADER_KEY_STORAGE, JSON.stringify({ publicKey, secretKey: secret }));
      await verifyWalletAddress(publicKey);
      setLocalPublicKey(publicKey);
      setShowImport(false);
      setImportSecret('');
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Could not save wallet key');
    } finally {
      setImporting(false);
    }
  };

  const handleSend = async () => {
    if (!escrowAddress || !memo || !usdcAmount) {
      onError?.('Missing escrow details for this order');
      return;
    }
    const stored = await getSecure(TRADER_KEY_STORAGE);
    if (!stored) {
      setShowImport(true);
      onError?.('Import your Stellar secret key first (same wallet you use for USDC)');
      return;
    }
    let kp;
    try {
      kp = JSON.parse(stored);
    } catch {
      onError?.('Wallet key data corrupted — re-import your secret key');
      return;
    }
    if (!kp.secretKey) {
      setShowImport(true);
      onError?.('Import your Stellar secret key to send USDC from Rowan');
      return;
    }
    if (linkedAddress && kp.publicKey !== linkedAddress) {
      onError?.(`Your imported wallet (${kp.publicKey.slice(0, 8)}…) does not match your Rowan linked address (${linkedAddress.slice(0, 8)}…). Re-import or update Profile → Stellar Wallet.`);
      return;
    }

    setSending(true);
    try {
      const signed = await buildAndSignUsdcPayment({
        sourceSecretKey: kp.secretKey,
        destinationAddress: escrowAddress,
        usdcAmount,
        memo,
        horizonUrl,
      });
      await submitTransaction(signed, horizonUrl);
      await onLocked?.();
    } catch (err) {
      onError?.(err.message || 'Could not send USDC');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-rowan-border/50 pt-3">
      {linkedAddress && (
        <div className="bg-rowan-bg rounded-lg p-2">
          <p className="text-rowan-muted text-[10px] uppercase">Your Rowan linked address (must send from this)</p>
          <p className="text-rowan-text text-xs font-mono break-all mt-1">{linkedAddress}</p>
        </div>
      )}

      {localPublicKey && localPublicKey !== linkedAddress && (
        <p className="text-rowan-red text-xs">
          Imported key address does not match your Rowan profile. Tap Verify Address in Stellar Wallet or re-import.
        </p>
      )}

      <Button loading={sending} size="lg" onClick={handleSend}>
        Send USDC to escrow from Rowan
      </Button>

      {!showImport ? (
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="text-rowan-yellow text-xs underline w-full text-center"
        >
          Import Stellar secret key (one-time)
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-rowan-muted text-xs">
            Paste the secret key (S…) for the wallet that holds your USDC. Stored securely on this device only.
          </p>
          <input
            type="password"
            value={importSecret}
            onChange={(e) => setImportSecret(e.target.value)}
            placeholder="S… secret key"
            className="w-full bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text text-xs font-mono"
          />
          <Button loading={importing} variant="ghost" size="sm" className="w-full border border-rowan-border" onClick={handleImport}>
            Save key & link address
          </Button>
        </div>
      )}
    </div>
  );
}
