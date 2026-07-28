import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, AlertTriangle } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import {
  getUtilityQuote,
  getUtilityConfig,
  getUtilityHistory,
  getUtilityBillers,
} from '../api/utilities'
import AmountInput from '../components/cashout/AmountInput'
import BillerPicker from '../components/utilities/BillerPicker'
import Button from '../components/ui/Button'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'

function isPrepaidElectricityBiller(biller) {
  if (!biller) return false
  return (
    String(biller.type || '').toUpperCase() === 'ELECTRICITY_BILL_PAYMENT'
    && String(biller.serviceType || '').toUpperCase() === 'PREPAID'
  )
}

export default function UtilitiesBills() {
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const { country, fiatCurrency } = useUserCountry()
  const { usdcAvailable, usdcBalance, hasUsdcTrustline } = useWallet()
  const spendableUsdc = usdcAvailable ?? usdcBalance
  const { rates } = useRates(fiatCurrency)

  const [selectedBiller, setSelectedBiller] = useState(null)
  const [billers, setBillers] = useState([])
  const [billersLoading, setBillersLoading] = useState(false)
  const [billersError, setBillersError] = useState(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [fiatAmount, setFiatAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [utilityConfig, setUtilityConfig] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    getUtilityConfig().then(setUtilityConfig).catch(() => {})
    getUtilityHistory(5)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : []
        setHistory(list.filter((r) => (r.type || r.utility_type) === 'bill'))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setBillersLoading(true)
    setBillersError(null)
    setSelectedBiller(null)
    getUtilityBillers(country)
      .then((data) => setBillers(data.billers || []))
      .catch((err) => {
        setBillers([])
        setBillersError(err.response?.data?.error || err.message)
      })
      .finally(() => setBillersLoading(false))
  }, [country])

  const currency = selectedBiller?.currency || fiatCurrency
  const usdcToFiatRate = rates?.usdcToFiat || 0
  const feePercent = utilityConfig?.feePercent ?? 1
  const minFiat = selectedBiller?.minAmount ?? utilityConfig?.minFiatAmount ?? 1000
  const maxFiat = selectedBiller?.maxAmount ?? utilityConfig?.maxFiatAmount ?? 500000

  const netFiat = parseFloat(fiatAmount) || 0
  const usdcEstimate = usdcToFiatRate > 0 && netFiat > 0
    ? (netFiat / usdcToFiatRate) * (1 + feePercent / 100)
    : 0

  const walletMaxFiat = usdcToFiatRate > 0 && spendableUsdc != null
    ? spendableUsdc * usdcToFiatRate / (1 + feePercent / 100)
    : null

  const accountValid = accountNumber.replace(/\s+/g, '').length >= 4
  const exceedsWallet = walletMaxFiat != null && netFiat > walletMaxFiat
  const belowMin = netFiat > 0 && netFiat < minFiat
  const aboveMax = netFiat > maxFiat

  const canProceed =
    !!selectedBiller &&
    accountValid &&
    netFiat >= minFiat &&
    netFiat <= maxFiat &&
    hasUsdcTrustline !== false &&
    !exceedsWallet

  if (isLocked) return <BiometricLock />

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const cleanAccount = accountNumber.replace(/\s+/g, '')
      const billerLabel = selectedBiller.serviceType
        ? `${selectedBiller.name} (${selectedBiller.serviceType})`
        : selectedBiller.name

      const quote = await getUtilityQuote({
        country: selectedBiller.countryCode || country,
        type: 'bill',
        billerId: selectedBiller.id,
        billerName: selectedBiller.name,
        billerServiceType: selectedBiller.serviceType,
        billerType: selectedBiller.type,
        subscriberAccount: cleanAccount,
        fiatAmount: Math.round(netFiat),
        bundleDescription: billerLabel,
      })

      navigate('/wallet/utilities/confirm', {
        state: {
          quote,
          phone: cleanAccount,
          utilityType: 'bill',
          mockPurchaseAllowed: utilityConfig?.mockPurchaseAllowed,
        },
      })
    } catch (err) {
      const data = err.response?.data
      setError(data?.error || data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 pb-8">
      <p className="text-rowan-muted text-xs mb-4">
        Pay electricity and utility bills with USDC
      </p>

      <UsdcTrustlineSetup compact />

      {(utilityConfig?.reloadlyUtilitiesMock ?? utilityConfig?.reloadlyMock) && (
        <div className="bg-rowan-mint border border-rowan-green/30 rounded-xl p-3 mb-4">
          <p className="text-rowan-text text-xs">
            Bill pay uses Reloadly Utility Payments (sandbox until live keys are verified).
          </p>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">USDC balance</p>
        <span className="text-rowan-text text-2xl font-bold tabular-nums">
          {spendableUsdc != null ? Number(spendableUsdc).toFixed(2) : '—'} USDC
        </span>
      </div>

      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3 px-1">
        Select provider
      </p>
      {billersError && (
        <div className="mb-3 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-3">
          <p className="text-rowan-yellow text-sm">{billersError}</p>
        </div>
      )}
      <BillerPicker
        billers={billers}
        selected={selectedBiller}
        onSelect={setSelectedBiller}
        loading={billersLoading}
        country={country}
      />

      <div className="mt-6">
        <label className="block text-rowan-muted text-xs font-medium mb-2 uppercase tracking-wider">
          Meter / account number
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="e.g. 04123456789"
          className="w-full bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 text-rowan-text min-h-11"
        />
        <p className="text-rowan-muted text-xs mt-2 px-1">
          Prepaid: meter number · Postpaid: account number on your bill
        </p>
      </div>

      {selectedBiller && (
        <div className="mt-6">
          <AmountInput
            fiatAmount={fiatAmount}
            onFiatAmountChange={setFiatAmount}
            currency={currency}
            cryptoEstimate={usdcEstimate}
            cryptoLabel="USDC"
            platformFeeFiat={netFiat * (feePercent / 100)}
            maxFiat={Math.min(maxFiat, walletMaxFiat ?? maxFiat)}
          />
          <p className="text-rowan-muted text-xs mt-2 px-1">
            Min {minFiat.toLocaleString()} · Max {maxFiat.toLocaleString()} {currency}
          </p>
          {isPrepaidElectricityBiller(selectedBiller) && netFiat > 0 && (
            <div className="mt-3 bg-rowan-surface border border-rowan-border rounded-xl p-3">
              <p className="text-rowan-muted text-xs">
                Electricity units and Yaka token are confirmed by Reloadly / Umeme after payment — shown on your receipt.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4">
          <p className="text-rowan-red text-sm">{error}</p>
        </div>
      )}

      {(exceedsWallet || belowMin || aboveMax) && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div className="text-rowan-yellow text-sm">
            {exceedsWallet && <p>Amount exceeds your available USDC</p>}
            {belowMin && <p>Minimum payment is {minFiat.toLocaleString()} {currency}</p>}
            {aboveMax && <p>Maximum payment is {maxFiat.toLocaleString()} {currency}</p>}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={handleGetQuote} loading={loading} disabled={!canProceed}>
          <Zap size={18} className="mr-2" />
          Get quote
        </Button>
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-rowan-text text-sm font-semibold mb-3">Recent bills</h2>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/wallet/utilities/status/${item.id}`, { state: { quote: item } })}
                className="w-full bg-rowan-surface border border-rowan-border rounded-xl p-3 text-left"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-rowan-text text-sm font-medium truncate">
                    {item.bundleDescription || item.operatorName || 'Bill payment'}
                  </span>
                  <span className={`text-xs font-medium shrink-0 ${
                    item.status === 'COMPLETED' ? 'text-rowan-green'
                      : item.status === 'FAILED' ? 'text-rowan-red'
                        : 'text-rowan-muted'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-rowan-muted text-xs mt-1 tabular-nums">
                  {Number(item.fiatAmount).toLocaleString()} {item.fiatCurrency}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
