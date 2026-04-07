import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Globe, Fingerprint, Copy,
  KeyRound, Wallet, TrendingUp,
} from 'lucide-react';
import { getWallet, verifyWalletAddress } from '../api/wallet';
import { useToast } from '../hooks/useToast';
import { COPY_FEEDBACK_TIMEOUT_MS } from '../utils/constants';
import WalletTransactionRow from '../components/wallet/WalletTransactionRow';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';

export default function StellarWallet() {
  const navigate = useNavigate();
  const { success: successToast, error: errorToast, info: infoToast } = useToast();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVerify, setShowVerify] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getWallet();
        setWallet(data);
      } catch { 
        errorToast('Failed to Load', 'Could not load wallet data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyAddress = () => {
    const addr = wallet?.stellarAddress || wallet?.stellar_address || '';
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
      successToast('Copied', 'Address copied to clipboard');
    });
  };

  const handleVerify = async () => {
    if (!newAddress.trim()) { errorToast('Required', 'Enter a Stellar address'); return; }
    setVerifying(true);
    try {
      await verifyWalletAddress(newAddress.trim());
      setWallet((prev) => ({
        ...prev,
        stellarAddress: newAddress.trim(),
        stellar_address: newAddress.trim(),
      }));
      successToast('Address Verified', 'Wallet address updated successfully');
      setShowVerify(false);
      setNewAddress('');
    } catch (err) {
      errorToast('Verification Failed', err.response?.data?.error || 'Could not verify address');
    } finally {
      setVerifying(false);
    }
  };

  const address = wallet?.stellarAddress || wallet?.stellar_address || '';
  const balance = wallet?.usdcBalance ?? wallet?.usdc_balance ?? 0;
  const txs = wallet?.recentTransactions || wallet?.recent_transactions || [];

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={28} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <Globe size={20} className="text-rowan-yellow" />
        <h1 className="text-rowan-text font-semibold text-lg">Stellar Wallet</h1>
      </div>

      <div className="px-4">
        {/* Address card */}
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mt-4">
          <div className="flex items-center gap-2">
            <Fingerprint size={16} className="text-rowan-muted" />
            <span className="text-rowan-muted text-xs uppercase tracking-wider">USDC Receiving Address</span>
          </div>
          <p className="text-rowan-text font-mono text-sm mt-2 break-all">{address}</p>

          <div className="flex gap-3 mt-3">
            <button
              onClick={copyAddress}
              className="flex-1 flex items-center justify-center gap-1.5 border border-rowan-border text-rowan-muted py-2.5 rounded-lg text-sm active:bg-rowan-border/50 transition-colors"
            >
              <Copy size={15} />
              Copy Address
            </button>
            <button
              onClick={() => setShowVerify(true)}
              className="flex-1 flex items-center justify-center gap-1.5 border border-rowan-yellow text-rowan-yellow py-2.5 rounded-lg text-sm active:bg-rowan-yellow/10 transition-colors"
            >
              <KeyRound size={15} />
              Verify Address
            </button>
          </div>
        </div>

        {/* Balance card */}
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mt-3">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-rowan-muted" />
            <span className="text-rowan-muted text-xs">Current USDC Balance</span>
          </div>
          <p className="text-rowan-yellow text-3xl font-bold tabular-nums mt-1">
            {Number(balance).toFixed(2)}
          </p>
          <p className="text-rowan-muted text-xs mt-2">
            Balance fetched from Stellar network. May take a few seconds to reflect recent transactions.
          </p>
        </div>

        {/* Recent receipts */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-rowan-yellow" />
            <h3 className="text-rowan-text font-bold text-sm">Recent Receipts</h3>
          </div>
          {txs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Globe size={48} className="text-rowan-muted mb-4" />
              <p className="text-rowan-muted text-sm">No USDC receipts yet</p>
            </div>
          ) : (
            txs.map((tx, i) => (
              <WalletTransactionRow key={tx.id || i} transaction={tx} />
            ))
          )}
        </div>
      </div>

      {/* Verify bottom sheet */}
      {showVerify && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowVerify(false)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-rowan-border rounded-full mx-auto mb-4" />
            <h3 className="text-rowan-text font-semibold text-base mb-3">Verify Stellar Address</h3>

            <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-rowan-red flex-shrink-0 mt-0.5" />
                <p className="text-rowan-red text-xs">
                  Changing your receiving address will affect future USDC payments. Make sure you own this wallet.
                </p>
              </div>
            </div>

            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="G..."
              className="bg-rowan-bg border border-rowan-border text-rowan-text rounded-lg px-4 py-3 w-full text-sm font-mono focus:outline-none focus:border-rowan-yellow placeholder-rowan-muted mb-3"
            />

            <Button variant="primary" size="lg" onClick={handleVerify} loading={verifying}>
              Confirm
            </Button>
            <button
              onClick={() => setShowVerify(false)}
              className="w-full py-3 mt-2 text-rowan-muted text-sm text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
