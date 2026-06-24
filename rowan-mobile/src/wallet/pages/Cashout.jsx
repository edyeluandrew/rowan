import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ArrowDownToLine, AlertTriangle } from 'lucide-react'
import useRates from '../hooks/useRates'
import useWallet from '../hooks/useWallet'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import { getQuote } from '../api/cashout'
import client from '../api/client'
import { hashPhoneNumber } from '../utils/crypto'
import { MIN_XLM_AMOUNT, NETWORKS, COUNTRY_CODES } from '../utils/constants'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import Button from '../components/ui/Button'

export default function Cashout() {
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const { rates, allRates } = useRates()
  const { balance } = useWallet()
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState(null)
  const [phone, setPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [networkLimits, setNetworkLimits] = useState([])

  useEffect(() => {
    client.get('/api/v1/config/cashout-limits')
      .then((res) => setNetworkLimits(res.data?.data?.networkLimits || []))
      .catch(() => {})
  }, [])

  const xlmAmount = parseFloat(amount) || 0
  // allRates may be array [{network, rate, fee}] or object {NETWORK_KEY: rate}
  const selectedRate = network && allRates
    ? Array.isArray(allRates)
      ? allRates.find((r) => r.network === network)
      : allRates[network] != null
        ? { rate: allRates[network], fee: 0 }
        : null
    : null
  const rateValue = selectedRate?.rate || 0
  const currency = network ? NETWORKS[network]?.currency : null
  const feeXlm = selectedRate?.fee || 0
  const fiatAmount = xlmAmount && rateValue ? xlmAmount * rateValue : 0
  const fiatFee = feeXlm * rateValue
  const netFiat = fiatAmount - fiatFee
  const maxAmount = balance || 0

  const selectedNetworkLimits = useMemo(
    () => networkLimits.find((l) => l.network === network),
    [networkLimits, network]
  )
  const maxXlmForNetwork = selectedNetworkLimits?.maxFiat && rateValue
    ? selectedNetworkLimits.maxFiat / rateValue
    : null
  const amountTooLarge = selectedNetworkLimits?.maxFiat && netFiat > selectedNetworkLimits.maxFiat

  const canProceed =
    xlmAmount >= MIN_XLM_AMOUNT &&
    xlmAmount <= maxAmount &&
    !amountTooLarge &&
    network &&
    phone.length >= 7 &&
    recipientName.trim().length >= 2

  // Show biometric lock if app requires re-entry authentication
  if (isLocked) return <BiometricLock />

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig
        ? COUNTRY_CODES[networkConfig.country]?.code || '+256'
        : '+256'
      const cleanPhone = phone.replace(/\D/g, '')
      const fullPhone = `${derivedCountryCode}${cleanPhone}`
      const phoneHash = await hashPhoneNumber(fullPhone)
      const quote = await getQuote({ 
        xlmAmount, 
        network, 
        phoneHash,
        payoutPhone: fullPhone,
        payoutName: recipientName.trim(),
      })
      navigate('/wallet/cashout/confirm', { state: { quote, network, phone: fullPhone, recipientName: recipientName.trim() } })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Cash Out</h1>
      </div>

      {/* Available Balance Display */}
      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Available Balance</p>
        <div className="flex items-baseline gap-2">
          <span className="text-rowan-text text-2xl font-bold">
            {balance !== null ? Number(balance).toFixed(2) : '0.00'}
          </span>
          <span className="text-rowan-muted">XLM</span>
        </div>
      </div>

      <AmountInput
        xlmAmount={amount}
        onAmountChange={setAmount}
        fiatAmount={netFiat}
        currency={currency}
        rate={rateValue}
        fee={feeXlm}
        netFiat={netFiat}
      />

      <div className="mt-6">
        <NetworkSelector selected={network} onSelect={setNetwork} />
      </div>

      <div className="mt-6">
        <PhoneInput
          phone={phone}
          onPhoneChange={setPhone}
          network={network}
        />
      </div>

      <div className="mt-6">
        <label className="block text-rowan-muted text-xs font-medium mb-2 uppercase tracking-wider">
          Recipient Mobile Money Name
        </label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="e.g., Edyelu Andrew"
          className="w-full bg-rowan-surface border border-rowan-border rounded-lg px-4 py-3 text-rowan-text placeholder-rowan-muted focus:outline-none focus:border-rowan-yellow"
        />
        <p className="text-rowan-muted text-xs mt-1">The mobile money account holder name</p>
      </div>

      {error && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      {amountTooLarge && selectedNetworkLimits && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-yellow text-sm font-medium">Amount too large for this network</p>
            <p className="text-rowan-muted text-xs mt-1">
              Maximum payout is {Math.floor(selectedNetworkLimits.maxFiat).toLocaleString()} {selectedNetworkLimits.currency}
              {maxXlmForNetwork ? ` (~${maxXlmForNetwork.toFixed(2)} XLM at current rate)` : ''}.
            </p>
          </div>
        </div>
      )}

      {/* Validation feedback */}
      {!canProceed && (
        <div className="mt-6 p-3 bg-rowan-surface rounded-lg border border-rowan-border">
          <p className="text-rowan-muted text-xs font-medium mb-2">To proceed, you need:</p>
          <ul className="text-xs space-y-1">
            <li className={xlmAmount >= MIN_XLM_AMOUNT && xlmAmount <= maxAmount ? 'text-rowan-green' : 'text-rowan-muted'}>
              {xlmAmount >= MIN_XLM_AMOUNT && xlmAmount <= maxAmount ? '✓' : '✗'} Amount: {MIN_XLM_AMOUNT}–{maxAmount} XLM
            </li>
            <li className={network ? 'text-rowan-green' : 'text-rowan-muted'}>
              {network ? '✓' : '✗'} Mobile money provider selected
            </li>
            <li className={phone.length >= 7 ? 'text-rowan-green' : 'text-rowan-muted'}>
              {phone.length >= 7 ? '✓' : '✗'} Phone number: {phone.length}/7+ digits
            </li>
            <li className={recipientName.trim().length >= 2 ? 'text-rowan-green' : 'text-rowan-muted'}>
              {recipientName.trim().length >= 2 ? '✓' : '✗'} Recipient name: {recipientName.length}/2+ characters
            </li>
          </ul>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={handleGetQuote} loading={loading} disabled={!canProceed}>
          <ArrowDownToLine size={18} className="mr-2" />
          Get Quote
        </Button>
      </div>
    </div>
  )
}
