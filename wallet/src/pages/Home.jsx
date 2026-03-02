import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, Clock, Star } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useTransactions from '../hooks/useTransactions'
import BalanceCard from '../components/wallet/BalanceCard'
import RateDisplay from '../components/wallet/RateDisplay'
import AddressDisplay from '../components/wallet/AddressDisplay'
import TransactionCard from '../components/transactions/TransactionCard'
import Button from '../components/ui/Button'

export default function Home() {
  const navigate = useNavigate()
  const { balance, loading: balanceLoading, refresh: refreshBalance, publicKey } = useWallet()
  const { rates, allRates, loading: ratesLoading } = useRates()
  const { transactions, loading: txLoading } = useTransactions()

  const recent = transactions.slice(0, 3)

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-rowan-text text-lg font-bold">Rowan Wallet</h1>
        <AddressDisplay address={publicKey} />
      </div>

      <BalanceCard
        balance={balance}
        loading={balanceLoading}
        onRefresh={refreshBalance}
        rates={rates}
      />

      <div className="mt-4">
        <Button onClick={() => navigate('/cashout')}>
          <ArrowDownToLine size={18} className="mr-2" />
          Cash Out
        </Button>
      </div>

      <div className="mt-6">
        <RateDisplay rates={allRates} loading={ratesLoading} />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-rowan-text text-sm font-semibold">Recent Transactions</h3>
          {recent.length > 0 && (
            <button
              onClick={() => navigate('/history')}
              className="text-rowan-yellow text-xs"
            >
              View All
            </button>
          )}
        </div>

        {txLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin text-rowan-muted">
              <Clock size={20} />
            </div>
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-rowan-surface rounded-xl p-8 text-center">
            <Star size={32} className="text-rowan-muted mx-auto mb-3" />
            <p className="text-rowan-muted text-sm">No transactions yet</p>
            <p className="text-rowan-muted text-xs mt-1">
              Cash out XLM to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <TransactionCard key={tx.id} transaction={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
