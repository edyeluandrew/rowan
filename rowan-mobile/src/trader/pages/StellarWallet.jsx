import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Globe, Copy, CopyCheck, Wallet, TrendingUp,
  RefreshCw, Coins, ArrowRightLeft, Plus, KeyRound,
} from 'lucide-react';
import { getWallet } from '../api/wallet';
import WalletTransactionRow from '../components/wallet/WalletTransactionRow';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';
import { COPY_FEEDBACK_TIMEOUT_MS } from '../utils/constants';
import { useSocket } from '../context/SocketContext';
import useTraderWallet from '../hooks/useTraderWallet';
import { CURRENT_NETWORK } from '../../wallet/utils/constants';
import { isValidSecretKey } from '../../wallet/utils/stellar';

export default function StellarWallet() {
  const navigate = useNavigate();
  const { on, off } = useSocket();
  const {
    keypair, publicKey: walletPublicKey, xlmBalance, usdcBalance: walletUsdc,
    hasUsdcTrustline, loading: walletLoading, busy, error: walletError,
    refresh, createWallet, importWallet, fundTestnet, enableUsdc, swapToUsdc,
    setLinkedAddress, linkedAddress,
  } = useTraderWallet();
  const [serverWallet, setServerWallet] = useState(null);
  const [loadingServer, setLoadingServer] = useState(true);
  const [copied, setCopied] = useState(false);
  const [importSecret, setImportSecret] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [swapAmount, setSwapAmount] = useState('10');
  const [actionMsg, setActionMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadServerWallet = async () => {
      try {
        const data = await getWallet();
        if (!cancelled) {
          setServerWallet(data);
          setLinkedAddress(data.stellar_address || data.stellarAddress || null);
        }
      } catch {
        /* optional server metadata */
      } finally {
        if (!cancelled) setLoadingServer(false);
      }
    };

    loadServerWallet();

    const refreshAll = () => {
      loadServerWallet();
      refresh();
    };
    on('tx_complete', refreshAll);
    on('tx_update', refreshAll);

    return () => {
      cancelled = true;
      off('tx_complete', refreshAll);
      off('tx_update', refreshAll);
    };
  }, [on, off, refresh, setLinkedAddress]);

  const publicKey = walletPublicKey || serverWallet?.stellar_address || '';
  const usdcBalance = walletUsdc ?? serverWallet?.usdc_balance ?? 0;
  const txs = serverWallet?.recent_transactions || serverWallet?.recentTransactions || [];

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS);
    });
  };

  const runAction = async (label, fn) => {
    setActionMsg(null);
    try {
      await fn();
      setActionMsg({ type: 'ok', text: `${label} — done` });
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  if (walletLoading || loadingServer) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={28} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <Globe size={20} className="text-rowan-yellow" />
        <h1 className="text-rowan-text font-semibold text-lg">Rowan Wallet</h1>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {!keypair ? (
          <div className="bg-rowan-surface border border-rowan-yellow/40 rounded-xl p-4 space-y-3">
            <h2 className="text-rowan-yellow text-sm font-semibold">Set up your trader wallet</h2>
            <p className="text-rowan-muted text-xs">
              Everything happens here — fund with test XLM, swap to USDC, and lock escrow. No Freighter needed.
            </p>
            <Button loading={busy} size="lg" onClick={() => runAction('Wallet created', createWallet)}>
              <Plus size={16} className="inline mr-1" />
              Create Rowan wallet
            </Button>
            {!showImport ? (
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="text-rowan-yellow text-xs underline w-full text-center"
              >
                Import existing secret key
              </button>
            ) : (
              <div className="space-y-2 pt-2 border-t border-rowan-border">
                <input
                  type="password"
                  value={importSecret}
                  onChange={(e) => setImportSecret(e.target.value)}
                  placeholder="S… secret key"
                  className="w-full bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text text-xs font-mono"
                />
                <Button
                  loading={busy}
                  variant="ghost"
                  size="sm"
                  className="w-full border border-rowan-border"
                  disabled={!isValidSecretKey(importSecret.trim())}
                  onClick={() => runAction('Wallet imported', () => importWallet(importSecret))}
                >
                  Import & link
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Your Rowan address</span>
              </div>
              <p className="text-rowan-text font-mono text-sm mt-2 break-all">{publicKey}</p>
              <button
                type="button"
                onClick={copyAddress}
                className="mt-3 w-full flex items-center justify-center gap-1.5 border border-rowan-border text-rowan-muted py-2.5 rounded-lg text-sm"
              >
                {copied ? <><CopyCheck size={15} className="text-rowan-green" /><span className="text-rowan-green">Copied</span></> : <><Copy size={15} />Copy address</>}
              </button>
              {linkedAddress && linkedAddress !== publicKey && (
                <p className="text-rowan-red text-xs mt-2">
                  Profile linked to a different address — recreate wallet or re-import the matching key.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
                <p className="text-rowan-muted text-xs">XLM balance</p>
                <p className="text-rowan-text text-2xl font-bold tabular-nums mt-1">
                  {xlmBalance != null ? Number(xlmBalance).toFixed(2) : '—'}
                </p>
              </div>
              <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
                <div className="flex items-center gap-1">
                  <Wallet size={14} className="text-rowan-muted" />
                  <p className="text-rowan-muted text-xs">USDC balance</p>
                </div>
                <p className="text-rowan-yellow text-2xl font-bold tabular-nums mt-1">
                  {Number(usdcBalance).toFixed(2)}
                </p>
              </div>
            </div>

            {CURRENT_NETWORK.isTest && (
              <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 space-y-2">
                <p className="text-rowan-text text-sm font-medium">Testnet setup</p>
                <Button
                  loading={busy}
                  variant="ghost"
                  size="sm"
                  className="w-full border border-rowan-border"
                  onClick={() => runAction('Funded with test XLM', fundTestnet)}
                >
                  Get testnet XLM
                </Button>
                {hasUsdcTrustline === false && (
                  <Button
                    loading={busy}
                    size="sm"
                    className="w-full"
                    onClick={() => runAction('USDC enabled', enableUsdc)}
                  >
                    <Coins size={14} className="inline mr-1" />
                    Enable USDC
                  </Button>
                )}
                {hasUsdcTrustline && (
                  <div className="space-y-2 pt-1">
                    <p className="text-rowan-muted text-xs flex items-center gap-1">
                      <ArrowRightLeft size={12} />
                      Swap test XLM → USDC on the DEX
                    </p>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      max="1000"
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      className="w-full bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text text-sm"
                    />
                    <p className="text-rowan-muted text-[10px]">Start small (e.g. 10–50 USDC). Large swaps need more XLM.</p>
                    <Button
                      loading={busy}
                      variant="ghost"
                      size="sm"
                      className="w-full border border-rowan-border"
                      onClick={() => runAction('Swap complete', () => swapToUsdc(Number(swapAmount)))}
                    >
                      Swap for {swapAmount} USDC
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!CURRENT_NETWORK.isTest && hasUsdcTrustline === false && (
              <Button loading={busy} size="sm" className="w-full" onClick={() => runAction('USDC enabled', enableUsdc)}>
                Enable USDC trustline
              </Button>
            )}

            <button
              type="button"
              onClick={() => refresh()}
              className="w-full flex items-center justify-center gap-2 text-rowan-muted text-xs py-2"
            >
              <RefreshCw size={14} />
              Refresh balances
            </button>
          </>
        )}

        {(actionMsg || walletError) && (
          <p className={`text-xs ${(actionMsg?.type === 'error' || walletError) ? 'text-rowan-red' : 'text-rowan-green'}`}>
            {actionMsg?.text || walletError}
          </p>
        )}

        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-rowan-yellow" />
            <h3 className="text-rowan-text font-bold text-sm">Recent receipts</h3>
          </div>
          {txs.length === 0 ? (
            <p className="text-rowan-muted text-sm text-center py-8">No USDC receipts yet</p>
          ) : (
            txs.map((tx, i) => <WalletTransactionRow key={tx.id || i} transaction={tx} />)
          )}
        </div>
      </div>
    </div>
  );
}
