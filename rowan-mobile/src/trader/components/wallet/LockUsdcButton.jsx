import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { useTraderWallet } from '../../context/TraderWalletContext';
import { lockUsdcToEscrow } from '../../utils/lockUsdc';
import { verifyWalletAddress } from '../../api/wallet';

/**
 * Lock USDC into escrow from the trader's single Rowan wallet.
 */
export default function LockUsdcButton({ tx, onLocked, onError, onProfileLinked, autoSend = false }) {
  const navigate = useNavigate();
  const { keypair, publicKey, usdcBalance, isReady, refresh, setLinkedAddress, ensureWallet, linkedAddress, profileSyncing, replacedConflictingWallet } = useTraderWallet();
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState(false);
  const autoSent = useRef(false);
  const autoLinked = useRef(false);
  const escrowAddress = tx?.escrow_address || '';
  const memo = tx?.escrow_memo || '';
  const usdcAmount = Number(tx?.usdc_amount || 0);
  const profileAddress = tx?.trader_stellar_address || tx?.stellar_address || '';
  const profileLinked = !!(publicKey && linkedAddress === publicKey);
  const addressMismatch = !!(
    !profileSyncing &&
    keypair?.publicKey &&
    profileAddress &&
    keypair.publicKey !== profileAddress &&
    !profileLinked
  );
  const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL;
  const canSend = isReady && !profileSyncing && !addressMismatch && Number(usdcBalance || 0) >= usdcAmount && !!escrowAddress && !!memo;

  const handleLinkThisWallet = async () => {
    if (!keypair?.publicKey) return false;
    try {
      setLinking(true);
      await verifyWalletAddress(keypair.publicKey);
      setLinkedAddress(keypair.publicKey);
      await onProfileLinked?.();
      return true;
    } catch (err) {
      const taken = err.response?.status === 409;
      onError?.(
        taken
          ? 'This phone wallet belongs to another trader account. Rowan will use a new wallet for this login.'
          : (err.response?.data?.error || err.message || 'Could not link this wallet')
      );
      return false;
    } finally {
      setLinking(false);
    }
  };

  const handleSend = async () => {
    if (!keypair?.secretKey) {
      try {
        await ensureWallet();
      } catch {
        onError?.('Could not set up your Rowan wallet');
        navigate('/trader/wallet');
        return;
      }
    }
    const secret = keypair?.secretKey;
    if (!secret) {
      onError?.('Set up your Rowan wallet first');
      navigate('/trader/wallet');
      return;
    }
    if (!isReady) {
      onError?.('Enable USDC in your Rowan wallet first');
      navigate('/trader/wallet');
      return;
    }
    if (addressMismatch) {
      const linked = await handleLinkThisWallet();
      if (!linked) return;
    }
    if (Number(usdcBalance || 0) < usdcAmount) {
      onError?.(`Need ${usdcAmount.toFixed(4)} USDC (you have ${Number(usdcBalance || 0).toFixed(4)}). Swap XLM → USDC in Rowan Wallet.`);
      navigate('/trader/wallet');
      return;
    }

    try {
      setSending(true);
      const result = await lockUsdcToEscrow({
        secretKey: secret,
        escrowAddress,
        usdcAmount,
        memo,
        horizonUrl,
        transactionId: tx.id,
      });
      await refresh();
      if (result.status === 'locked' || result.status === 'already_locked') {
        await onLocked?.(result);
      } else if (result.status === 'wrong_sender') {
        onError?.(result.message);
      } else {
        await onLocked?.({ pending: true, ...result });
      }
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Could not lock USDC');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (autoLinked.current || linking || profileSyncing || !keypair?.publicKey || profileLinked) return;
    if (!profileAddress || profileAddress === keypair.publicKey) return;
    autoLinked.current = true;
    handleLinkThisWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keypair?.publicKey, profileAddress, profileLinked, linking, profileSyncing]);

  useEffect(() => {
    if (!autoSend || autoSent.current || sending || !canSend) return;
    autoSent.current = true;
    handleSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when wallet is ready
  }, [autoSend, canSend, sending]);

  if (!keypair && !sending) {
    return (
      <div className="space-y-2">
        <p className="text-rowan-muted text-xs text-center">Setting up your Rowan wallet…</p>
        <Button size="lg" onClick={() => ensureWallet().catch((err) => onError?.(err.message))}>
          Create wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-rowan-bg rounded-lg p-2">
        <p className="text-rowan-muted text-[10px] uppercase">Your Rowan wallet</p>
        <p className="text-rowan-muted text-[10px] mt-1">
          USDC {Number(usdcBalance || 0).toFixed(4)} · lock {usdcAmount.toFixed(4)}
        </p>
      </div>

      {(profileSyncing || linking) && !profileLinked && (
        <p className="text-rowan-muted text-xs text-center">Linking this phone wallet…</p>
      )}

      {replacedConflictingWallet && (
        <p className="text-rowan-muted text-xs text-center">
          This phone had a wallet for another trader account. This login has its own Rowan wallet — add USDC, then lock.
        </p>
      )}

      {addressMismatch && !linking && !replacedConflictingWallet && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-lg p-3 space-y-2">
          <p className="text-rowan-red text-xs">This phone wallet is not linked yet.</p>
          <Button loading={linking} size="sm" className="w-full" onClick={handleLinkThisWallet}>
            Use this wallet
          </Button>
        </div>
      )}

      <Button
        loading={sending || linking || profileSyncing}
        size="lg"
        onClick={handleSend}
        disabled={sending || linking || profileSyncing || !isReady}
      >
        Lock {usdcAmount.toFixed(4)} USDC
      </Button>

      <button
        type="button"
        onClick={() => navigate('/trader/wallet')}
        className="text-rowan-yellow text-xs underline w-full text-center"
      >
        Add USDC
      </button>
    </div>
  );
}
