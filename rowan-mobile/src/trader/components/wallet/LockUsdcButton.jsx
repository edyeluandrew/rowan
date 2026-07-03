import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import useTraderWallet from '../../hooks/useTraderWallet';
import { buildAndSignUsdcPayment, submitTransaction } from '../../../wallet/utils/stellar';
import { verifyUsdcLock } from '../../api/trader';

/**
 * Send USDC to escrow from the trader's Rowan wallet (no external wallet).
 */
export default function LockUsdcButton({ tx, onLocked, onError }) {
  const navigate = useNavigate();
  const { keypair, publicKey, usdcBalance, isReady, refresh } = useTraderWallet();
  const [sending, setSending] = useState(false);
  const escrowAddress = tx?.escrow_address || '';
  const memo = tx?.escrow_memo || '';
  const usdcAmount = Number(tx?.usdc_amount || 0);
  const linkedAddress = tx?.trader_stellar_address || tx?.stellar_address || publicKey || '';
  const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL;

  const handleSend = async () => {
    if (!keypair?.secretKey) {
      onError?.('Set up your Rowan wallet first — Profile → Stellar Wallet');
      navigate('/trader/wallet');
      return;
    }
    if (!isReady) {
      onError?.('Enable USDC in your Rowan wallet first');
      navigate('/trader/wallet');
      return;
    }
    if (linkedAddress && keypair.publicKey !== linkedAddress) {
      onError?.('Your Rowan wallet address does not match your profile. Open Stellar Wallet to fix.');
      navigate('/trader/wallet');
      return;
    }
    if (!escrowAddress || !memo || !usdcAmount) {
      onError?.('Missing escrow details for this order');
      return;
    }
    if (Number(usdcBalance || 0) < usdcAmount) {
      onError?.(`Need ${usdcAmount.toFixed(4)} USDC in your Rowan wallet (you have ${Number(usdcBalance || 0).toFixed(4)}). Swap XLM → USDC in Stellar Wallet.`);
      navigate('/trader/wallet');
      return;
    }

    try {
      setSending(true);
      const signed = await buildAndSignUsdcPayment({
        sourceSecretKey: keypair.secretKey,
        destinationAddress: escrowAddress,
        usdcAmount,
        memo,
        horizonUrl,
      });
      await submitTransaction(signed, horizonUrl);
      await refresh();

      try {
        const result = await verifyUsdcLock(tx.id);
        if (result.status === 'locked' || result.status === 'already_locked') {
          await onLocked?.(result);
        } else if (result.status === 'wrong_sender') {
          onError?.(result.message);
        } else {
          await onLocked?.({ pending: true, ...result });
        }
      } catch (err) {
        await onLocked?.({ pending: true, error: err.response?.data?.error });
      }
    } catch (err) {
      onError?.(err.message || 'Could not send USDC');
    } finally {
      setSending(false);
    }
  };

  if (!keypair) {
    return (
      <div className="space-y-2">
        <p className="text-rowan-muted text-xs text-center">
          Create a Rowan wallet once — then fund, swap, and lock USDC here.
        </p>
        <Button size="lg" onClick={() => navigate('/trader/wallet')}>
          Set up Rowan wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-rowan-bg rounded-lg p-2">
        <p className="text-rowan-muted text-[10px] uppercase">Rowan wallet</p>
        <p className="text-rowan-text text-xs font-mono break-all mt-1">{publicKey}</p>
        <p className="text-rowan-muted text-[10px] mt-1">
          USDC: {Number(usdcBalance || 0).toFixed(4)} · need {usdcAmount.toFixed(4)}
        </p>
      </div>

      {!isReady && (
        <Button variant="ghost" size="sm" className="w-full border border-rowan-border" onClick={() => navigate('/trader/wallet')}>
          Enable USDC in Rowan wallet
        </Button>
      )}

      <Button loading={sending} size="lg" onClick={handleSend} disabled={!isReady || sending}>
        Send USDC to escrow from Rowan
      </Button>

      <button
        type="button"
        onClick={() => navigate('/trader/wallet')}
        className="text-rowan-yellow text-xs underline w-full text-center"
      >
        Manage wallet (fund / swap USDC)
      </button>
    </div>
  );
}
